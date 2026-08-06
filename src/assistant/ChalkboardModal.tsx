import React, { useState } from 'react';
import { useAssistant } from './AssistantContext';
import { X, Eraser, Sparkles, Send, Minimize2, Maximize2, MessageSquare, Mic } from 'lucide-react';

export const ChalkboardModal: React.FC = () => {
  const {
    isBoardMode,
    setIsBoardMode,
    boardEntries,
    clearBoardEntries,
    transcript,
    lastCommandResponse,
    engineState,
    executeCommand,
  } = useAssistant();

  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [typedInput, setTypedInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isBoardMode) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!typedInput.trim() || isSubmitting) return;

    const query = typedInput.trim();
    setTypedInput('');
    setIsSubmitting(true);
    try {
      await executeCommand(query);
    } catch (err) {
      console.error('Error submitting query from chalkboard:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // If minimized, show a small floating chalkboard pill button
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 left-6 z-40 animate-bounceIn">
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#122017] border-4 border-[#5c3a21] text-slate-100 shadow-2xl hover:scale-105 transition-all cursor-pointer group"
        >
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-serif font-bold text-xs uppercase tracking-wider text-yellow-100 [text-shadow:0_0_2px_rgba(254,240,138,0.8)]">
            Open Chalkboard
          </span>
          <Maximize2 className="w-4 h-4 text-slate-300 group-hover:text-white" />
        </button>
      </div>
    );
  }

  return (
    <div id="chalkboard-overlay" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn select-none">
      {/* Outer Wooden Chalkboard Frame */}
      <div className="relative w-full max-w-2xl bg-[#122017] border-[10px] sm:border-[14px] border-[#4a2e1b] rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[85vh] my-auto">
        
        {/* Decorative Wooden Frame Corner Accents */}
        <div className="absolute top-0 left-0 w-6 h-6 border-r-2 border-b-2 border-[#2b180d] bg-[#3d2414] rounded-br z-20 pointer-events-none" />
        <div className="absolute top-0 right-0 w-6 h-6 border-l-2 border-b-2 border-[#2b180d] bg-[#3d2414] rounded-bl z-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-6 h-6 border-r-2 border-t-2 border-[#2b180d] bg-[#3d2414] rounded-tr z-20 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-6 h-6 border-l-2 border-t-2 border-[#2b180d] bg-[#3d2414] rounded-tl z-20 pointer-events-none" />

        {/* Board Header Bar */}
        <div className="bg-[#0b150f] border-b border-emerald-900/60 p-3 sm:px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            <h2 className="font-serif font-black text-sm sm:text-base text-slate-100 tracking-widest uppercase [text-shadow:0_0_4px_rgba(255,255,255,0.8)]">
              Kreational Chalkboard
            </h2>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              BOARD MODE OPEN
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Erase Board Button */}
            <button
              type="button"
              onClick={clearBoardEntries}
              title="Clear Chalkboard"
              className="px-2.5 py-1 rounded-lg bg-amber-900/40 hover:bg-amber-800/60 border border-amber-600/40 text-amber-200 text-xs font-serif flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Eraser className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">Erase Board</span>
            </button>

            {/* Minimize Board */}
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              title="Minimize Board"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <Minimize2 className="w-4 h-4" />
            </button>

            {/* Close Board Mode */}
            <button
              type="button"
              onClick={() => setIsBoardMode(false)}
              title="Close Board Mode"
              className="px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-red-200 text-xs font-serif flex items-center gap-1 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Close Board</span>
            </button>
          </div>
        </div>

        {/* Chalk Surface & Writing Area */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar bg-radial from-[#17291f] via-[#112017] to-[#0a140d] text-slate-100">
          
          {/* Current Live Speech Status Indicator */}
          {engineState === 'listening' && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs font-serif text-emerald-200 flex items-center gap-2 animate-pulse">
              <Mic className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Listening... Speak your question, math problem, or joke!</span>
            </div>
          )}

          {/* Current Live Transcript */}
          {transcript && (
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Hearing Speech:</div>
              <p className="font-serif italic text-sm text-yellow-100 [text-shadow:0_0_2px_rgba(254,240,138,0.8)]">
                "{transcript}"
              </p>
            </div>
          )}

          {/* Chalkboard Intro / Instructions when empty */}
          {boardEntries.length === 0 && !transcript && !lastCommandResponse && (
            <div className="py-8 px-4 text-center space-y-3 opacity-80">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-yellow-100 shadow-inner">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <p className="font-serif text-lg sm:text-xl text-yellow-100/90 [text-shadow:0_0_3px_rgba(254,240,138,0.7)]">
                Welcome to Kreational Board Mode!
              </p>
              <p className="font-serif text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                Ask any math problem (e.g. <span className="text-yellow-100">"What is 144 / 12?"</span> or <span className="text-yellow-100">"15% of 200"</span>), or ask for a joke (e.g. <span className="text-yellow-100">"Tell me a joke"</span>). Answers are generated locally!
              </p>
              <p className="font-mono text-[11px] text-emerald-300/80">
                Say <span className="underline">"close board"</span> anytime to return to normal game mode.
              </p>
            </div>
          )}

          {/* Chalkboard Q&A History List */}
          <div className="space-y-4">
            {boardEntries.map((entry) => (
              <div
                key={entry.id}
                className="p-3.5 sm:p-4 rounded-xl bg-black/30 border border-white/10 space-y-2.5 backdrop-blur-xs shadow-inner animate-fadeIn"
              >
                {/* User Question */}
                <div className="flex items-start gap-2.5">
                  <span className="font-mono font-bold text-xs text-yellow-300/90 bg-yellow-500/20 px-2 py-0.5 rounded border border-yellow-500/30 shrink-0">
                    YOU
                  </span>
                  <p className="font-serif text-sm sm:text-base text-slate-100 font-medium tracking-wide [text-shadow:0_0_2px_rgba(255,255,255,0.8)]">
                    {entry.question}
                  </p>
                </div>

                {/* AI Answer */}
                <div className="flex items-start gap-2.5 pl-2 sm:pl-4 border-l-2 border-emerald-400/50 pt-1">
                  <span className="font-mono font-bold text-xs text-emerald-300/90 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 shrink-0">
                    AI
                  </span>
                  <p className="font-serif text-sm sm:text-base text-yellow-100 leading-relaxed [text-shadow:0_0_2px_rgba(254,240,138,0.8)]">
                    {entry.answer}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Current Command Response fallback display */}
          {boardEntries.length === 0 && lastCommandResponse && (
            <div className="p-4 rounded-xl bg-black/40 border border-yellow-500/30 space-y-2">
              <div className="text-[10px] font-mono text-yellow-300 uppercase tracking-widest font-bold">Latest Answer:</div>
              <p className="font-serif text-sm sm:text-base text-yellow-100 leading-relaxed [text-shadow:0_0_2px_rgba(254,240,138,0.8)]">
                {lastCommandResponse}
              </p>
            </div>
          )}
        </div>

        {/* Wooden Tray & Input Form at Bottom */}
        <div className="bg-[#1a2d21] border-t-2 border-[#3b2313] p-3 sm:px-5 flex flex-col sm:flex-row items-center gap-3 shrink-0 relative">
          
          {/* Wooden Chalk & Eraser Visual Prop on Tray */}
          <div className="hidden sm:flex items-center gap-2 pr-2 border-r border-white/10 shrink-0 select-none">
            {/* White Chalk */}
            <div className="w-8 h-2.5 bg-slate-100 rounded-xs shadow-md border border-slate-300 transform -rotate-12" title="Piece of Chalk" />
            {/* Yellow Chalk */}
            <div className="w-7 h-2.5 bg-yellow-200 rounded-xs shadow-md border border-yellow-300 transform rotate-6" title="Yellow Chalk" />
            {/* Eraser */}
            <div className="w-10 h-4 bg-[#6e4e37] border border-[#4a3424] rounded-xs shadow-inner flex items-center justify-center text-[8px] font-mono font-bold text-amber-200" title="Chalk Eraser">
              ERASER
            </div>
          </div>

          {/* Text Input Form for Chalkboard */}
          <form onSubmit={handleSend} className="w-full flex items-center gap-2">
            <input
              type="text"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              placeholder="Ask math, jokes, or text questions..."
              className="flex-1 bg-black/40 border border-white/20 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-yellow-100 font-serif placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 transition-colors"
            />
            <button
              type="submit"
              disabled={!typedInput.trim() || isSubmitting}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-serif font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shrink-0"
            >
              <span>Ask</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
