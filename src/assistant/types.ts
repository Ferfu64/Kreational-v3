export type MicPermissionStatus = 'unrequested' | 'granted' | 'denied' | 'unsupported';

export type AssistantEngineState = 'disabled' | 'idle' | 'listening' | 'speaking' | 'error';

export interface AssistantSettings {
  enabled: boolean;
  autoListen: boolean;
  voiceVolume: number;
  voiceRate: number;
  voicePitch: number;
}

export const DEFAULT_ASSISTANT_SETTINGS: AssistantSettings = {
  enabled: false,
  autoListen: false,
  voiceVolume: 1.0,
  voiceRate: 1.0,
  voicePitch: 1.0,
};

export interface ChalkboardEntry {
  id: string;
  question: string;
  answer: string;
  timestamp: number;
}

export interface AssistantState {
  isEnabled: boolean;
  micStatus: MicPermissionStatus;
  engineState: AssistantEngineState;
  transcript: string;
  lastSpokenText: string;
  error: string | null;
  isSpeechRecognitionSupported: boolean;
  isSpeechSynthesisSupported: boolean;
}
