import { CommandActionContext, CommandProcessResult, VoiceCommandDefinition } from './types';
import { VOICE_COMMANDS } from './commandDefinitions';
import { ArcadeContextManager } from '../ArcadeContextManager';

/**
 * Normalizes input speech string by lowercasing and removing standard punctuation.
 */
export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips polite openers, filler words, and conversational fluff.
 */
export function stripFillers(text: string): string {
  let cleaned = text
    .replace(
      /^(?:please|can you|could you|would you|would you please|can you please|could you please|i want to|i would like to|i wanna|kindly|hey assistant|hey kreational|assistant|kreational)\s+/i,
      ''
    )
    .replace(/\s+(?:please|thank you|thanks)$/i, '')
    .trim();
  return cleaned;
}

/**
 * Helper to produce structured console debugging logs for Kreational Assistant actions.
 */
function logDebug(data: {
  recognizedCommand: string;
  detectedIntent: string;
  isGameActive?: boolean;
  gameFound?: boolean | string;
  closeActionExecuted?: boolean;
  confidence?: number;
  [key: string]: any;
}) {
  console.log('[Kreational Assistant Debug]', data);
}

/**
 * Intent-Based Voice Command Processor with Conversational Context Awareness
 */
export function processVoiceCommand(
  rawTranscript: string,
  context: CommandActionContext,
  customCommands: VoiceCommandDefinition[] = VOICE_COMMANDS
): CommandProcessResult {
  const normalized = normalizeSpeech(rawTranscript);

  if (!normalized) {
    return {
      commandId: null,
      matchedPhrase: null,
      responseText: "I didn't hear any speech input.",
      success: false,
    };
  }

  const cleaned = stripFillers(normalized);
  const name = context.enablePersonalizedGreetings !== false && context.username ? context.username : null;
  const ctxState = ArcadeContextManager.getState();

  // 1. Intent: Polite / Thanks
  const thanksPhrases = [
    'thank you',
    'thanks',
    'thanks kreational',
    'thank you kreational',
    'thank you assistant',
    'thanks assistant',
  ];
  if (thanksPhrases.includes(cleaned) || thanksPhrases.includes(normalized)) {
    logDebug({
      recognizedCommand: rawTranscript,
      detectedIntent: 'thank_you',
      confidence: 1,
    });
    ArcadeContextManager.setLastVoiceCommand('thank_you');
    const responseText = name ? `You're welcome, ${name}.` : "You're welcome.";
    return {
      commandId: 'thank_you',
      matchedPhrase: rawTranscript,
      responseText,
      success: true,
    };
  }

  // 2. Intent: Close Game ("Close it", "Close this", "Close that", "Close game")
  const closeAliases = [
    'close it',
    'close this',
    'close that',
    'exit this',
    'stop this',
    'close this game',
    'exit game',
    'quit game',
    'leave game',
    'stop playing',
    'go back',
    'quit',
    'exit',
    'close game',
    'close',
    'close current game',
    'exit current game',
    'stop game',
    'leave',
  ];
  const isCloseIntent =
    closeAliases.includes(cleaned) ||
    closeAliases.includes(normalized) ||
    /^(?:close|exit|quit|leave|stop playing|go back)(?:\s+(?:it|this|that|current)?\s*game)?$/i.test(cleaned);

  if (isCloseIntent) {
    const hasModalInDOM =
      typeof document !== 'undefined' &&
      Boolean(document.getElementById('game-modal-overlay') || document.getElementById('game-modal-close-button'));

    const isGameActiveState = Boolean(context.currentlyPlayingGame || ctxState.currentlyOpenGame);
    const isGameActive = isGameActiveState || hasModalInDOM;

    console.log(
      '[Kreational Assistant Game State Check] isInGame state:',
      isGameActiveState,
      '| DOM modal visible:',
      hasModalInDOM,
      '| Matches:',
      isGameActiveState === hasModalInDOM
    );

    if (!isGameActive) {
      logDebug({
        recognizedCommand: rawTranscript,
        detectedIntent: 'close_game',
        isGameActive: false,
        confidence: 1,
      });
      return {
        commandId: 'close_game_not_open',
        matchedPhrase: rawTranscript,
        responseText: "There isn't a game open right now.",
        success: false,
      };
    }

    let res = context.closeCurrentGame
      ? context.closeCurrentGame()
      : { success: false, reason: 'Request failed. You are currently not in a game.' };

    // Extra fail-safe: Click X button directly if present in DOM
    if (typeof document !== 'undefined') {
      const closeBtn = document.getElementById('game-modal-close-button') as HTMLButtonElement | null;
      if (closeBtn) {
        closeBtn.click();
        res = { success: true, gameName: 'Current Game' };
      }
    }

    ArcadeContextManager.setCurrentlyPlayingGame(null);
    ArcadeContextManager.setLastVoiceCommand('close_game');

    logDebug({
      recognizedCommand: rawTranscript,
      detectedIntent: 'close_game',
      isGameActive,
      closeActionExecuted: res.success,
      confidence: 1,
    });

    let responseText = '';
    if (res.success) {
      responseText = name ? `Sure, ${name}. Closing game.` : 'Closing game.';
    } else {
      responseText = "There isn't a game open right now.";
    }

    return {
      commandId: 'close_game',
      matchedPhrase: rawTranscript,
      responseText,
      success: res.success,
    };
  }

  // 3. Intent: Play Another One ("Play another one", "Play another", "Recommend another", "Open something different")
  const playAnotherAliases = [
    'play another one',
    'play another',
    'open another one',
    'open another',
    'recommend another',
    'open something different',
    'another one',
    'another game',
    'play another game',
    'open another game',
    'recommend another game',
    'something different',
  ];
  const isPlayAnotherIntent =
    playAnotherAliases.includes(cleaned) ||
    playAnotherAliases.includes(normalized) ||
    /^(?:play|open|recommend|launch|start)\s+(?:another\s+one|another|something\s+different)$/i.test(cleaned);

  if (isPlayAnotherIntent) {
    const anotherGame = ArcadeContextManager.findAnotherGame();

    if (anotherGame && context.openGameByName) {
      const res = context.openGameByName(anotherGame.title);
      if (res.success) {
        ArcadeContextManager.setCurrentlyPlayingGame(anotherGame);
        ArcadeContextManager.setLastVoiceCommand('play_another');

        logDebug({
          recognizedCommand: rawTranscript,
          detectedIntent: 'play_another',
          gameFound: anotherGame.title,
          confidence: 1,
        });

        return {
          commandId: 'play_another',
          matchedPhrase: rawTranscript,
          responseText: "Here's another one you might enjoy.",
          success: true,
        };
      }
    }

    // Fallback if missing context or no specific game found
    if (context.openRandomGame) {
      const res = context.openRandomGame();
      if (res.success && res.gameName) {
        ArcadeContextManager.setLastVoiceCommand('play_another');
        return {
          commandId: 'play_another',
          matchedPhrase: rawTranscript,
          responseText: "Here's another one you might enjoy.",
          success: true,
        };
      }
    }

    return {
      commandId: 'play_another_missing_context',
      matchedPhrase: rawTranscript,
      responseText: 'Which game are you referring to?',
      success: false,
    };
  }

  // 4. Intent: Something Similar ("Something similar", "Show more like this", "Similar game")
  const similarAliases = [
    'something similar',
    'show more like this',
    'similar game',
    'play something similar',
    'open similar game',
    'recommend something similar',
    'find similar game',
    'more like this',
    'something similar to this',
  ];
  const isSimilarIntent =
    similarAliases.includes(cleaned) ||
    similarAliases.includes(normalized) ||
    /^(?:play|open|show|find|recommend)\s+(?:something\s+similar|more\s+like\s+this|similar\s+game)$/i.test(cleaned);

  if (isSimilarIntent) {
    const hasReference = Boolean(ctxState.currentlyOpenGame || ctxState.previouslyPlayedGame);

    if (!hasReference) {
      return {
        commandId: 'similar_missing_context',
        matchedPhrase: rawTranscript,
        responseText: 'Which game are you referring to?',
        success: false,
      };
    }

    const similarGame = ArcadeContextManager.findSimilarGame();
    if (similarGame && context.openGameByName) {
      const res = context.openGameByName(similarGame.title);
      if (res.success) {
        ArcadeContextManager.setCurrentlyPlayingGame(similarGame);
        ArcadeContextManager.setLastVoiceCommand('something_similar');

        logDebug({
          recognizedCommand: rawTranscript,
          detectedIntent: 'something_similar',
          gameFound: similarGame.title,
          confidence: 1,
        });

        return {
          commandId: 'something_similar',
          matchedPhrase: rawTranscript,
          responseText: 'I found another game similar to this.',
          success: true,
        };
      }
    }

    return {
      commandId: 'similar_missing_context',
      matchedPhrase: rawTranscript,
      responseText: 'Which game are you referring to?',
      success: false,
    };
  }

  // 5. Intent: Open Previous Game ("Open the previous game", "Go back to the last game", "Actually open the previous one")
  const previousAliases = [
    'open the previous game',
    'go back to the last game',
    'open previous game',
    'reopen last game',
    'actually open the previous one',
    'open the last one',
    'previous game',
    'last game',
    'open previous',
    'reopen previous game',
    'open the previous one',
  ];
  const isPreviousIntent =
    previousAliases.includes(cleaned) ||
    previousAliases.includes(normalized) ||
    /^(?:open|go back to|reopen|launch)\s+(?:the\s+)?(?:previous|last)\s*(?:game|one)?$/i.test(cleaned);

  if (isPreviousIntent) {
    const prevGame = ArcadeContextManager.getPreviousGame();

    if (prevGame && context.openGameByName) {
      const res = context.openGameByName(prevGame.title);
      if (res.success) {
        ArcadeContextManager.setCurrentlyPlayingGame(prevGame);
        ArcadeContextManager.setLastVoiceCommand('open_previous_game');

        logDebug({
          recognizedCommand: rawTranscript,
          detectedIntent: 'open_previous_game',
          gameFound: prevGame.title,
          confidence: 1,
        });

        return {
          commandId: 'open_previous_game',
          matchedPhrase: rawTranscript,
          responseText: `Opening the previous game, ${prevGame.title}.`,
          success: true,
        };
      }
    }

    return {
      commandId: 'previous_missing_context',
      matchedPhrase: rawTranscript,
      responseText: 'Which game are you referring to?',
      success: false,
    };
  }

  // 6. Intent: What's this game about?
  const aboutAliases = [
    'whats this game about',
    'what is this game about',
    'tell me about this game',
    'about this game',
    'what is this game',
  ];
  if (aboutAliases.includes(cleaned) || aboutAliases.includes(normalized)) {
    const desc = ArcadeContextManager.getGameDescription();
    if (desc) {
      ArcadeContextManager.setLastVoiceCommand('game_about');
      return {
        commandId: 'game_about',
        matchedPhrase: rawTranscript,
        responseText: desc,
        success: true,
      };
    } else {
      return {
        commandId: 'game_about_no_game',
        matchedPhrase: rawTranscript,
        responseText: "There isn't a game open right now.",
        success: false,
      };
    }
  }

  // 7. Intent: What tier am I in?
  const whatTierAliases = ['what tier am i in', 'which tier am i in', 'current tier', 'what tier is this'];
  if (whatTierAliases.includes(cleaned) || whatTierAliases.includes(normalized)) {
    const tierVal = String(ctxState.currentTier || 'bronze').toUpperCase();
    ArcadeContextManager.setLastVoiceCommand('what_tier');
    return {
      commandId: 'what_tier',
      matchedPhrase: rawTranscript,
      responseText: `You are currently in Tier ${tierVal}.`,
      success: true,
    };
  }

  // 8. Intent: How many games are in this tier?
  const howManyGamesAliases = [
    'how many games are in this tier',
    'how many games in this tier',
    'how many games in current tier',
    'games count in tier',
  ];
  if (howManyGamesAliases.includes(cleaned) || howManyGamesAliases.includes(normalized)) {
    const count = ctxState.currentTierGames.length;
    ArcadeContextManager.setLastVoiceCommand('games_count_tier');
    return {
      commandId: 'games_count_tier',
      matchedPhrase: rawTranscript,
      responseText: `There are ${count} games available in this tier.`,
      success: true,
    };
  }

  // 9. Intent: Random Game / Surprise Me
  const randomAliases = [
    'random game',
    'surprise me',
    'pick something',
    'choose a game',
    'pick a game',
    'play something',
    'open a game',
    'play a game',
    'select a game',
    'random',
    'play random game',
    'open random game',
    'launch random game',
    'pick a random game',
    'play a random game',
    'open game',
    'play game',
    'launch game',
    'start game',
    'load game',
    'open something',
  ];
  const isRandomIntent = randomAliases.includes(cleaned) || randomAliases.includes(normalized);

  if (isRandomIntent) {
    const res = context.openRandomGame
      ? context.openRandomGame()
      : { success: false, reason: 'No games available.' };

    logDebug({
      recognizedCommand: rawTranscript,
      detectedIntent: 'random_game',
      gameFound: res.success ? res.gameName || true : false,
      confidence: 1,
    });

    let responseText = '';
    if (res.success && res.gameName) {
      ArcadeContextManager.setLastVoiceCommand('random_game');
      responseText = name ? `Sure, ${name}. Opening ${res.gameName}.` : `Opening ${res.gameName}.`;
    } else {
      responseText = res.reason || 'No games available.';
    }

    return {
      commandId: 'random_game',
      matchedPhrase: rawTranscript,
      responseText,
      success: res.success,
    };
  }

  // 10. Intent: Open Specific Game or Pronoun ("open it", "play it", "open Glide In")
  const openGameMatch =
    cleaned.match(/^(?:open|launch|start|play|load)\s+(.+)$/i) ||
    normalized.match(/^(?:open|launch|start|play|load)\s+(.+)$/i);

  if (openGameMatch) {
    const targetGameName = openGameMatch[1].trim();

    // Pronoun / Generic Word Resolution
    if (['it', 'this', 'that'].includes(targetGameName)) {
      if (ctxState.currentlyOpenGame) {
        return {
          commandId: 'open_game_already_open',
          matchedPhrase: rawTranscript,
          responseText: `You are currently playing ${ctxState.currentlyOpenGame.title}.`,
          success: true,
        };
      }
      if (ctxState.previouslyPlayedGame && context.openGameByName) {
        const res = context.openGameByName(ctxState.previouslyPlayedGame.title);
        if (res.success) {
          ArcadeContextManager.setCurrentlyPlayingGame(ctxState.previouslyPlayedGame);
          return {
            commandId: 'open_game_pronoun',
            matchedPhrase: rawTranscript,
            responseText: `Opening ${ctxState.previouslyPlayedGame.title}.`,
            success: true,
          };
        }
      }
      return {
        commandId: 'pronoun_missing_context',
        matchedPhrase: rawTranscript,
        responseText: 'Which game are you referring to?',
        success: false,
      };
    }

    if (['another', 'another one', 'something different'].includes(targetGameName)) {
      const anotherGame = ArcadeContextManager.findAnotherGame();
      if (anotherGame && context.openGameByName) {
        const res = context.openGameByName(anotherGame.title);
        if (res.success) {
          ArcadeContextManager.setCurrentlyPlayingGame(anotherGame);
          return {
            commandId: 'play_another',
            matchedPhrase: rawTranscript,
            responseText: "Here's another one you might enjoy.",
            success: true,
          };
        }
      }
      return {
        commandId: 'play_another_missing_context',
        matchedPhrase: rawTranscript,
        responseText: 'Which game are you referring to?',
        success: false,
      };
    }

    if (['similar', 'something similar', 'like this'].includes(targetGameName)) {
      const similarGame = ArcadeContextManager.findSimilarGame();
      if (similarGame && context.openGameByName) {
        const res = context.openGameByName(similarGame.title);
        if (res.success) {
          ArcadeContextManager.setCurrentlyPlayingGame(similarGame);
          return {
            commandId: 'something_similar',
            matchedPhrase: rawTranscript,
            responseText: 'I found another game similar to this.',
            success: true,
          };
        }
      }
      return {
        commandId: 'similar_missing_context',
        matchedPhrase: rawTranscript,
        responseText: 'Which game are you referring to?',
        success: false,
      };
    }

    if (['the previous one', 'previous game', 'the last game', 'previous'].includes(targetGameName)) {
      const prevGame = ArcadeContextManager.getPreviousGame();
      if (prevGame && context.openGameByName) {
        const res = context.openGameByName(prevGame.title);
        if (res.success) {
          ArcadeContextManager.setCurrentlyPlayingGame(prevGame);
          return {
            commandId: 'open_previous_game',
            matchedPhrase: rawTranscript,
            responseText: `Opening the previous game, ${prevGame.title}.`,
            success: true,
          };
        }
      }
      return {
        commandId: 'previous_missing_context',
        matchedPhrase: rawTranscript,
        responseText: 'Which game are you referring to?',
        success: false,
      };
    }

    const genericTargets = ['a game', 'game', 'something', 'random game', 'a random game', 'random'];

    if (genericTargets.includes(targetGameName)) {
      const res = context.openRandomGame
        ? context.openRandomGame()
        : { success: false, reason: 'No games available.' };

      logDebug({
        recognizedCommand: rawTranscript,
        detectedIntent: 'random_game',
        gameFound: res.success ? res.gameName || true : false,
        confidence: 0.9,
      });

      let responseText = '';
      if (res.success && res.gameName) {
        ArcadeContextManager.setLastVoiceCommand('random_game');
        responseText = name ? `Sure, ${name}. Opening ${res.gameName}.` : `Opening ${res.gameName}.`;
      } else {
        responseText = res.reason || 'No games available.';
      }

      return {
        commandId: 'random_game',
        matchedPhrase: rawTranscript,
        responseText,
        success: res.success,
      };
    }

    if (!['settings', 'commands', 'assistant'].includes(targetGameName) && context.openGameByName) {
      let res = context.openGameByName(targetGameName);

      // Fast fuzzy fallback match against available games list if exact target name missed
      if (!res.success && context.games && context.games.length > 0) {
        const cleanTarget = targetGameName.toLowerCase().trim();
        const fuzzyGame = context.games.find(
          (g) =>
            g.title.toLowerCase().includes(cleanTarget) ||
            cleanTarget.includes(g.title.toLowerCase()) ||
            g.title.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget.replace(/[^a-z0-9]/g, '')
        );
        if (fuzzyGame) {
          res = context.openGameByName(fuzzyGame.title);
        }
      }

      logDebug({
        recognizedCommand: rawTranscript,
        detectedIntent: 'open_game',
        targetName: targetGameName,
        gameFound: res.success ? res.gameName || true : false,
        confidence: res.success ? 1 : 0.5,
      });

      let responseText = '';
      if (res.success && res.gameName) {
        const matchedGame = context.games?.find((g) => g.title === res.gameName);
        if (matchedGame) {
          ArcadeContextManager.setCurrentlyPlayingGame(matchedGame);
        }
        ArcadeContextManager.setLastVoiceCommand('open_game');
        responseText = name ? `Sure, ${name}. Opening ${res.gameName}.` : `Opening ${res.gameName}.`;
      } else {
        responseText = res.reason || "I couldn't find that game.";
      }

      return {
        commandId: res.success ? 'open_game' : 'open_game_not_found',
        matchedPhrase: rawTranscript,
        responseText,
        success: res.success,
      };
    }
  }

  // 11. Intent: Tier Navigation
  const tierMatch =
    cleaned.match(/^(?:show tier|go to tier|switch to tier|tier)\s+([a-z0-9\s]+)$/i) ||
    normalized.match(/^(?:show tier|go to tier|switch to tier|tier)\s+([a-z0-9\s]+)$/i);

  if (tierMatch && context.showTier) {
    const tierTarget = tierMatch[1].trim();
    const res = context.showTier(tierTarget);

    logDebug({
      recognizedCommand: rawTranscript,
      detectedIntent: 'show_tier',
      tierTarget,
      confidence: res.success ? 1 : 0.5,
    });

    if (res.success && res.tierName) {
      ArcadeContextManager.setSelectedTier(res.tierName);
      ArcadeContextManager.setLastVoiceCommand('show_tier');
      const responseText = name ? `Sure, ${name}. Showing Tier ${res.tierName}.` : `Showing Tier ${res.tierName}.`;
      return {
        commandId: 'show_tier',
        matchedPhrase: rawTranscript,
        responseText,
        success: true,
      };
    } else {
      return {
        commandId: 'show_tier_failed',
        matchedPhrase: rawTranscript,
        responseText: res.reason || "I couldn't find that tier.",
        success: false,
      };
    }
  }

  // 12. Direct Game Title Match (If user speaks game title without 'open' or 'play' verb)
  if (context.games && context.games.length > 0 && context.openGameByName) {
    const directMatch = context.games.find(
      (g) =>
        g.title.toLowerCase() === cleaned ||
        g.title.toLowerCase() === normalized ||
        g.title.toLowerCase().replace(/[^a-z0-9]/g, '') === cleaned.replace(/[^a-z0-9]/g, '')
    );
    if (directMatch) {
      const res = context.openGameByName(directMatch.title);
      if (res.success) {
        ArcadeContextManager.setCurrentlyPlayingGame(directMatch);
        ArcadeContextManager.setLastVoiceCommand('open_game');
        return {
          commandId: 'open_game',
          matchedPhrase: rawTranscript,
          responseText: name ? `Sure, ${name}. Opening ${directMatch.title}.` : `Opening ${directMatch.title}.`,
          success: true,
        };
      }
    }
  }

  // 13. Predefined Static Commands (hello, capabilities, show_commands, go_home, open_settings)
  for (const cmd of customCommands) {
    for (const phrase of cmd.phrases) {
      const normalizedPhrase = normalizeSpeech(phrase);
      if (cleaned === normalizedPhrase || normalized === normalizedPhrase || cleaned.includes(normalizedPhrase)) {
        logDebug({
          recognizedCommand: rawTranscript,
          detectedIntent: cmd.id,
          confidence: 0.95,
        });

        const actionResult = cmd.action(context);
        const responseText = actionResult || `Executed command: ${cmd.name}`;
        ArcadeContextManager.setLastVoiceCommand(cmd.id);

        return {
          commandId: cmd.id,
          matchedPhrase: phrase,
          responseText,
          success: true,
        };
      }
    }
  }

  // 13. Unsure / Unknown Command Fallback (Confidence failure)
  logDebug({
    recognizedCommand: rawTranscript,
    detectedIntent: 'unknown',
    confidence: 0,
  });

  const fallbackResponse = "I'm not sure what you meant. Try saying 'show commands'.";
  return {
    commandId: null,
    matchedPhrase: null,
    responseText: fallbackResponse,
    success: false,
  };
}



