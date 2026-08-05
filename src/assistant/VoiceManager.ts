export interface VoiceConfig {
  voiceURI: string | null;
  rate: number;
  pitch: number;
  volume: number;
}

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  voiceURI: null,
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
};

// Phonetic Dictionary for accurate pronunciation
export const VOICE_DICTIONARY: Record<string, string> = {
  Kreator: 'Creator',
  kreator: 'creator',
};

const STORAGE_KEY_VOICE = 'kreational_assistant_voice_uri';
const STORAGE_KEY_RATE = 'kreational_assistant_voice_rate';
const STORAGE_KEY_PITCH = 'kreational_assistant_voice_pitch';
const STORAGE_KEY_VOLUME = 'kreational_assistant_voice_volume';

export interface SpeechQueueItem {
  id: string;
  text: string;
  options?: {
    configOverride?: Partial<VoiceConfig>;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
    interrupt?: boolean;
  };
}

class VoiceManagerClass {
  private voices: SpeechSynthesisVoice[] = [];
  private listeners: Set<() => void> = new Set();
  private queue: SpeechQueueItem[] = [];
  private isProcessingQueue: boolean = false;
  private currentUtterances: SpeechSynthesisUtterance[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.updateVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
          this.updateVoices();
        };
      }
    }
  }

  public updateVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const available = window.speechSynthesis.getVoices();
    if (available && available.length > 0) {
      this.voices = available;
      this.notifyListeners();
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((fn) => fn());
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (this.voices.length === 0 && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.voices = window.speechSynthesis.getVoices();
    }
    return this.voices;
  }

  public getConfig(): VoiceConfig {
    if (typeof localStorage === 'undefined') return DEFAULT_VOICE_CONFIG;

    const voiceURI = localStorage.getItem(STORAGE_KEY_VOICE);
    const rateRaw = localStorage.getItem(STORAGE_KEY_RATE);
    const pitchRaw = localStorage.getItem(STORAGE_KEY_PITCH);
    const volumeRaw = localStorage.getItem(STORAGE_KEY_VOLUME);

    return {
      voiceURI: voiceURI || null,
      rate: rateRaw ? parseFloat(rateRaw) : DEFAULT_VOICE_CONFIG.rate,
      pitch: pitchRaw ? parseFloat(pitchRaw) : DEFAULT_VOICE_CONFIG.pitch,
      volume: volumeRaw ? parseFloat(volumeRaw) : DEFAULT_VOICE_CONFIG.volume,
    };
  }

  public saveConfig(updated: Partial<VoiceConfig>): VoiceConfig {
    if (typeof localStorage === 'undefined') return DEFAULT_VOICE_CONFIG;

    if (updated.voiceURI !== undefined) {
      if (updated.voiceURI === null) {
        localStorage.removeItem(STORAGE_KEY_VOICE);
      } else {
        localStorage.setItem(STORAGE_KEY_VOICE, updated.voiceURI);
      }
    }

    if (updated.rate !== undefined) {
      localStorage.setItem(STORAGE_KEY_RATE, updated.rate.toString());
    }

    if (updated.pitch !== undefined) {
      localStorage.setItem(STORAGE_KEY_PITCH, updated.pitch.toString());
    }

    if (updated.volume !== undefined) {
      localStorage.setItem(STORAGE_KEY_VOLUME, updated.volume.toString());
    }

    this.notifyListeners();
    return this.getConfig();
  }

  public resetConfig(): VoiceConfig {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_VOICE);
      localStorage.removeItem(STORAGE_KEY_RATE);
      localStorage.removeItem(STORAGE_KEY_PITCH);
      localStorage.removeItem(STORAGE_KEY_VOLUME);
    }
    this.notifyListeners();
    return DEFAULT_VOICE_CONFIG;
  }

  /**
   * Chooses the best available English voice if no user voice is set or found.
   */
  public getBestEnglishVoice(allVoices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    if (!allVoices || allVoices.length === 0) return null;

    const englishVoices = allVoices.filter((v) => v.lang.toLowerCase().startsWith('en'));

    if (englishVoices.length === 0) {
      return allVoices.find((v) => v.default) || allVoices[0] || null;
    }

    const qualityKeywords = [
      'natural',
      'google',
      'premium',
      'enhanced',
      'online',
      'samantha',
      'daniel',
      'karen',
      'alex',
      'microsoft',
    ];

    for (const kw of qualityKeywords) {
      const matched = englishVoices.find((v) => v.name.toLowerCase().includes(kw));
      if (matched) return matched;
    }

    const defaultEn = englishVoices.find((v) => v.default);
    if (defaultEn) return defaultEn;

    return englishVoices[0];
  }

  /**
   * Resolves the selected or best-matching SpeechSynthesisVoice.
   */
  public getSelectedVoice(): SpeechSynthesisVoice | null {
    const allVoices = this.getVoices();
    if (allVoices.length === 0) return null;

    const config = this.getConfig();
    if (config.voiceURI) {
      const found = allVoices.find((v) => v.voiceURI === config.voiceURI || v.name === config.voiceURI);
      if (found) return found;
    }

    return this.getBestEnglishVoice(allVoices);
  }

  /**
   * Applies phonetic word replacements from the voice dictionary.
   */
  public applyPhonetics(text: string): string {
    let result = text;
    for (const [key, val] of Object.entries(VOICE_DICTIONARY)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      result = result.replace(regex, val);
    }
    return result;
  }

  /**
   * Helper to configure standard voice parameters on a SpeechSynthesisUtterance.
   */
  private configureUtterance(
    utt: SpeechSynthesisUtterance,
    config: VoiceConfig,
    targetVoice: SpeechSynthesisVoice | null
  ): SpeechSynthesisUtterance {
    utt.rate = config.rate;
    utt.pitch = config.pitch;
    utt.volume = config.volume;
    if (targetVoice) {
      utt.voice = targetVoice;
    }
    return utt;
  }

  /**
   * Constructs direct SpeechSynthesisUtterance sequences with a minimum delay buffer between 'Creation' and 'al'.
   */
  private createUtteranceSequence(
    text: string,
    config: VoiceConfig,
    targetVoice: SpeechSynthesisVoice | null
  ): SpeechSynthesisUtterance[] {
    const kreationalRegex = /\b(Kreational|kreational|Creation-al|creation-al)\b/i;

    if (!kreationalRegex.test(text)) {
      const phoneticText = this.applyPhonetics(text);
      const utt = new SpeechSynthesisUtterance(phoneticText);
      this.configureUtterance(utt, config, targetVoice);
      return [utt];
    }

    const tokens = text.split(/\b(Kreational|kreational|Creation-al|creation-al)\b/i);
    const sequence: SpeechSynthesisUtterance[] = [];

    for (const token of tokens) {
      if (!token) continue;

      if (kreationalRegex.test(token)) {
        // Direct SpeechSynthesisUtterance sequence with zero delay buffer between 'Creation' and 'al'
        const uCreation = new SpeechSynthesisUtterance('Creation');
        this.configureUtterance(uCreation, config, targetVoice);

        const uAl = new SpeechSynthesisUtterance('al');
        this.configureUtterance(uAl, config, targetVoice);

        sequence.push(uCreation, uAl);
      } else {
        const phoneticToken = this.applyPhonetics(token);
        if (phoneticToken.trim()) {
          const u = new SpeechSynthesisUtterance(phoneticToken);
          this.configureUtterance(u, config, targetVoice);
          sequence.push(u);
        }
      }
    }

    return sequence.length > 0 ? sequence : [this.configureUtterance(new SpeechSynthesisUtterance(text), config, targetVoice)];
  }

  /**
   * Clears the message speech queue and stops active speech synthesis.
   */
  public clearQueue(): void {
    this.queue = [];
    this.isProcessingQueue = false;
    this.currentUtterances = [];
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Message Queue Synthesizer to handle concurrent voice instructions without collisions.
   */
  public speak(
    text: string,
    options?: {
      configOverride?: Partial<VoiceConfig>;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
      interrupt?: boolean;
    }
  ): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      options?.onEnd?.();
      return;
    }

    if (options?.interrupt) {
      this.clearQueue();
    }

    const item: SpeechQueueItem = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      text,
      options,
    };

    this.queue.push(item);
    this.processQueue();
  }

  /**
   * Processes queued voice messages sequentially to prevent audio collisions.
   */
  private processQueue(): void {
    if (this.isProcessingQueue || this.queue.length === 0) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    this.isProcessingQueue = true;
    const item = this.queue.shift()!;

    try {
      const config = { ...this.getConfig(), ...item.options?.configOverride };
      const allVoices = this.getVoices();
      let targetVoice: SpeechSynthesisVoice | null = null;

      if (config.voiceURI) {
        targetVoice = allVoices.find((v) => v.voiceURI === config.voiceURI || v.name === config.voiceURI) || null;
      }

      if (!targetVoice) {
        targetVoice = this.getBestEnglishVoice(allVoices);
      }

      const utterances = this.createUtteranceSequence(item.text, config, targetVoice);
      this.currentUtterances = utterances;

      if (utterances.length === 0) {
        this.isProcessingQueue = false;
        item.options?.onEnd?.();
        this.processQueue();
        return;
      }

      let started = false;
      let completedCount = 0;
      const totalCount = utterances.length;

      const finishItem = (err?: any) => {
        if (!this.isProcessingQueue) return;
        this.isProcessingQueue = false;
        this.currentUtterances = [];

        if (err) {
          item.options?.onError?.(err);
        } else {
          item.options?.onEnd?.();
        }

        // Trigger next message in queue with minimal delay
        setTimeout(() => {
          this.processQueue();
        }, 10);
      };

      // Queue all utterances in the sequence into native SpeechSynthesis
      utterances.forEach((utt) => {
        utt.onstart = () => {
          if (!started) {
            started = true;
            item.options?.onStart?.();
          }
        };

        utt.onend = () => {
          completedCount++;
          if (completedCount >= totalCount) {
            finishItem();
          }
        };

        utt.onerror = (e) => {
          console.warn('[VoiceManager] Sequence utterance error:', e);
          finishItem(e);
        };

        window.speechSynthesis.speak(utt);
      });
    } catch (err) {
      console.error('[VoiceManager] Failed to process queue item:', err);
      this.isProcessingQueue = false;
      item.options?.onError?.(err);
      this.processQueue();
    }
  }

  /**
   * Speaks with an evil/sinister sounding voice (low pitch, slower rate) for anti-language warning.
   */
  public speakEvil(
    text: string,
    options?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ): void {
    this.speak(text, {
      configOverride: {
        pitch: 0.35,
        rate: 0.85,
        volume: 1.0,
      },
      ...options,
      interrupt: true,
    });
  }

  /**
   * Test voice function. Speaks "Hello, I'm Kreational. Welcome to your arcade."
   */
  public testVoice(
    voiceURI?: string,
    configOverride?: Partial<VoiceConfig>,
    callbacks?: { onStart?: () => void; onEnd?: () => void; onError?: (err: any) => void }
  ): void {
    const testText = "Hello, I'm Kreational. Welcome to your arcade.";
    this.speak(testText, {
      configOverride: {
        ...(voiceURI ? { voiceURI } : {}),
        ...configOverride,
      },
      ...callbacks,
      interrupt: true,
    });
  }
}

export const VoiceManager = new VoiceManagerClass();
