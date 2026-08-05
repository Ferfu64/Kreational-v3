import { Game, Tier } from '../../types';

export interface CommandActionResult {
  success: boolean;
  gameName?: string;
  tierName?: string;
  reason?: string;
}

export interface CommandActionContext {
  navigateHome: () => void;
  openSettings: () => void;
  openAssistantControls: () => void;
  speak: (text: string) => void;
  // Arcade System Integrations
  games?: Game[];
  tiers?: Tier[];
  currentlyPlayingGame?: Game | null;
  openGameByName?: (gameName: string) => CommandActionResult;
  openRandomGame?: () => CommandActionResult;
  closeCurrentGame?: () => CommandActionResult;
  showTier?: (tierTarget: string | number) => CommandActionResult;
  username?: string;
  enablePersonalizedGreetings?: boolean;
}

export interface VoiceCommandDefinition {
  id: string;
  name: string;
  description: string;
  phrases: string[];
  action: (context: CommandActionContext) => string | void;
}

export interface CommandProcessResult {
  commandId: string | null;
  matchedPhrase: string | null;
  responseText: string;
  success: boolean;
}

