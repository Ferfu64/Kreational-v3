import React, { useState, useEffect } from 'react';
import { Settings, X, Palette, Sliders, Check, Wifi, WifiOff, RefreshCw, Search, Bot, Volume2, Play, RotateCcw, Moon, Zap, Download, Smartphone, CheckCircle2, Sparkles } from 'lucide-react';
import { VoiceManager, VoiceConfig } from '../assistant/VoiceManager';
import { useAssistant } from '../assistant/AssistantContext';
import { subscribePwa, canInstallPwa, isStandalone, promptPwaInstall } from '../pwaManager';

const DownloadAppSection: React.FC = () => {
  const [canInstall, setCanInstall] = useState<boolean>(canInstallPwa());
  const [installed, setInstalled] = useState<boolean>(isStandalone());
  const [installing, setInstalling] = useState<boolean>(false);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = subscribePwa(() => {
      setCanInstall(canInstallPwa());
      setInstalled(isStandalone());
    });
    return () => unsubscribe();
  }, []);

  const handleInstallClick = async () => {
    setInstalling(true);
    try {
      const outcome = await promptPwaInstall();
      if (outcome) {
        setInstalled(true);
      }
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="space-y-3.5 p-4 rounded-xl border border-purple-500/30 bg-purple-500/[0.03] backdrop-blur-md">
      <div className="flex items-center justify-between">
        <label className="text-xs font-mono font-bold uppercase text-slate-200 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-purple-400" />
          <span>Download as APP (Mobile & Desktop)</span>
        </label>
        {installed ? (
          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-1 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Installed as App</span>
          </span>
        ) : (
          <span className="text-[10px] font-mono font-bold text-purple-300 bg-purple-950/60 border border-purple-500/40 px-2.5 py-1 rounded-full">
            PWA Ready
          </span>
        )}
      </div>

      <p className="text-[11px] text-slate-300 leading-relaxed">
        Install Kreational directly to your mobile home screen or desktop application list for instant offline play, fast performance, and full-screen arcade gaming!
      </p>

      {/* Main Install Action */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
        {canInstall && !installed && (
          <button
            type="button"
            onClick={handleInstallClick}
            disabled={installing}
            className="flex-1 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-purple-600/30 active:scale-95 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{installing ? 'Opening Prompt...' : 'Install Kreational App'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowInstructions(!showInstructions)}
          className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-mono text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>{showInstructions ? 'Hide Instructions' : 'Mobile Install Guide'}</span>
        </button>
      </div>

      {/* Step by Step Instructions */}
      {(showInstructions || (!canInstall && !installed)) && (
        <div className="mt-2 p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-3 text-xs text-slate-300 font-sans animate-fadeIn">
          <div className="font-mono font-bold text-[11px] text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>How to install on Mobile Devices:</span>
          </div>

          <div className="space-y-2 text-[11px] leading-relaxed">
            <div className="p-2 rounded-lg bg-white/5 border border-white/5">
              <span className="font-bold text-white block mb-0.5">📱 iOS (iPhone / iPad Safari):</span>
              1. Tap the <strong className="text-cyan-300">Share</strong> button in Safari toolbar.<br />
              2. Scroll down and tap <strong className="text-cyan-300">"Add to Home Screen"</strong>.<br />
              3. Tap <strong className="text-cyan-300">Add</strong> to complete installation.
            </div>

            <div className="p-2 rounded-lg bg-white/5 border border-white/5">
              <span className="font-bold text-white block mb-0.5">🤖 Android (Chrome / Firefox / Edge):</span>
              1. Tap the <strong className="text-purple-300">Menu (⋮)</strong> icon in top right.<br />
              2. Select <strong className="text-purple-300">"Install app"</strong> or <strong className="text-purple-300">"Add to Home screen"</strong>.<br />
              3. Confirm installation prompt.
            </div>

            <div className="p-2 rounded-lg bg-white/5 border border-white/5">
              <span className="font-bold text-white block mb-0.5">💻 Desktop (Chrome / Edge / Brave):</span>
              Click the <strong className="text-emerald-300">Install icon</strong> in your browser address bar or click the button above.
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-purple-500/20">
        <span>Offline Service Worker: Active</span>
        <span className="text-purple-300">Lighthouse PWA Compliant</span>
      </div>
    </div>
  );
};

export interface UserSettings {
  theme: 'cyber-void' | 'obsidian-matrix' | 'amethyst-night' | 'emerald-synth' | 'sunset-crimson';
  glassStyle: 'soft' | 'frost' | 'crisp';
  density: 'standard' | 'compact';
  enableSearchBar: boolean;
  enableAssistant: boolean;
  enablePersonalizedGreetings: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'cyber-void',
  glassStyle: 'soft',
  density: 'standard',
  enableSearchBar: true,
  enableAssistant: false,
  enablePersonalizedGreetings: true,
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  onSyncOfflineData?: () => void;
  settings: UserSettings;
  onUpdateSettings: (newSettings: UserSettings) => void;
}

const VoiceSettingsSection: React.FC = () => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceSearch, setVoiceSearch] = useState('');
  const [config, setConfig] = useState<VoiceConfig>(VoiceManager.getConfig());
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setVoices(VoiceManager.getVoices());
      setConfig(VoiceManager.getConfig());
    };
    refresh();
    const unsubscribe = VoiceManager.subscribe(refresh);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        refresh();
      };
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const selectedVoice = VoiceManager.getSelectedVoice();

  const handleVoiceChange = (uri: string) => {
    const updated = VoiceManager.saveConfig({ voiceURI: uri });
    setConfig(updated);
  };

  const handleSliderChange = (field: keyof VoiceConfig, value: number) => {
    const updated = VoiceManager.saveConfig({ [field]: value });
    setConfig(updated);
  };

  const handleReset = () => {
    const reset = VoiceManager.resetConfig();
    setConfig(reset);
  };

  const handleTestVoice = (voiceURI?: string) => {
    setIsTesting(true);
    VoiceManager.testVoice(
      voiceURI || config.voiceURI || selectedVoice?.voiceURI || selectedVoice?.name || undefined,
      {
        rate: config.rate,
        pitch: config.pitch,
        volume: config.volume,
      },
      {
        onEnd: () => setIsTesting(false),
        onError: () => setIsTesting(false),
      }
    );
  };

  const filteredVoices = voices.filter(
    (v) =>
      v.name.toLowerCase().includes(voiceSearch.toLowerCase()) ||
      v.lang.toLowerCase().includes(voiceSearch.toLowerCase())
  );

  return (
    <div className="space-y-4 pt-3 border-t border-cyan-500/20">
      <div className="flex items-center justify-between">
        <label className="text-xs font-mono font-bold uppercase text-cyan-300 flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-cyan-400" />
          <span>Voice Customization</span>
        </label>
        <button
          type="button"
          onClick={handleReset}
          className="text-[11px] font-mono text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition-colors cursor-pointer"
          title="Reset to default voice settings"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset to Default</span>
        </button>
      </div>

      {/* Voice Dropdown & Search */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-300 font-mono">
          <span>Select Device Voice ({voices.length} detected)</span>
          {selectedVoice && (
            <span className="text-[10px] text-cyan-400 truncate max-w-[180px]">
              Active: {selectedVoice.name}
            </span>
          )}
        </div>

        {/* Voice Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search voices by name or language (e.g. English, Google)..."
            value={voiceSearch}
            onChange={(e) => setVoiceSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        {/* Voice Selector */}
        <div className="flex items-center gap-2">
          <select
            value={config.voiceURI || selectedVoice?.voiceURI || selectedVoice?.name || ''}
            onChange={(e) => handleVoiceChange(e.target.value)}
            className="flex-1 py-2 px-3 bg-black/60 border border-white/10 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50 cursor-pointer truncate"
          >
            {filteredVoices.map((v) => {
              const isDefault = v.default;
              return (
                <option key={v.voiceURI || v.name} value={v.voiceURI || v.name}>
                  {v.name} ({v.lang}) {isDefault ? '— Default System Voice' : ''}
                </option>
              );
            })}
            {filteredVoices.length === 0 && (
              <option value="" disabled>
                No matching voices found
              </option>
            )}
          </select>

          <button
            type="button"
            onClick={() => handleTestVoice()}
            disabled={isTesting}
            className="py-2 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isTesting ? 'animate-pulse text-cyan-400' : ''}`} />
            <span>{isTesting ? 'Testing...' : 'Test Voice'}</span>
          </button>
        </div>
      </div>

      {/* Voice Controls: Speed, Pitch, Volume Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        {/* Rate Slider */}
        <div className="space-y-1 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
            <span>Speech Speed</span>
            <span className="font-bold text-cyan-300">{config.rate.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={config.rate}
            onChange={(e) => handleSliderChange('rate', parseFloat(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* Pitch Slider */}
        <div className="space-y-1 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
            <span>Pitch</span>
            <span className="font-bold text-cyan-300">{config.pitch.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={config.pitch}
            onChange={(e) => handleSliderChange('pitch', parseFloat(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* Volume Slider */}
        <div className="space-y-1 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
            <span>Volume</span>
            <span className="font-bold text-cyan-300">{Math.round(config.volume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1.0"
            step="0.05"
            value={config.volume}
            onChange={(e) => handleSliderChange('volume', parseFloat(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>
      </div>

      {/* Sleep & Wake Word Trigger Configuration */}
      <SleepWakeSettingsSection />
    </div>
  );
};

const SleepWakeSettingsSection: React.FC = () => {
  let assistantContext: any = null;
  try {
    assistantContext = useAssistant();
  } catch (e) {
    // Fallback if rendered outside AssistantProvider
  }

  const [localSleepWord, setLocalSleepWord] = useState(() => (typeof localStorage !== 'undefined' && localStorage.getItem('kreational_assistant_sleep_word')) || 'sleep');
  const [localWakeWord, setLocalWakeWord] = useState(() => (typeof localStorage !== 'undefined' && localStorage.getItem('kreational_assistant_wake_word')) || 'wake up');

  const sleepWord = assistantContext ? assistantContext.sleepWord : localSleepWord;
  const wakeWord = assistantContext ? assistantContext.wakeWord : localWakeWord;

  const handleSleepChange = (val: string) => {
    if (assistantContext) {
      assistantContext.setSleepWord(val);
    } else {
      setLocalSleepWord(val);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('kreational_assistant_sleep_word', val.trim() || 'sleep');
      }
    }
  };

  const handleWakeChange = (val: string) => {
    if (assistantContext) {
      assistantContext.setWakeWord(val);
    } else {
      setLocalWakeWord(val);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('kreational_assistant_wake_word', val.trim() || 'wake up');
      }
    }
  };

  return (
    <div className="space-y-2.5 pt-3 border-t border-cyan-500/20">
      <label className="text-xs font-mono font-bold uppercase text-purple-300 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-purple-400" />
          <span>Custom Sleep & Wake Words</span>
        </span>
        <span className="text-[10px] text-cyan-400 font-normal border border-cyan-500/30 px-2 py-0.5 rounded-full bg-cyan-950/40">
          Assistant Triggers
        </span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="text-[10px] font-mono text-slate-400 block mb-1">Sleep Word Trigger</label>
          <input
            type="text"
            value={sleepWord}
            onChange={(e) => handleSleepChange(e.target.value)}
            placeholder="e.g. sleep"
            className="w-full py-1.5 px-3 bg-black/60 border border-white/10 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-purple-500/50"
          />
        </div>
        <div>
          <label className="text-[10px] font-mono text-slate-400 block mb-1">Wake Word Trigger</label>
          <input
            type="text"
            value={wakeWord}
            onChange={(e) => handleWakeChange(e.target.value)}
            placeholder="e.g. wake up"
            className="w-full py-1.5 px-3 bg-black/60 border border-white/10 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50"
          />
        </div>
      </div>
      <p className="text-[10px] text-slate-500 font-mono leading-tight">
        Saying your sleep word puts the assistant into sleep mode. Saying your wake word resumes active listening.
      </p>
    </div>
  );
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  onSyncOfflineData?: () => void;
  settings: UserSettings;
  onUpdateSettings: (newSettings: UserSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isOnline,
  onSyncOfflineData,
  settings,
  onUpdateSettings,
}) => {
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSettingChange = (updated: Partial<UserSettings>) => {
    const next = { ...settings, ...updated };
    onUpdateSettings(next);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div id="settings-modal-overlay" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div id="settings-modal-card" className="glass-modal w-full max-w-lg p-5 sm:p-6 space-y-5 sm:space-y-6 shadow-2xl relative max-h-[88vh] sm:max-h-[90vh] overflow-y-auto my-auto [scrollbar-width:thin] [ms-overflow-style:none]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-mono tracking-tight">App Customization & Settings</h3>
              <p className="text-xs text-slate-400">Personalize your visual theme, layout, and offline preferences.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Network & Offline Status Banner */}
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-mono backdrop-blur-md ${
          isOnline
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-emerald-400 animate-pulse" />
            ) : (
              <WifiOff className="w-4 h-4 text-amber-400" />
            )}
            <div>
              <span className="font-bold">{isOnline ? 'Online Mode Active' : 'Offline Mode Active'}</span>
              <p className="text-[11px] opacity-80 mt-0.5">
                {isOnline
                  ? 'All games and cloud sync operating normally.'
                  : 'Site works offline! Play games & login locally.'}
              </p>
            </div>
          </div>
          {onSyncOfflineData && isOnline && (
            <button
              onClick={onSyncOfflineData}
              className="py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync</span>
            </button>
          )}
        </div>

        {/* Download as APP (PWA Installation Section) */}
        <DownloadAppSection />

        {/* Theme Preset Selection */}
        <div className="space-y-3">
          <label className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-2">
            <Palette className="w-4 h-4 text-purple-400" />
            <span>Visual Theme Atmosphere</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              { id: 'cyber-void', label: 'Cyber Void', desc: 'Dark Purple & Cyan Neon' },
              { id: 'obsidian-matrix', label: 'Midnight Obsidian', desc: 'Deep Matrix Black & Slate' },
              { id: 'amethyst-night', label: 'Royal Amethyst', desc: 'Rich Violet & Magenta Glow' },
              { id: 'emerald-synth', label: 'Emerald Matrix', desc: 'Cyber Green Synthwave' },
              { id: 'sunset-crimson', label: 'Sunset Crimson', desc: 'Dark Rose Red Accent' },
            ].map((t) => {
              const isActive = settings.theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSettingChange({ theme: t.id as any })}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-purple-600/30 border-purple-500 text-white ring-2 ring-purple-500/50 shadow-lg'
                      : 'bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono font-bold text-xs">
                    <span>{t.label}</span>
                    {isActive && <Check className="w-3.5 h-3.5 text-purple-400" />}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{t.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Glassmorphic Style */}
        <div className="space-y-3">
          <label className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Glass Finish Intensity</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'soft', label: 'Soft Glass' },
              { id: 'frost', label: 'Deep Frost' },
              { id: 'crisp', label: 'Crisp Slate' },
            ].map((g) => {
              const isActive = settings.glassStyle === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleSettingChange({ glassStyle: g.id as any })}
                  className={`p-2.5 rounded-xl border text-xs font-mono font-semibold text-center cursor-pointer transition-all ${
                    isActive
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200 shadow-md'
                      : 'bg-white/[0.02] border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Layout Density */}
        <div className="space-y-3">
          <label className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span>UI Layout Density</span>
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { id: 'standard', label: 'Standard Spacing', desc: 'Spacious padding & margins' },
              { id: 'compact', label: 'Compact Layout', desc: 'Denser cards for high resolution' },
            ].map((d) => {
              const isActive = settings.density === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => handleSettingChange({ density: d.id as any })}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    isActive
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200 shadow-md'
                      : 'bg-white/[0.02] border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono font-bold text-xs">
                    <span>{d.label}</span>
                    {isActive && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{d.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Bar Toggle */}
        <div className="space-y-2 p-3.5 rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-md">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono font-bold uppercase text-slate-200 flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-400" />
              <span>Games Search Bar</span>
            </label>
            <button
              id="settings-toggle-search-bar"
              type="button"
              onClick={() => handleSettingChange({ enableSearchBar: !settings.enableSearchBar })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                settings.enableSearchBar ? 'bg-purple-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.enableSearchBar ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Show an interactive game search & title filter bar right under the tier selector tabs.
          </p>
        </div>

        {/* Kreational Assistant Toggle */}
        <div className="space-y-3 p-3.5 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.03] backdrop-blur-md">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono font-bold uppercase text-slate-200 flex items-center gap-2">
              <Bot className="w-4 h-4 text-cyan-400" />
              <span>Kreational Assistant</span>
            </label>
            <button
              id="settings-toggle-kreational-assistant"
              type="button"
              onClick={() => handleSettingChange({ enableAssistant: !settings.enableAssistant })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                settings.enableAssistant ? 'bg-cyan-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.enableAssistant ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Enable browser-native voice recognition & speech synthesis assistant framework. (OFF by default)
          </p>

          {settings.enableAssistant && (
            <>
              <div className="pt-2 border-t border-cyan-500/20 flex items-center justify-between">
                <span className="text-xs font-mono text-slate-300 font-semibold">
                  Enable personalized greetings
                </span>
                <button
                  id="settings-toggle-personalized-greetings"
                  type="button"
                  onClick={() => handleSettingChange({ enablePersonalizedGreetings: !settings.enablePersonalizedGreetings })}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                    settings.enablePersonalizedGreetings ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      settings.enablePersonalizedGreetings ? 'translate-x-4.5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Voice Customization Section */}
              <VoiceSettingsSection />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          {savedSuccess ? (
            <span className="text-xs text-emerald-400 font-mono font-bold flex items-center gap-1">
              <Check className="w-4 h-4" /> Preferences Auto-Saved!
            </span>
          ) : (
            <span className="text-[11px] text-slate-500 font-mono">Changes take effect immediately.</span>
          )}

          <button
            onClick={onClose}
            className="btn-primary py-2 px-5 text-xs font-bold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
