import { VoiceCommandDefinition } from './types';

export const VOICE_COMMANDS: VoiceCommandDefinition[] = [
  {
    id: 'hello',
    name: 'Hello Kreational',
    description: 'Greet the Kreational Assistant',
    phrases: ['hello kreational', 'hi kreational', 'hey kreational', 'hello', 'hi assistant', 'hey assistant'],
    action: (context) => {
      const name = context.enablePersonalizedGreetings !== false && context.username ? context.username : null;
      return name
        ? `Hello ${name}! Welcome to Kreational Arcade. What would you like to play today?`
        : 'Hello! Welcome to Kreational Arcade. How can I assist you today?';
    },
  },
  {
    id: 'thank_you',
    name: 'Thank You',
    description: 'Respond to polite thank you gestures',
    phrases: ['thank you', 'thanks', 'thanks kreational', 'thank you kreational', 'thank you assistant', 'thanks assistant'],
    action: (context) => {
      const name = context.enablePersonalizedGreetings !== false && context.username ? context.username : null;
      return name ? `You're welcome, ${name}.` : "You're welcome.";
    },
  },
  {
    id: 'capabilities',
    name: 'What can you do?',
    description: 'List available capabilities and voice commands',
    phrases: [
      'what can you do',
      'what can you do?',
      'what commands do you have',
      'help',
      'help me',
      'list commands',
    ],
    action: () => {
      return 'I can launch games by name, pick a random game, close open games, switch tiers, open settings, or navigate home.';
    },
  },
  {
    id: 'show_commands',
    name: 'Show commands',
    description: 'Open the assistant command panel',
    phrases: [
      'show commands',
      'display commands',
      'open commands',
      'view commands',
      'command list',
    ],
    action: (context) => {
      context.openAssistantControls();
      const name = context.enablePersonalizedGreetings !== false && context.username ? context.username : null;
      return name ? `Sure, ${name}. Opening command controls.` : 'Opening assistant command controls.';
    },
  },
  {
    id: 'go_home',
    name: 'Go home',
    description: 'Navigate back to the main arcade games screen',
    phrases: [
      'go home',
      'return home',
      'main menu',
      'take me home',
      'back to arcade',
      'home',
    ],
    action: (context) => {
      context.navigateHome();
      const name = context.enablePersonalizedGreetings !== false && context.username ? context.username : null;
      return name ? `Sure, ${name}. Navigating home.` : 'Navigating back to the main arcade screen.';
    },
  },
  {
    id: 'open_settings',
    name: 'Open settings',
    description: 'Open the arcade settings menu',
    phrases: [
      'open settings',
      'show settings',
      'view settings',
      'settings menu',
      'settings',
    ],
    action: (context) => {
      context.openSettings();
      const name = context.enablePersonalizedGreetings !== false && context.username ? context.username : null;
      return name ? `Sure, ${name}. Opening settings menu.` : 'Opening settings menu.';
    },
  },
  {
    id: 'random_game',
    name: 'Random game',
    description: 'Pick and launch a random available arcade game',
    phrases: [
      'random game',
      'surprise me',
      'pick something',
      'choose a game',
      'pick a game',
      'play something',
      'open a game',
      'play a game',
      'select a game',
      'play a random game',
      'select a random game',
      'pick random game',
    ],
    action: (context) => {
      if (context.openRandomGame) {
        const res = context.openRandomGame();
        if (res.success && res.gameName) {
          const name = context.enablePersonalizedGreetings !== false && context.username ? context.username : null;
          return name ? `Sure, ${name}. Opening ${res.gameName}.` : `Opening ${res.gameName}.`;
        }
        return res.reason || 'No games available.';
      }
      return 'Random game functionality unavailable.';
    },
  },
  {
    id: 'close_game',
    name: 'Close this game',
    description: 'Close currently active game and return to arcade',
    phrases: [
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
    ],
    action: (context) => {
      if (context.closeCurrentGame) {
        const res = context.closeCurrentGame();
        if (res.success) {
          const name = context.enablePersonalizedGreetings !== false && context.username ? context.username : null;
          return name ? `Sure, ${name}. Closing game.` : 'Closing game.';
        }
        return res.reason || 'Request failed. You are currently not in a game.';
      }
      return 'Request failed. You are currently not in a game.';
    },
  },
  {
    id: 'open_board',
    name: 'Open board',
    description: 'Enable non-Kreational questions (math, jokes, text help) and disable game opening',
    phrases: [
      'open board',
      'open the board',
      'board mode',
      'enable board',
      'enable board mode',
      'turn on board mode',
    ],
    action: () => {
      return 'Board mode is now open. Non-Kreational questions, math assistance, and jokes are enabled, and game commands are disabled. Say "close board" to exit.';
    },
  },
  {
    id: 'close_board',
    name: 'Close board',
    description: 'Exit board mode and restore normal Kreational Arcade game commands',
    phrases: [
      'close board',
      'close the board',
      'exit board',
      'disable board',
      'disable board mode',
      'turn off board mode',
    ],
    action: () => {
      return 'Board mode closed. Normal game commands and arcade controls are active again.';
    },
  },
  {
    id: 'open_marketplace',
    name: 'Open Marketplace',
    description: 'Navigate to the Kreational Marketplace page',
    phrases: [
      'open the marketplace',
      'open marketplace',
      'take me to the marketplace',
      'show me the trading marketplace',
      'i want to browse items',
      'marketplace',
      'browse items',
      'trading marketplace',
    ],
    action: (context) => {
      if (context.openMarketplace) {
        context.openMarketplace();
      } else {
        window.history.pushState(null, '', '/Marketplace');
        window.dispatchEvent(new Event('popstate'));
      }
      const name = context.enablePersonalizedGreetings !== false && context.username ? context.username : null;
      return name ? `Sure, ${name}. Navigating you to the Marketplace.` : 'Navigating to the Marketplace.';
    },
  },
];

