import React from 'react';
import { useAssistant } from './AssistantContext';
import { Bot, Mic, MicOff, Volume2, Sparkles, AlertCircle } from 'lucide-react';

export const AssistantFloatingButton: React.FC = () => {
  const {
    isEnabled,
    micStatus,
    engineState,
    toggleControls,
    isControlsOpen,
    error,
  } = useAssistant();

  if (!isEnabled) return null;

  const isListening = engineState === 'listening';
  const isSpeaking = engineState === 'speaking';
  const isMicDenied = micStatus === 'denied';

  return (
    <div id="assistant-floating-wrapper" className="fixed bottom-6 right-6 z-40 flex items-center gap-2">
      {/* Active Status Badge Tag */}
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/30 text-xs font-mono backdrop-blur-md shadow-lg text-cyan-300">
        <span
          className={`w-2 h-2 rounded-full ${
            isListening
              ? 'bg-cyan-400 animate-ping'
              : isSpeaking
              ? 'bg-purple-400 animate-pulse'
              : isMicDenied || error
              ? 'bg-red-400'
              : 'bg-emerald-400'
          }`}
        />
        <span className="font-semibold text-[11px] tracking-wide">
          {isListening
            ? 'LISTENING'
            : isSpeaking
            ? 'SPEAKING'
            : isMicDenied
            ? 'MIC DENIED'
            : 'ASSISTANT READY'}
        </span>
      </div>

      {/* Futuristic Floating Button */}
      <button
        id="assistant-floating-button"
        type="button"
        onClick={toggleControls}
        aria-label="Open Kreational Assistant Controls"
        title="Kreational Assistant Controls"
        className={`relative group p-3.5 rounded-full cursor-pointer transition-all duration-300 flex items-center justify-center border shadow-2xl ${
          isControlsOpen
            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 ring-2 ring-cyan-500/50 scale-105'
            : isListening
            ? 'bg-cyan-600/30 border-cyan-400 text-cyan-300 ring-4 ring-cyan-500/40 animate-pulse'
            : isSpeaking
            ? 'bg-purple-600/30 border-purple-400 text-purple-300 ring-4 ring-purple-500/40'
            : isMicDenied
            ? 'bg-red-900/40 border-red-500/50 text-red-300'
            : 'bg-slate-900/80 hover:bg-slate-800/90 border-cyan-500/40 text-cyan-400 hover:border-cyan-400 hover:shadow-cyan-500/20'
        } backdrop-blur-xl`}
      >
        {/* Glow halo */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 blur-md opacity-60 group-hover:opacity-100 transition-opacity -z-10" />

        {/* Outer Listening Ripple */}
        {isListening && (
          <span className="absolute -inset-1 rounded-full border border-cyan-400/60 animate-ping opacity-75" />
        )}

        {/* Button Core Icon */}
        <div className="relative flex items-center justify-center">
          {isSpeaking ? (
            <Volume2 className="w-6 h-6 animate-bounce text-purple-300" />
          ) : isListening ? (
            <Mic className="w-6 h-6 text-cyan-300 animate-pulse" />
          ) : isMicDenied ? (
            <MicOff className="w-6 h-6 text-red-400" />
          ) : error ? (
            <AlertCircle className="w-6 h-6 text-amber-400" />
          ) : (
            <Bot className="w-6 h-6 text-cyan-300 group-hover:rotate-12 transition-transform" />
          )}

          {/* Sparkle badge */}
          <Sparkles className="w-3 h-3 absolute -top-1 -right-1 text-cyan-400 animate-pulse" />
        </div>
      </button>
    </div>
  );
};
