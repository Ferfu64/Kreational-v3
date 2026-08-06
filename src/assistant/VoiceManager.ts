import { safeGet, safeSet, safeRemove } from '../utils/persistentStorage';

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
  Kreational: 'Creation-al',
  kreational: 'creation-al',
  AZGAMES: 'A Z Games',
  azgames: 'A Z Games',
  vs: 'versus',
  VS: 'versus',
  ui: 'U I',
  UI: 'U I',
  url: 'U R L',
  URL: 'U R L',
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

  // Hard reference retention to defeat JS Garbage Collector
  private activeUtterances: SpeechSynthesisUtterance[] = [];
  private activeUtterance: SpeechSynthesisUtterance | null = null;

  // Chrome/Safari speech synthesis keep-alive timer
  private keepAliveTimer: any = null;
  private isAudioUnlocked: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.updateVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
          this.updateVoices();
        };
      }
      this.setupMobileUnlock();
    }
  }

  /**
   * One-time user interaction handler to unlock web audio & speechSynthesis on iOS/Android PWA
   */
  private setupMobileUnlock(): void {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      if (this.isAudioUnlocked) return;
      this.isAudioUnlocked = true;

      try {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.getVoices();
          const silent = new SpeechSynthesisUtterance(' ');
          silent.volume = 0.01;
          silent.rate = 10;
          window.speechSynthesis.speak(silent);
        }
      } catch (e) {
        // ignore
      }

      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
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
    const voiceURI = safeGet(STORAGE_KEY_VOICE);
    const rateRaw = safeGet(STORAGE_KEY_RATE);
    const pitchRaw = safeGet(STORAGE_KEY_PITCH);
    const volumeRaw = safeGet(STORAGE_KEY_VOLUME);

    return {
      voiceURI: voiceURI || null,
      rate: rateRaw ? parseFloat(rateRaw) : DEFAULT_VOICE_CONFIG.rate,
      pitch: pitchRaw ? parseFloat(pitchRaw) : DEFAULT_VOICE_CONFIG.pitch,
      volume: volumeRaw ? parseFloat(volumeRaw) : DEFAULT_VOICE_CONFIG.volume,
    };
  }

  public saveConfig(updated: Partial<VoiceConfig>): VoiceConfig {
    if (updated.voiceURI !== undefined) {
      if (updated.voiceURI === null) {
        safeRemove(STORAGE_KEY_VOICE);
      } else {
        safeSet(STORAGE_KEY_VOICE, updated.voiceURI);
      }
    }

    if (updated.rate !== undefined) {
      safeSet(STORAGE_KEY_RATE, updated.rate.toString());
    }

    if (updated.pitch !== undefined) {
      safeSet(STORAGE_KEY_PITCH, updated.pitch.toString());
    }

    if (updated.volume !== undefined) {
      safeSet(STORAGE_KEY_VOLUME, updated.volume.toString());
    }

    this.notifyListeners();
    return this.getConfig();
  }

  public resetConfig(): VoiceConfig {
    safeRemove(STORAGE_KEY_VOICE);
    safeRemove(STORAGE_KEY_RATE);
    safeRemove(STORAGE_KEY_PITCH);
    safeRemove(STORAGE_KEY_VOLUME);
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
   * Applies phonetic word replacements from the voice dictionary and strips Markdown
   */
  public applyPhonetics(text: string): string {
    if (!text) return '';
    let result = text;

    // Strip Markdown formatting tags so TTS doesn't read out symbols
    result = result.replace(/\*\*([^*]+)\*\*/g, '$1'); // bold
    result = result.replace(/\*([^*]+)\*/g, '$1'); // italic
    result = result.replace(/`([^`]+)`/g, '$1'); // code
    result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // links
    result = result.replace(/^#+\s+/gm, ''); // headings
    result = result.replace(/^[-*+]\s+/gm, ''); // list items

    for (const [key, val] of Object.entries(VOICE_DICTIONARY)) {
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      result = result.replace(regex, val);
    }

    return result.trim();
  }

  /**
   * Cleans text into small, readable speech chunks (max ~100 chars)
   * Prevents browser speech synthesis truncation and memory cutoff bugs.
   */
  public chunkText(text: string): string[] {
    const cleaned = this.applyPhonetics(text);
    if (!cleaned) return [];

    const MAX_CHUNK_LENGTH = 110;

    // Split first by sentences or linebreaks
    const rawSentences = cleaned.split(/(?<=[.!?;\n])\s+/);
    const chunks: string[] = [];

    for (const rawSentence of rawSentences) {
      const sentence = rawSentence.trim();
      if (!sentence) continue;

      if (sentence.length <= MAX_CHUNK_LENGTH) {
        chunks.push(sentence);
      } else {
        // Split longer sentence by clauses (comma, colon, dash)
        const clauses = sentence.split(/(?<=[,:\-–—])\s+/);
        let currentClauseGroup = '';

        for (const clause of clauses) {
          const trimmedClause = clause.trim();
          if (!trimmedClause) continue;

          if (trimmedClause.length > MAX_CHUNK_LENGTH) {
            // Split by words if clause alone exceeds limit
            const words = trimmedClause.split(/\s+/);
            let wordGroup = '';
            for (const word of words) {
              if ((wordGroup + ' ' + word).trim().length <= MAX_CHUNK_LENGTH) {
                wordGroup = (wordGroup + ' ' + word).trim();
              } else {
                if (wordGroup) chunks.push(wordGroup);
                wordGroup = word;
              }
            }
            if (wordGroup) chunks.push(wordGroup);
          } else {
            if ((currentClauseGroup + ' ' + trimmedClause).trim().length <= MAX_CHUNK_LENGTH) {
              currentClauseGroup = (currentClauseGroup + ' ' + trimmedClause).trim();
            } else {
              if (currentClauseGroup) chunks.push(currentClauseGroup);
              currentClauseGroup = trimmedClause;
            }
          }
        }
        if (currentClauseGroup) chunks.push(currentClauseGroup);
      }
    }

    return chunks.length > 0 ? chunks : [cleaned];
  }

  /**
   * Clears the message speech queue and stops active speech synthesis.
   */
  public clearQueue(): void {
    this.queue = [];
    this.isProcessingQueue = false;
    this.activeUtterances = [];
    this.activeUtterance = null;
    (window as any).__activeSpeechUtterances = [];
    this.stopKeepAlive();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        // ignore
      }
    }
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    // Chrome speech synthesis workaround for long sequences
    this.keepAliveTimer = setInterval(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (window.speechSynthesis.speaking) {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        } else {
          this.stopKeepAlive();
        }
      }
    }, 3000);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  public isSpeaking(): boolean {
    if (this.isProcessingQueue || this.activeUtterances.length > 0) return true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return window.speechSynthesis.speaking;
    }
    return false;
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

      const textChunks = this.chunkText(item.text);

      if (textChunks.length === 0) {
        this.isProcessingQueue = false;
        item.options?.onEnd?.();
        this.processQueue();
        return;
      }

      // Create SpeechSynthesisUtterance for each chunk
      const utterances: SpeechSynthesisUtterance[] = textChunks.map((chunkText) => {
        const utt = new SpeechSynthesisUtterance(chunkText);
        utt.rate = config.rate;
        utt.pitch = config.pitch;
        utt.volume = config.volume;
        if (targetVoice) {
          utt.voice = targetVoice;
        }
        return utt;
      });

      // Retain hard references to prevent garbage collection mid-utterance
      this.activeUtterances = utterances;
      (window as any).__activeSpeechUtterances = utterances;

      let currentChunkIndex = 0;
      let hasStarted = false;

      this.startKeepAlive();

      const playNextChunk = () => {
        if (currentChunkIndex >= utterances.length) {
          this.stopKeepAlive();
          this.activeUtterances = [];
          this.activeUtterance = null;
          (window as any).__activeSpeechUtterances = [];
          this.isProcessingQueue = false;
          item.options?.onEnd?.();

          setTimeout(() => {
            this.processQueue();
          }, 30);
          return;
        }

        const currentUtt = utterances[currentChunkIndex];
        this.activeUtterance = currentUtt;

        currentUtt.onstart = () => {
          if (!hasStarted) {
            hasStarted = true;
            item.options?.onStart?.();
          }
        };

        currentUtt.onend = () => {
          currentChunkIndex++;
          // 50ms async gap prevents Chromium/WebKit from dropping subsequent utterances
          setTimeout(() => {
            playNextChunk();
          }, 50);
        };

        currentUtt.onerror = (err) => {
          console.warn('[VoiceManager] Speech utterance error:', err);
          currentChunkIndex++;
          setTimeout(() => {
            if (currentChunkIndex >= utterances.length) {
              this.stopKeepAlive();
              this.activeUtterances = [];
              this.activeUtterance = null;
              (window as any).__activeSpeechUtterances = [];
              this.isProcessingQueue = false;
              item.options?.onError?.(err);
              setTimeout(() => this.processQueue(), 30);
            } else {
              playNextChunk();
            }
          }, 50);
        };

        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        window.speechSynthesis.speak(currentUtt);
      };

      playNextChunk();
    } catch (err) {
      console.error('[VoiceManager] Failed to process queue item:', err);
      this.stopKeepAlive();
      this.isProcessingQueue = false;
      this.activeUtterances = [];
      this.activeUtterance = null;
      (window as any).__activeSpeechUtterances = [];
      item.options?.onError?.(err);
      this.processQueue();
    }
  }

  /**
   * Speaks with an evil/sinister sounding voice for anti-language warning.
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
