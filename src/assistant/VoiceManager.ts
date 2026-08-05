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
  Kreational: 'Creation - al',
  kreational: 'creation - al',
  Kreator: 'Creator',
  kreator: 'creator',
};

const STORAGE_KEY_VOICE = 'kreational_assistant_voice_uri';
const STORAGE_KEY_RATE = 'kreational_assistant_voice_rate';
const STORAGE_KEY_PITCH = 'kreational_assistant_voice_pitch';
const STORAGE_KEY_VOLUME = 'kreational_assistant_voice_volume';

class VoiceManagerClass {
  private voices: SpeechSynthesisVoice[] = [];
  private listeners: Set<() => void> = new Set();

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

    // Quality keywords for premium/natural English speech engines
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

    // Default English voice fallback
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
   * Synthesizes speech using current or overridden voice settings & phonetic replacements.
   */
  public speak(
    text: string,
    options?: {
      configOverride?: Partial<VoiceConfig>;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      options?.onEnd?.();
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const config = { ...this.getConfig(), ...options?.configOverride };
      const phoneticText = this.applyPhonetics(text);

      const utterance = new SpeechSynthesisUtterance(phoneticText);
      utterance.rate = config.rate;
      utterance.pitch = config.pitch;
      utterance.volume = config.volume;

      const allVoices = this.getVoices();
      let targetVoice: SpeechSynthesisVoice | null = null;

      if (config.voiceURI) {
        targetVoice = allVoices.find((v) => v.voiceURI === config.voiceURI || v.name === config.voiceURI) || null;
      }

      if (!targetVoice) {
        targetVoice = this.getBestEnglishVoice(allVoices);
      }

      if (targetVoice) {
        utterance.voice = targetVoice;
      }

      utterance.onstart = () => options?.onStart?.();
      utterance.onend = () => options?.onEnd?.();
      utterance.onerror = (e) => {
        console.warn('[VoiceManager] Speech error:', e);
        options?.onError?.(e);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('[VoiceManager] Failed to speak:', err);
      options?.onError?.(err);
    }
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
    });
  }
}

export const VoiceManager = new VoiceManagerClass();
