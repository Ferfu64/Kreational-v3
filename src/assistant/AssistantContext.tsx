import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Game, Tier, User } from '../types';
import { AlertTriangle, Moon, Zap } from 'lucide-react';
import {
  AssistantEngineState,
  MicPermissionStatus,
  AssistantState,
  ChalkboardEntry,
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
import { processBoardQuery } from './boardEngine';
import { safeGet, safeSet, safeRemove } from '../utils/persistentStorage';
import { VoiceManager } from './VoiceManager';

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
  executeCommand: (text: string) => Promise<CommandProcessResult>;
  lastCommandResponse: string | null;
  // Custom Sleep & Wake Word Settings
  sleepWord: string;
  setSleepWord: (word: string) => void;
  wakeWord: string;
  setWakeWord: (word: string) => void;
  isSleeping: boolean;
  setIsSleeping: (sleeping: boolean) => void;
  isSwearOverlayActive: boolean;
  // Board Mode (Non-Kreational questions vs Arcade game controls)
  isBoardMode: boolean;
  setIsBoardMode: (open: boolean) => void;
  toggleBoardMode: () => void;
  boardEntries: ChalkboardEntry[];
  addBoardEntry: (question: string, answer: string) => void;
  clearBoardEntries: () => void;
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
  onOpenMarketplace?: () => void;
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
  onOpenMarketplace,
  games = [],
  tiers = [],
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

  // Custom Sleep + Wake Word State derived directly from userSettings object or standalone fallback
  const getDerivedSleepWord = (): string => {
    try {
      const settingsStr = safeGet('kreational_user_settings');
      if (settingsStr) {
        const parsed = JSON.parse(settingsStr);
        if (parsed.assistantSleepWord) return parsed.assistantSleepWord;
      }
    } catch (e) {
      // ignore JSON parse error
    }
    return safeGet('kreational_assistant_sleep_word') || 'sleep';
  };

  const getDerivedWakeWord = (): string => {
    try {
      const settingsStr = safeGet('kreational_user_settings');
      if (settingsStr) {
        const parsed = JSON.parse(settingsStr);
        if (parsed.assistantWakeWord) return parsed.assistantWakeWord;
      }
    } catch (e) {
      // ignore JSON parse error
    }
    return safeGet('kreational_assistant_wake_word') || 'wake up';
  };

  const [sleepWord, setSleepWordState] = useState<string>(getDerivedSleepWord);
  const [wakeWord, setWakeWordState] = useState<string>(getDerivedWakeWord);
  const [isSleeping, setIsSleepingState] = useState<boolean>(false);
  const isSleepingRef = useRef<boolean>(isSleeping);

  const setIsSleeping = (sleeping: boolean) => {
    setIsSleepingState(sleeping);
    isSleepingRef.current = sleeping;
  };

  useEffect(() => {
    isSleepingRef.current = isSleeping;
  }, [isSleeping]);

  // Sync state if userSettings updates externally
  useEffect(() => {
    const handleStorageChange = () => {
      setSleepWordState(getDerivedSleepWord());
      setWakeWordState(getDerivedWakeWord());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Anti-language swear screen overlay
  const [isSwearOverlayActive, setIsSwearOverlayActive] = useState<boolean>(false);

  // Board Mode State (Non-Kreational queries enabled, Game launching disabled)
  const [isBoardMode, setIsBoardModeState] = useState<boolean>(() => {
    return safeGet('kreational_board_mode') === 'true';
  });
  const isBoardModeRef = useRef<boolean>(isBoardMode);

  useEffect(() => {
    isBoardModeRef.current = isBoardMode;
  }, [isBoardMode]);

  const setIsBoardMode = (open: boolean) => {
    setIsBoardModeState(open);
    isBoardModeRef.current = open;
    safeSet('kreational_board_mode', open ? 'true' : 'false');
  };

  const toggleBoardMode = () => {
    setIsBoardMode(!isBoardMode);
  };

  // Chalkboard Q&A Entries
  const [boardEntries, setBoardEntries] = useState<ChalkboardEntry[]>([]);

  const addBoardEntry = useCallback((question: string, answer: string) => {
    const newEntry: ChalkboardEntry = {
      id: 'chalk-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      question,
      answer,
      timestamp: Date.now(),
    };
    setBoardEntries((prev) => [newEntry, ...prev]);
  }, []);

  const clearBoardEntries = useCallback(() => {
    setBoardEntries([]);
  }, []);

  const setSleepWord = (word: string) => {
    const clean = word.trim() || 'sleep';
    setSleepWordState(clean);
    safeSet('kreational_assistant_sleep_word', clean);
  };

  const setWakeWord = (word: string) => {
    const clean = word.trim() || 'wake up';
    setWakeWordState(clean);
    safeSet('kreational_assistant_wake_word', clean);
  };

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
    if (!isEnabled || isSpeakingRef.current || VoiceManager.isSpeaking()) return;
    isManuallyStoppedRef.current = false;

    if (micStatus !== 'granted') {
      requestMicrophonePermission().then((status) => {
        setMicStatus(status);
        if (status === 'granted' && recognizerRef.current && !isSpeakingRef.current && !VoiceManager.isSpeaking()) {
          recognizerRef.current.start();
        }
      });
    } else if (recognizerRef.current && !isSpeakingRef.current && !VoiceManager.isSpeaking()) {
      recognizerRef.current.start();
    }
  }, [isEnabled, micStatus]);

  const speakText = useCallback(
    (text: string) => {
      if (!isSynthSupported || !synthesizerRef.current) {
        console.warn('[Kreational Assistant] Speech synthesis unavailable.');
        return;
      }
      if (autoRestartTimerRef.current) {
        clearTimeout(autoRestartTimerRef.current);
        autoRestartTimerRef.current = null;
      }
      setLastSpokenText(text);
      setEngineState('speaking');
      isSpeakingRef.current = true;

      // Temporarily pause recognition while assistant is speaking so it doesn't process its own voice
      try {
        recognizerRef.current?.stop();
      } catch (e) {
        // ignore
      }

      synthesizerRef.current.speak(text, {
        onStart: () => {
          setEngineState('speaking');
          isSpeakingRef.current = true;
        },
        onEnd: () => {
          isSpeakingRef.current = false;
          setEngineState((prev) => (prev === 'speaking' ? 'idle' : prev));
          if (isEnabled && !isManuallyStoppedRef.current) {
            setTimeout(() => {
              if (!isSpeakingRef.current && !VoiceManager.isSpeaking()) {
                startListening();
              }
            }, 250);
          }
        },
        onError: () => {
          isSpeakingRef.current = false;
          setEngineState('idle');
          if (isEnabled && !isManuallyStoppedRef.current) {
            setTimeout(() => {
              if (!isSpeakingRef.current && !VoiceManager.isSpeaking()) {
                startListening();
              }
            }, 250);
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
      const hasInteracted = safeGet('kreational_assistant_has_interacted');
      const username = user?.username || user?.displayName;

      let greeting = '';
      if (!hasInteracted) {
        greeting = "Welcome to Kreational. I'm your arcade assistant. Say 'What can you do?' to learn my commands.";
        try {
          safeSet('kreational_assistant_has_interacted', 'true');
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

  // Watchdog & Always-listening loop
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

  // Centralized command execution handler with Intent Classifier, Anti-Language, and Sleep/Wake logic
  const executeCommand = useCallback(
    async (inputSpeech: string): Promise<CommandProcessResult> => {
      const cleanInput = inputSpeech.trim();
      if (!cleanInput) {
        return {
          commandId: 'empty_input',
          matchedPhrase: '',
          responseText: '',
          success: false,
        };
      }

      // 1. ANTI-LANGUAGE FEATURE: Check for swear / profanity words
      const swearRegex = /\b(fuck|fucking|fucked|fucker|fuckin|shit|shitting|shitted|bitch|bitches|asshole|bastard|cunt|dick|pussy|whore|slut|damn|crap)\b/i;
      if (swearRegex.test(cleanInput)) {
        console.warn('[Kreational Assistant Anti-Language] Profanity detected:', cleanInput);
        setIsSwearOverlayActive(true);
        setTimeout(() => {
          setIsSwearOverlayActive(false);
        }, 5000);

        const warningMsg = 'Please do not swear';
        setLastCommandResponse(warningMsg);

        if (synthesizerRef.current) {
          isSpeakingRef.current = true;
          setEngineState('speaking');
          recognizerRef.current?.stop();

          synthesizerRef.current.speakEvil(warningMsg, {
            onEnd: () => {
              isSpeakingRef.current = false;
              setEngineState('idle');
              if (isEnabled && !isManuallyStoppedRef.current) startListening();
            },
            onError: () => {
              isSpeakingRef.current = false;
              setEngineState('idle');
              if (isEnabled && !isManuallyStoppedRef.current) startListening();
            },
          });
        }

        return {
          commandId: 'anti_language',
          matchedPhrase: cleanInput,
          responseText: warningMsg,
          success: false,
        };
      }

      // 2. SLEEP / WAKE WORD CHECK
      const normalizedInput = cleanInput.toLowerCase();
      const targetSleepWord = (sleepWord || 'sleep').toLowerCase();
      const targetWakeWord = (wakeWord || 'wake up').toLowerCase();

      if (isSleepingRef.current) {
        const isWakeIntent =
          normalizedInput === targetWakeWord ||
          normalizedInput === 'wake' ||
          normalizedInput === 'wake up' ||
          normalizedInput.includes('wake up') ||
          normalizedInput.includes('wake assistant') ||
          normalizedInput.includes('wake kreational') ||
          (targetWakeWord !== 'wake up' && normalizedInput.includes(targetWakeWord));

        if (isWakeIntent) {
          setIsSleeping(false);
          const wakeMsg = "I'm awake and listening.";
          setLastCommandResponse(wakeMsg);
          speakText(wakeMsg);
          return {
            commandId: 'wake_up',
            matchedPhrase: cleanInput,
            responseText: wakeMsg,
            success: true,
          };
        } else {
          console.log('[Kreational Assistant Asleep] Strictly ignored command while in sleep mode:', cleanInput);
          return {
            commandId: 'sleeping_ignored',
            matchedPhrase: cleanInput,
            responseText: '',
            success: false,
          };
        }
      } else {
        const isSleepIntent =
          normalizedInput === targetSleepWord ||
          normalizedInput === 'sleep' ||
          normalizedInput === 'go to sleep' ||
          normalizedInput === 'sleep mode' ||
          normalizedInput === 'enter sleep mode' ||
          normalizedInput.startsWith('sleep ') ||
          normalizedInput.endsWith(' sleep') ||
          normalizedInput.includes('go to sleep') ||
          normalizedInput.includes('sleep mode') ||
          (targetSleepWord !== 'sleep' && normalizedInput.includes(targetSleepWord));

        if (isSleepIntent) {
          setIsSleeping(true);
          const sleepMsg = `Going to sleep. Say '${wakeWord || 'wake up'}' to wake me up.`;
          setLastCommandResponse(sleepMsg);
          speakText(sleepMsg);
          return {
            commandId: 'go_to_sleep',
            matchedPhrase: cleanInput,
            responseText: sleepMsg,
            success: true,
          };
        }
      }

      // 3. BOARD MODE INTENTS (open board / close board)
      const isBoardOpenIntent = /^(?:open board|open the board|board mode|enable board|enable board mode|turn on board mode)$/i.test(normalizedInput);
      const isBoardCloseIntent = /^(?:close board|close the board|exit board|disable board|disable board mode|turn off board mode)$/i.test(normalizedInput);

      if (isBoardOpenIntent) {
        setIsBoardMode(true);
        const openMsg = 'Board mode is now open. Non-Kreational questions, math assistance, and jokes are enabled, and game commands are disabled. Say "close board" to exit.';
        setLastCommandResponse(openMsg);
        speakText(openMsg);
        return {
          commandId: 'open_board',
          matchedPhrase: cleanInput,
          responseText: openMsg,
          success: true,
        };
      }

      if (isBoardCloseIntent) {
        setIsBoardMode(false);
        const closeMsg = 'Board mode closed. Normal game commands and arcade controls are active again.';
        setLastCommandResponse(closeMsg);
        speakText(closeMsg);
        return {
          commandId: 'close_board',
          matchedPhrase: cleanInput,
          responseText: closeMsg,
          success: true,
        };
      }

      // 4. WHEN BOARD MODE IS ACTIVE
      if (isBoardModeRef.current) {
        // Clear / Erase board command
        if (/^(?:clear board|erase board|clean board|erase chalkboard|clear chalkboard|wipe board)$/i.test(normalizedInput)) {
          clearBoardEntries();
          const eraseMsg = 'Chalkboard erased.';
          setLastCommandResponse(eraseMsg);
          speakText(eraseMsg);
          return {
            commandId: 'clear_board',
            matchedPhrase: cleanInput,
            responseText: eraseMsg,
            success: true,
          };
        }

        // Check if input is attempting a game command or launching a game
        const isGameOpeningIntent =
          /^(?:open|play|launch|start|run|go to|pick|choose)\s+/i.test(normalizedInput) ||
          /^(?:random game|surprise me|pick something|play anything|choose a game|play a game|play another|something similar|open the previous game)$/i.test(normalizedInput) ||
          games.some((g) => g.title.toLowerCase() === normalizedInput || (normalizedInput.length > 2 && normalizedInput.includes(g.title.toLowerCase())));

        if (isGameOpeningIntent && !/^(?:go home|open settings|what can you do|help)$/i.test(normalizedInput)) {
          const disabledMsg = 'Game commands are disabled while Board mode is open. Say "close board" to return to normal arcade mode.';
          setLastCommandResponse(disabledMsg);
          speakText(disabledMsg);
          return {
            commandId: 'board_mode_game_disabled',
            matchedPhrase: cleanInput,
            responseText: disabledMsg,
            success: false,
          };
        }

        // Allow navigation commands in Board mode
        if (/^(?:go home|return home|main menu|take me home|back to arcade|home)$/i.test(normalizedInput)) {
          if (onNavigateHome) onNavigateHome();
          const navMsg = 'Returning home.';
          setLastCommandResponse(navMsg);
          speakText(navMsg);
          return { commandId: 'go_home', matchedPhrase: cleanInput, responseText: navMsg, success: true };
        }

        if (/^(?:open settings|show settings|view settings|settings)$/i.test(normalizedInput)) {
          if (onOpenSettings) onOpenSettings();
          const navMsg = 'Opening settings.';
          setLastCommandResponse(navMsg);
          speakText(navMsg);
          return { commandId: 'open_settings', matchedPhrase: cleanInput, responseText: navMsg, success: true };
        }

        if (/^(?:close|exit|quit|stop playing)(?:\s+game)?$/i.test(normalizedInput)) {
          if (onCloseCurrentGame) {
            const res = onCloseCurrentGame();
            const msg = res.success ? 'Closing game.' : (res.reason || 'Not in a game.');
            setLastCommandResponse(msg);
            speakText(msg);
            return { commandId: 'close_game', matchedPhrase: cleanInput, responseText: msg, success: res.success };
          }
        }

        // Process math calculations and jokes via local Board Engine (No external AI/Gemini needed)
        const answer = processBoardQuery(cleanInput);
        addBoardEntry(cleanInput, answer);
        setLastCommandResponse(answer);
        speakText(answer);
        return {
          commandId: 'board_mode_local_query',
          matchedPhrase: cleanInput,
          responseText: answer,
          success: true,
        };
      }

      // Action Context Setup
      const actionContext: CommandActionContext = {
        navigateHome: () => {
          if (onNavigateHome) onNavigateHome();
        },
        openSettings: () => {
          if (onOpenSettings) onOpenSettings();
        },
        openMarketplace: () => {
          if (onOpenMarketplace) onOpenMarketplace();
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

      // Support compound phrases in quick succession (e.g. "close it and open Laser Quest")
      const multiStepRegex = /\s+(?:and then|then|and)\s+/i;
      const isExactGameTitle = games.some((g) => g.title.toLowerCase() === cleanInput.toLowerCase());

      if (multiStepRegex.test(cleanInput) && !isExactGameTitle) {
        const parts = cleanInput.split(multiStepRegex).map((p) => p.trim()).filter(Boolean);
        if (parts.length > 1) {
          let lastRes: CommandProcessResult = {
            commandId: 'multi_step',
            matchedPhrase: cleanInput,
            responseText: '',
            success: true,
          };
          for (const part of parts) {
            lastRes = await executeCommand(part);
          }
          return lastRes;
        }
      }

      // 5. LIGHTWEIGHT NATURAL LANGUAGE INTENT CLASSIFIER FOR ARCADE MODE
      // Pre-processes natural language into canonical bot command terms
      let canonicalCommandString = cleanInput;

      // Local fast pattern classification
      if (/^(?:close|exit|quit|leave|stop playing|go back|shut this down|close modal)(?:\s+(?:it|this|that|current)?\s*game)?$/i.test(cleanInput)) {
        canonicalCommandString = 'close game';
      } else if (/^(?:random game|surprise me|pick something|play anything|choose a game|play a game)$/i.test(cleanInput)) {
        canonicalCommandString = 'random game';
      } else if (/^(?:go home|return home|main menu|take me home|back to arcade|home)$/i.test(cleanInput)) {
        canonicalCommandString = 'go home';
      } else if (/^(?:open settings|show settings|view settings|settings)$/i.test(cleanInput)) {
        canonicalCommandString = 'open settings';
      } else if (/^(?:what can you do|help|list commands|show commands)$/i.test(cleanInput)) {
        canonicalCommandString = 'what can you do';
      } else if (/^(?:thank you|thanks)$/i.test(cleanInput)) {
        canonicalCommandString = 'thank you';
      }

      // Run command processor on classified intent
      let result = processVoiceCommand(canonicalCommandString, actionContext);

      // AI Classifier Fallback: If local match failed, call Gemini Light AI decipher route
      if (!result.success || result.commandId === 'unknown_command' || result.commandId === 'open_game_not_found') {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1200);

          const aiResponse = await fetch('/api/assistant/decipher', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              transcript: cleanInput,
              availableGames: games,
              currentTier: ArcadeContextManager.getState().currentTier,
              currentlyPlayingGame,
            }),
          });
          clearTimeout(timeoutId);

          if (aiResponse.ok) {
            const deciphered = await aiResponse.json();
            if (
              deciphered.botCommand &&
              deciphered.botCommand !== 'unknown' &&
              deciphered.botCommand.toLowerCase() !== cleanInput.toLowerCase()
            ) {
              console.log('[Kreational Assistant Intent Classifier AI Output]', deciphered.botCommand);
              result = processVoiceCommand(deciphered.botCommand, actionContext);
            }
          }
        } catch (aiErr) {
          console.warn('[Kreational Assistant Intent Classifier] AI fallback timeout/error:', aiErr);
        }
      }

      // If Board mode is OFF, non-Kreational questions are disabled by default
      if (!result.success || result.commandId === 'unknown_command' || result.commandId === 'open_game_not_found') {
        const isNonKreationalPattern =
          /\b(math|calculate|add|subtract|multiply|divide|plus|minus|times|divided|square root|equation|solve|joke|jokes|tell me a joke|funny|riddle|story|poem|what is|who is|where is|why is|how do|explain)\b/i.test(cleanInput) ||
          /\d+\s*[\+\-\*\/\^]\s*\d+/.test(cleanInput);

        if (isNonKreationalPattern) {
          const nonKreationalMsg = 'Non-Kreational questions are disabled by default. Say "open board" to enable board mode for math, jokes, and general questions.';
          setLastCommandResponse(nonKreationalMsg);
          speakText(nonKreationalMsg);
          return {
            commandId: 'non_kreational_disabled',
            matchedPhrase: cleanInput,
            responseText: nonKreationalMsg,
            success: false,
          };
        }
      }

      setLastCommandResponse(result.responseText);

      // Spoken response using speech synthesis
      if (result.responseText) {
        speakText(result.responseText);
      }

      return result;
    },
    [
      onNavigateHome,
      onOpenSettings,
      speakText,
      startListening,
      isEnabled,
      games,
      tiers,
      currentlyPlayingGame,
      onOpenGameByName,
      onOpenRandomGame,
      onCloseCurrentGame,
      onShowTier,
      user,
      enablePersonalizedGreetings,
      sleepWord,
      wakeWord,
      isSleeping,
      isBoardMode,
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

    const currentMicStatus = await requestMic();

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
        sleepWord,
        setSleepWord,
        wakeWord,
        setWakeWord,
        isSleeping,
        setIsSleeping,
        isSwearOverlayActive,
        isBoardMode,
        setIsBoardMode,
        toggleBoardMode,
        boardEntries,
        addBoardEntry,
        clearBoardEntries,
      }}
    >
      {/* 5-Second Full-Screen Red Overlay Banner for Anti-Language Swear Warning */}
      {isSwearOverlayActive && (
        <div id="anti-language-overlay" className="fixed inset-0 z-[99999] bg-red-600/95 backdrop-blur-md flex flex-col items-center justify-center text-white text-center p-6 animate-pulse select-none">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-black/40 border-4 border-red-300 flex items-center justify-center mb-5 shadow-2xl shadow-red-950">
            <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-red-100" />
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black font-mono tracking-widest text-red-100 uppercase mb-3">
            PLEASE DO NOT SWEAR
          </h1>
          <p className="text-xs sm:text-sm font-mono text-red-200 max-w-md">
            Profanity detected in voice input. Please keep the language clean and appropriate.
          </p>
        </div>
      )}

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

