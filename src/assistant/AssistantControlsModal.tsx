import React, { useState } from 'react';
import { useAssistant } from './AssistantContext';
import { VOICE_COMMANDS } from './commands/commandDefinitions';
import {
  X,
  Bot,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  AlertOctagon,
  ShieldCheck,
  Radio,
  Terminal,
  MessageSquare,
  Sparkles,
  Moon,
  Zap,
} from 'lucide-react';

export const AssistantControlsModal: React.FC = () => {
  const {
    isEnabled,
    micStatus,
    engineState,
    transcript,
    lastSpokenText,
    lastCommandResponse,
    error,
    isSpeechRecognitionSupported,
    isSpeechSynthesisSupported,
    isControlsOpen,
    setIsControlsOpen,
    requestMic,
    startListening,
    stopListening,
    speakText,
    stopSpeaking,
    clearTranscript,
    disableAssistant,
    executeCommand,
    sleepWord,
    wakeWord,
    isSleeping,
    setIsSleeping,
    isBoardMode,
    setIsBoardMode,
  } = useAssistant();

  const [testInputText, setTestInputText] = useState('Hello Kreational');

  if (!isControlsOpen || !isEnabled) return null;

  const handleTestVoice = () => {
    if (testInputText.trim()) {
      executeCommand(testInputText.trim());
    }
  };

  const handleRunCommand = (phrase: string) => {
    executeCommand(phrase);
  };

  return (
    <div id="assistant-controls-overlay" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div id="assistant-controls-card" className="glass-modal w-full max-w-xl p-5 sm:p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto my-auto border border-cyan-500/30">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-500/10">
              <Bot className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white font-mono tracking-tight">Kreational Assistant</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  VOICE COMMAND ENGINE
                </span>
              </div>
              <p className="text-xs text-slate-400">Browser-native Speech Recognition & Command Processor</p>
            </div>
          </div>

          <button
            onClick={() => setIsControlsOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Banner if any */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs font-mono flex items-center gap-2.5">
            <AlertOctagon className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Microphone Permission Status Card */}
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-slate-200">
              {micStatus === 'granted' ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ) : micStatus === 'denied' ? (
                <MicOff className="w-4 h-4 text-red-400" />
              ) : (
                <Mic className="w-4 h-4 text-amber-400" />
              )}
              <span>Microphone Access Status</span>
            </div>

            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider ${
                micStatus === 'granted'
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                  : micStatus === 'denied'
                  ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                  : 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
              }`}
            >
              {micStatus}
            </span>
          </div>

          <p className="text-[11px] text-slate-400">
            {micStatus === 'granted'
              ? 'Microphone permission is granted. Voice recognition is ready.'
              : micStatus === 'denied'
              ? 'Microphone permission was denied. Please allow microphone access in your browser address bar.'
              : 'Microphone permission is unrequested or pending. Click below to grant access.'}
          </p>

          {micStatus !== 'granted' && micStatus !== 'unsupported' && (
            <button
              type="button"
              onClick={requestMic}
              className="w-full py-2 px-3 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 text-xs font-mono font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Mic className="w-4 h-4 text-cyan-400" />
              <span>Request Microphone Permission</span>
            </button>
          )}
        </div>

        {/* Engine State & Live Controls */}
        <div className="grid grid-cols-2 gap-3">
          {/* Listening Control */}
          <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Radio className={`w-3.5 h-3.5 ${engineState === 'listening' ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}`} />
                Speech Listener
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                {engineState === 'listening' ? 'Active' : 'Idle'}
              </span>
            </div>

            {engineState === 'listening' ? (
              <button
                type="button"
                onClick={stopListening}
                className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-mono font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MicOff className="w-3.5 h-3.5 text-red-400" />
                <span>Stop Listening</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={startListening}
                disabled={!isSpeechRecognitionSupported || micStatus === 'denied'}
                className="w-full py-2 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 text-xs font-mono font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Mic className="w-3.5 h-3.5 text-cyan-400" />
                <span>Start Listening</span>
              </button>
            )}
          </div>

          {/* Voice Synthesis Control */}
          <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Volume2 className={`w-3.5 h-3.5 ${engineState === 'speaking' ? 'text-purple-400 animate-pulse' : 'text-slate-500'}`} />
                Voice Speaker
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                {engineState === 'speaking' ? 'Speaking' : 'Ready'}
              </span>
            </div>

            {engineState === 'speaking' ? (
              <button
                type="button"
                onClick={stopSpeaking}
                className="w-full py-2 rounded-lg bg-purple-900/40 hover:bg-purple-900/60 text-purple-200 border border-purple-500/40 text-xs font-mono font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <VolumeX className="w-3.5 h-3.5 text-purple-400" />
                <span>Mute Voice</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => speakText('Kreational Assistant synthesis operational.')}
                disabled={!isSpeechSynthesisSupported}
                className="w-full py-2 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-mono font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play className="w-3.5 h-3.5 text-purple-400" />
                <span>Test Voice Synthesizer</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Recognized Speech Stream & Command Response */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-cyan-400" />
              <span>Recognized Speech & Assistant Output</span>
            </label>
            {(transcript || lastCommandResponse) && (
              <button
                type="button"
                onClick={clearTranscript}
                className="text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          <div className="space-y-2">
            <div className="min-h-[50px] max-h-[90px] overflow-y-auto p-3 rounded-xl bg-black/50 border border-white/10 text-xs font-mono leading-relaxed">
              <span className="text-slate-500 font-bold mr-2">SPEECH:</span>
              {transcript ? (
                <span className="text-cyan-200">{transcript}</span>
              ) : (
                <span className="text-slate-500 italic">
                  {engineState === 'listening'
                    ? 'Listening for speech commands...'
                    : 'Click "Start Listening" to say a command.'}
                </span>
              )}
            </div>

            {lastCommandResponse && (
              <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs font-mono text-purple-200 flex items-start gap-2">
                <MessageSquare className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] text-purple-400 uppercase font-bold tracking-wider">Assistant Response:</div>
                  <p>{lastCommandResponse}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Board Mode Toggle Card */}
        <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.03] backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-slate-200">
              <span>Board Mode Status</span>
            </div>
            <button
              type="button"
              onClick={() => setIsBoardMode(!isBoardMode)}
              className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                isBoardMode
                  ? 'bg-cyan-500/30 border border-cyan-400/60 text-cyan-200 hover:bg-cyan-500/40'
                  : 'bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {isBoardMode ? 'OPEN (Text Active / Games Off)' : 'CLOSED (Games Active / Text Off)'}
            </button>
          </div>
        </div>

        {/* Custom Sleep + Wake Word Status (Pulled from Settings) */}
        <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/[0.03] backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-slate-200">
              <Moon className="w-4 h-4 text-purple-400" />
              <span>Sleep & Wake Word Status</span>
            </div>
            <button
              type="button"
              onClick={() => setIsSleeping(!isSleeping)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                isSleeping
                  ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                  : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
              }`}
            >
              {isSleeping ? 'Asleep (Click to Wake)' : 'Active (Click to Sleep)'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 space-y-1">
              <span className="text-[10px] font-mono text-purple-300 uppercase tracking-wider block">Sleep Trigger</span>
              <span className="text-xs font-mono font-bold text-purple-200 bg-purple-900/40 px-2 py-0.5 rounded border border-purple-500/30 inline-block">
                "{sleepWord}"
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 space-y-1">
              <span className="text-[10px] font-mono text-cyan-300 uppercase tracking-wider block">Wake Trigger</span>
              <span className="text-xs font-mono font-bold text-cyan-200 bg-cyan-900/40 px-2 py-0.5 rounded border border-cyan-500/30 inline-block">
                "{wakeWord}"
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
            <span>Configured in Main Settings</span>
            <span className="text-purple-300">Say "{sleepWord}" to sleep • "{wakeWord}" to wake</span>
          </div>
        </div>

        {/* Voice Commands System Library */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Available Voice Commands</span>
            </label>
            <span className="text-[10px] font-mono text-slate-400">Click phrase to trigger</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
            {VOICE_COMMANDS.map((cmd) => (
              <button
                key={cmd.id}
                type="button"
                onClick={() => handleRunCommand(cmd.name)}
                className="p-2.5 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.03] hover:bg-cyan-500/10 hover:border-cyan-500/40 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-200 group-hover:text-cyan-100 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    "{cmd.name}"
                  </span>
                  <Play className="w-3 h-3 text-slate-500 group-hover:text-cyan-300 transition-colors" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{cmd.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Manual Command Execution Input */}
        <div className="space-y-2">
          <label className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-purple-400" />
            <span>Test Command Input</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={testInputText}
              onChange={(e) => setTestInputText(e.target.value)}
              placeholder="e.g. Open 2048, Random game, Close this game, Show Tier 2..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTestVoice();
              }}
              className="glass-input flex-1 px-3 py-2 text-xs font-mono"
            />
            <button
              type="button"
              onClick={handleTestVoice}
              disabled={!testInputText.trim()}
              className="btn-primary py-2 px-4 text-xs font-mono font-bold flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Play className="w-3.5 h-3.5" /> Execute
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              disableAssistant();
              setIsControlsOpen(false);
            }}
            className="px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-mono font-bold cursor-pointer transition-colors"
          >
            Turn Off Assistant
          </button>

          <button
            type="button"
            onClick={() => setIsControlsOpen(false)}
            className="btn-primary py-2 px-5 text-xs font-bold cursor-pointer"
          >
            Close Controls
          </button>
        </div>
      </div>
    </div>
  );
};

