import React from 'react';
import { Gamepad2 } from 'lucide-react';
import kreationsLogo from '../assets/images/kreations_sleek_logo_1785626924672.jpg';

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'INITIALIZING KREATIONAL',
  subMessage = 'Preparing your gaming universe...',
}) => {
  return (
    <div
      id="kreational-loading-screen"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050505] text-white p-4 select-none overflow-hidden"
    >
      {/* Background Animated Gradient Blobs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[140px] animate-pulse pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[350px] h-[350px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-sm w-full text-center space-y-6">
        {/* Animated Brand Logo Container */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 rounded-3xl blur-md opacity-75 animate-spin-slow" />
          <div className="relative bg-slate-950 p-1.5 rounded-2xl border border-white/20 shadow-2xl">
            <img
              src={kreationsLogo}
              alt="Kreational Logo"
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="absolute -bottom-2 -right-2 p-1.5 rounded-full bg-purple-600 text-white shadow-lg border border-purple-400/50 animate-bounce">
            <Gamepad2 className="w-4 h-4" />
          </div>
        </div>

        {/* Title & Tagline */}
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-white to-purple-400">
            KREATIONAL
          </h2>
          <p className="text-[10px] uppercase font-mono tracking-[0.25em] text-purple-400 font-bold">
            ELEVATING GAMEPLAY
          </p>
        </div>

        {/* Progress Bar & Status */}
        <div className="w-full space-y-3 pt-2">
          <div className="relative w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-white/10 shadow-inner">
            <div className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-purple-600 via-indigo-500 to-pink-500 rounded-full animate-loading-bar" />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-mono font-semibold text-slate-300 tracking-wide animate-pulse">
              {message}
            </p>
            {subMessage && (
              <p className="text-[11px] text-slate-500 font-mono">
                {subMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
