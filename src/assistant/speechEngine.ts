import { MicPermissionStatus } from './types';

// Declare types for Web Speech Recognition API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

/**
 * Request microphone permission using getUserMedia only when explicitly requested.
 */
export async function requestMicrophonePermission(): Promise<MicPermissionStatus> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return 'unsupported';
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop tracks immediately so mic isn't left open unexpectedly
    stream.getTracks().forEach((track) => track.stop());
    return 'granted';
  } catch (err: any) {
    console.warn('[Kreational Assistant] Microphone permission error or denied:', err);
    if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
      return 'denied';
    }
    return 'unsupported';
  }
}

/**
 * Check existing microphone permission status if supported
 */
export async function checkMicrophonePermission(): Promise<MicPermissionStatus> {
  if (typeof navigator === 'undefined') return 'unsupported';

  if (navigator.permissions && navigator.permissions.query) {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (permissionStatus.state === 'granted') return 'granted';
      if (permissionStatus.state === 'denied') return 'denied';
      return 'unrequested';
    } catch (e) {
      // Firefox or certain browsers don't support 'microphone' permission name in query
    }
  }

  return 'unrequested';
}

/**
 * Class wrapper for Speech Synthesis
 */
import { VoiceManager } from './VoiceManager';

export class AssistantSpeechSynthesizer {
  public speak(
    text: string,
    options?: {
      volume?: number;
      rate?: number;
      pitch?: number;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ): void {
    VoiceManager.speak(text, {
      configOverride: {
        ...(options?.volume !== undefined ? { volume: options.volume } : {}),
        ...(options?.rate !== undefined ? { rate: options.rate } : {}),
        ...(options?.pitch !== undefined ? { pitch: options.pitch } : {}),
      },
      onStart: options?.onStart,
      onEnd: options?.onEnd,
      onError: options?.onError,
    });
  }

  public stop(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

/**
 * Class wrapper for Speech Recognition
 */
export class AssistantSpeechRecognizer {
  private recognition: any = null;
  private isListening: boolean = false;

  constructor(
    onResult: (transcript: string, isFinal: boolean) => void,
    onStatusChange: (isListening: boolean) => void,
    onError: (error: string) => void
  ) {
    if (!isSpeechRecognitionSupported()) return;

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionClass();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      onStatusChange(true);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      onStatusChange(false);
    };

    this.recognition.onerror = (event: any) => {
      console.warn('[Kreational Assistant] Speech recognition error:', event.error);
      this.isListening = false;
      onStatusChange(false);

      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        onError(`Speech recognition error: ${event.error}`);
      }
    };

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptItem = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptItem;
        } else {
          interimTranscript += transcriptItem;
        }
      }

      const currentText = finalTranscript || interimTranscript;
      if (currentText.trim()) {
        onResult(currentText, !!finalTranscript);
      }
    };
  }

  public start(): boolean {
    if (!this.recognition || this.isListening) return false;
    try {
      this.recognition.start();
      return true;
    } catch (e: any) {
      if (e?.name !== 'InvalidStateError') {
        console.warn('[Kreational Assistant] Recognition start failed:', e);
      }
      return false;
    }
  }

  public stop(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.warn('[Kreational Assistant] Recognition stop failed:', e);
      }
    }
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}
