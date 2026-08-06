import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

export interface KreditGainEvent {
  id: string;
  amount: number;
  sourceX?: number;
  sourceY?: number;
}

interface KreditGainAnimationProps {
  events: KreditGainEvent[];
  onEventComplete: (id: string) => void;
}

export const KreditGainAnimation: React.FC<KreditGainAnimationProps> = ({ events, onEventComplete }) => {
  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {events.map((evt) => (
        <SingleKreditFlyer key={evt.id} evt={evt} onDone={() => onEventComplete(evt.id)} />
      ))}
    </div>
  );
};

const SingleKreditFlyer: React.FC<{ evt: KreditGainEvent; onDone: () => void }> = ({ evt, onDone }) => {
  const [stage, setStage] = useState<'start' | 'flying' | 'burst'>('start');

  const startX = evt.sourceX || window.innerWidth / 2;
  const startY = evt.sourceY || window.innerHeight / 2;

  // Target coordinates near top right navbar (where Krests counter sits)
  const targetX = window.innerWidth - 180;
  const targetY = 32;

  useEffect(() => {
    const t1 = setTimeout(() => setStage('flying'), 20);
    const t2 = setTimeout(() => setStage('burst'), 750);
    const t3 = setTimeout(() => onDone(), 1100);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const currentX = stage === 'start' ? startX : targetX;
  const currentY = stage === 'start' ? startY : targetY;

  return (
    <>
      {/* Flying particle badge */}
      {stage !== 'burst' ? (
        <div
          className="absolute transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1) flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-xs font-mono shadow-xl shadow-amber-500/80 ring-2 ring-amber-300 scale-110 z-[100]"
          style={{
            left: `${currentX}px`,
            top: `${currentY}px`,
            transform: 'translate(-50%, -50%)',
            opacity: stage === 'start' ? 0.8 : 1,
          }}
        >
          <Sparkles className="w-4 h-4 text-slate-950 animate-spin" />
          <span>+{evt.amount} KRESTS</span>
        </div>
      ) : (
        /* Burst impact light pulse on target */
        <div
          className="absolute z-[100] transition-all duration-300 scale-150 opacity-0 pointer-events-none"
          style={{
            left: `${targetX}px`,
            top: `${targetY}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="w-16 h-16 rounded-full bg-amber-400/80 blur-md animate-ping" />
        </div>
      )}
    </>
  );
};
