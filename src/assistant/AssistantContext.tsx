import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Game, Tier, User } from '../types';
import {
  AssistantEngineState,
  MicPermissionStatus,
  AssistantState,
} from './types';
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  requestMicrophonePermission,
  checkMicrophonePermission,
  AssistantSpeechSynthesizer,
  AssistantSpeechRecognizer,
} from './speechEngine';
import { processVoiceCommand } from './commands/commandProcessor';
import { CommandProcessResult, CommandActionContext, CommandActionResult } from './commands/types';
import { ArcadeContextManager } from './ArcadeContextManager';

interface AssistantContextType extends AssistantState {
  isControlsOpen: boolean;
  setIsControlsOpen: (open: boolean) => void;
  toggleControls: () => void;
  enableAssistant: () => Promise<void>;
  disableAssistant: () => void;
  toggleAssistant: (targetState?: boolean) => Promise<void>;
  requestMic: () => Promise<MicPermissionStatus>;
  startListening: () => void;
  stopListening: () => void;
  speakText: (text: string) => void;
  stopSpeaking: () => void;
  clearTranscript: () => void;
  executeCommand: (text: string) => CommandProcessResult;
  lastCommandResponse: string | null;
}

const AssistantContext = createContext<AssistantContextType | null>(null);

export interface AssistantProviderProps {
  children: React.ReactNode;
  enabledInSettings: boolean;
  user?: User | null;
  enablePersonalizedGreetings?: boolean;
  onUpdateSettingsEnabled?: (enabled: boolean) => void;
  onNavigateHome?: () => void;
  onOpenSettings?: () => void;
  // Arcade System Integrations
  games?: Game[];
  tiers?: Tier[];
  currentlyPlayingGame?: Game | null;
  onOpenGameByName?: (gameName: string) => CommandActionResult;
  onOpenRandomGame?: () => CommandActionResult;
  onCloseCurrentGame?: () => CommandActionResult;
  onShowTier?: (tierTarget: string | number) => CommandActionResult;
}

export const AssistantProvider: React.FC<AssistantProviderProps> = ({
  children,
  enabledInSettings,
  user,
  enablePersonalizedGreetings = true,
  onUpdateSettingsEnabled,
  onNavigateHome,
  onOpenSettings,
  games,
  tiers,
  currentlyPlayingGame,
  onOpenGameByName,
  onOpenRandomGame,
  onCloseCurrentGame,
  onShowTier,
}) => {
  const [isEnabled, setIsEnabled] = useState<boolean>(enabledInSettings);
  const [micStatus, setMicStatus] = useState<MicPermissionStatus>('unrequested');
  const [engineState, setEngineState] = useState<AssistantEngineState>('disabled');
  const [transcript, setTranscript] = useState<string>('');
  const [lastSpokenText, setLastSpokenText] = useState<string>('');
  const [lastCommandResponse, setLastCommandResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isControlsOpen, setIsControlsOpen] = useState<boolean>(false);

  const isRecSupported = isSpeechRecognitionSupported();
  const isSynthSupported = isSpeechSynthesisSupported();

  const synthesizerRef = useRef<AssistantSpeechSynthesizer | null>(null);
  const recognizerRef = useRef<AssistantSpeechRecognizer | null>(null);
  const isManuallyStoppedRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const autoRestartTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasWelcomedRef = useRef<boolean>(false);

  // Initialize Speech Synthesizer
  useEffect(() => {
    synthesizerRef.current = new AssistantSpeechSynthesizer();
    return () => {
      synthesizerRef.current?.stop();
      if (autoRestartTimerRef.current) clearTimeout(autoRestartTimerRef.current);
    };
  }, []);

  // Keep ArcadeContextManager state synchronized with active props
  useEffect(() => {
    if (games && games.length > 0) {
      ArcadeContextManager.setGames(games);
    }
  }, [games]);

  useEffect(() => {
    ArcadeContextManager.setCurrentlyPlayingGame(currentlyPlayingGame || null);
  }, [currentlyPlayingGame]);

  // Check initial microphone status silently (without prompting user)
  useEffect(() => {
    checkMicrophonePermission().then((status) => {
      setMicStatus(status);
    });
  }, []);

  // Sync state when enabledInSettings changes from parent settings
  useEffect(() => {
    if (enabledInSettings !== isEnabled) {
      if (enabledInSettings) {
        handleEnable();
      } else {
        handleDisable();
      }
    }
  }, [enabledInSettings]);

  const startListening = useCallback(() => {
    if (!isEnabled) return;
    isManuallyStoppedRef.current = false;

    if (micStatus !== 'granted') {
      requestMicrophonePermission().then((status) => {
        setMicStatus(status);
        if (status === 'granted' && recognizerRef.current) {
          recognizerRef.current.start();
        }
      });
    } else if (recognizerRef.current) {
      recognizerRef.current.start();
    }
  }, [isEnabled, micStatus]);

  const speakText = useCallback(
    (text: string) => {
      if (!isSynthSupported || !synthesizerRef.current) {
        console.warn('[Kreational Assistant] Speech synthesis unavailable.');
        return;
      }
      setLastSpokenText(text);
      setEngineState('speaking');
      isSpeakingRef.current = true;

      // Temporarily pause recognition while assistant is speaking so it doesn't process its own voice
      recognizerRef.current?.stop();

      synthesizerRef.current.speak(text, {
        onStart: () => {
          setEngineState('speaking');
          isSpeakingRef.current = true;
        },
        onEnd: () => {
          isSpeakingRef.current = false;
          setEngineState((prev) => (prev === 'speaking' ? 'idle' : prev));
          // Always resume listening after speech completes if enabled
          if (isEnabled && !isManuallyStoppedRef.current) {
            startListening();
          }
        },
        onError: () => {
          isSpeakingRef.current = false;
          setEngineState('idle');
          if (isEnabled && !isManuallyStoppedRef.current) {
            startListening();
          }
        },
      });
    },
    [isSynthSupported, isEnabled, startListening]
  );

  // Automatic Welcome Greeting on entering arcade
  useEffect(() => {
    if (isEnabled && micStatus === 'granted' && !hasWelcomedRef.current) {
      hasWelcomedRef.current = true;
      const hasInteracted = localStorage.getItem('kreational_assistant_has_interacted');
      const username = user?.username || user?.displayName;

      let greeting = '';
      if (!hasInteracted) {
        greeting = "Welcome to Kreational. I'm your arcade assistant. Say 'What can you do?' to learn my commands.";
        try {
          localStorage.setItem('kreational_assistant_has_interacted', 'true');
        } catch (e) {
          console.warn('Failed to record assistant interaction:', e);
        }
      } else if (enablePersonalizedGreetings !== false && username) {
        greeting = `Welcome back, ${username}. What would you like to play today?`;
      } else {
        greeting = 'Welcome to Kreational Arcade. What would you like to play today?';
      }

      setTimeout(() => {
        speakText(greeting);
      }, 500);
    }
  }, [isEnabled, micStatus, user, enablePersonalizedGreetings, speakText]);

  // Watchdog & Always-listening loop: Keeps recognition active in background continuously
  useEffect(() => {
    if (!isEnabled) return;

    const watchdog = setInterval(() => {
      if (
        isEnabled &&
        micStatus === 'granted' &&
        !isSpeakingRef.current &&
        !isManuallyStoppedRef.current &&
        recognizerRef.current &&
        !recognizerRef.current.getIsListening()
      ) {
        recognizerRef.current.start();
      }
    }, 2000);

    return () => clearInterval(watchdog);
  }, [isEnabled, micStatus]);

  // Centralized command execution handler
  const executeCommand = useCallback(
    (inputSpeech: string): CommandProcessResult => {
      const actionContext: CommandActionContext = {
        navigateHome: () => {
          if (onNavigateHome) onNavigateHome();
        },
        openSettings: () => {
          if (onOpenSettings) onOpenSettings();
        },
        openAssistantControls: () => {
          setIsControlsOpen(true);
        },
        speak: (text: string) => {
          speakText(text);
        },
        games,
        tiers,
        currentlyPlayingGame,
        openGameByName: onOpenGameByName,
        openRandomGame: onOpenRandomGame,
        closeCurrentGame: onCloseCurrentGame,
        showTier: onShowTier,
        username: user?.username || user?.displayName,
        enablePersonalizedGreetings,
      };

      const result = processVoiceCommand(inputSpeech, actionContext);
      setLastCommandResponse(result.responseText);

      // Every command (successful or unknown) receives a spoken response using speech synthesis
      if (result.responseText) {
        speakText(result.responseText);
      }

      return result;
    },
    [
      onNavigateHome,
      onOpenSettings,
      speakText,
      games,
      tiers,
      currentlyPlayingGame,
      onOpenGameByName,
      onOpenRandomGame,
      onCloseCurrentGame,
      onShowTier,
      user,
      enablePersonalizedGreetings,
    ]
  );

  // Handle Speech Recognition Callback
  const handleSpeechResult = useCallback(
    (text: string, isFinal: boolean) => {
      setTranscript(text);
      if (isFinal && text.trim()) {
        console.log('[Kreational Assistant] Final speech recognized:', text);
        executeCommand(text);
      }
    },
    [executeCommand]
  );

  const handleListeningStatusChange = useCallback(
    (isListeningNow: boolean) => {
      setEngineState((prev) => {
        if (prev === 'speaking') return 'speaking';
        return isListeningNow ? 'listening' : 'idle';
      });

      // ALWAYS-ON LISTENER: If speech recognition ended automatically (silence/browser reset),
      // and assistant is enabled, not manually stopped, and not speaking, auto-restart listening!
      if (!isListeningNow && isEnabled && !isManuallyStoppedRef.current && !isSpeakingRef.current) {
        if (autoRestartTimerRef.current) clearTimeout(autoRestartTimerRef.current);
        autoRestartTimerRef.current = setTimeout(() => {
          if (isEnabled && !isManuallyStoppedRef.current && !isSpeakingRef.current && recognizerRef.current) {
            recognizerRef.current.start();
          }
        }, 300);
      }
    },
    [isEnabled]
  );

  const handleSpeechError = useCallback((errMessage: string) => {
    setError(errMessage);
    setEngineState('error');
    setTimeout(() => {
      setError((current) => (current === errMessage ? null : current));
      setEngineState('idle');
    }, 4000);
  }, []);

  // Setup Recognizer instance when enabled
  useEffect(() => {
    if (isEnabled && isRecSupported && !recognizerRef.current) {
      recognizerRef.current = new AssistantSpeechRecognizer(
        handleSpeechResult,
        handleListeningStatusChange,
        handleSpeechError
      );
      if (micStatus === 'granted' && !isManuallyStoppedRef.current) {
        recognizerRef.current.start();
      }
    }

    if (!isEnabled && recognizerRef.current) {
      recognizerRef.current.stop();
      recognizerRef.current = null;
    }
  }, [isEnabled, isRecSupported, micStatus, handleSpeechResult, handleListeningStatusChange, handleSpeechError]);

  // Request Mic Permission only when requested/enabled
  const requestMic = async (): Promise<MicPermissionStatus> => {
    const status = await requestMicrophonePermission();
    setMicStatus(status);
    if (status === 'denied') {
      setError('Microphone permission denied. Enable mic access in browser settings.');
    } else {
      setError(null);
    }
    return status;
  };

  const stopSpeaking = useCallback(() => {
    synthesizerRef.current?.stop();
    isSpeakingRef.current = false;
    setEngineState('idle');
  }, []);

  const stopListening = useCallback(() => {
    isManuallyStoppedRef.current = true;
    if (recognizerRef.current) {
      recognizerRef.current.stop();
    }
    setEngineState('idle');
  }, []);

  const handleEnable = async () => {
    setIsEnabled(true);
    isManuallyStoppedRef.current = false;
    setEngineState('idle');
    onUpdateSettingsEnabled?.(true);

    // Prompt for microphone permission when user enables the assistant
    const currentMicStatus = await requestMic();

    // Voice announcement for activation framework & auto-start listening
    if (isSynthSupported && currentMicStatus === 'granted') {
      speakText('Kreational Assistant activated. Command system online.');
    } else if (currentMicStatus === 'granted') {
      startListening();
    }
  };

  const handleDisable = () => {
    setIsEnabled(false);
    isManuallyStoppedRef.current = true;
    setEngineState('disabled');
    stopSpeaking();
    stopListening();
    onUpdateSettingsEnabled?.(false);
  };

  const toggleAssistant = async (targetState?: boolean) => {
    const nextState = targetState ?? !isEnabled;
    if (nextState) {
      await handleEnable();
    } else {
      handleDisable();
    }
  };

  const toggleControls = () => {
    setIsControlsOpen((prev) => !prev);
  };

  const clearTranscript = () => {
    setTranscript('');
    setLastCommandResponse(null);
  };

  return (
    <AssistantContext.Provider
      value={{
        isEnabled,
        micStatus,
        engineState,
        transcript,
        lastSpokenText,
        lastCommandResponse,
        error,
        isSpeechRecognitionSupported: isRecSupported,
        isSpeechSynthesisSupported: isSynthSupported,
        isControlsOpen,
        setIsControlsOpen,
        toggleControls,
        enableAssistant: handleEnable,
        disableAssistant: handleDisable,
        toggleAssistant,
        requestMic,
        startListening,
        stopListening,
        speakText,
        stopSpeaking,
        clearTranscript,
        executeCommand,
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
};

export const useAssistant = () => {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
};

