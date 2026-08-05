import React, { useRef } from 'react';
import { User } from '../types';
import { LogOut, Shield, Users, Clock, Gamepad2, Inbox, ChevronLeft, ChevronRight, Settings, WifiOff } from 'lucide-react';
import kreationsLogo from '../assets/images/kreations_sleek_logo_1785626924672.jpg';

interface NavbarProps {
  user: User;
  activeTab: 'games' | 'admin-accounts' | 'admin-requests' | 'admin-games';
  setActiveTab: (tab: 'games' | 'admin-accounts' | 'admin-requests' | 'admin-games') => void;
  onOpenRequestsHistory: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  pendingRequestsCount?: number;
  isOnline?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  setActiveTab,
  onOpenRequestsHistory,
  onOpenSettings,
  onLogout,
  pendingRequestsCount = 0,
  isOnline = true,
}) => {
  const isAdmin = user.role === 'admin' || user.username === 'Kreator';
  const navScrollRef = useRef<HTMLDivElement>(null);

  const scrollNav = (direction: 'left' | 'right') => {
    if (navScrollRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      navScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <header id="main-navbar" className="glass sticky top-0 z-30 border-x-0 border-t-0 rounded-none bg-black/60 backdrop-blur-2xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
          {/* Brand / Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setActiveTab('games')}
              className="flex items-center gap-2 text-left group focus:outline-none cursor-pointer"
            >
              <img
                src={kreationsLogo}
                alt="Kreational Logo"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover border border-purple-500/40 shadow-lg shadow-purple-900/40 group-hover:scale-105 transition-transform"
                referrerPolicy="no-referrer"
              />
              <div className="hidden sm:block">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-base sm:text-lg tracking-tight text-white block leading-none">
                    KREATIONAL
                  </span>
                </div>
                <span className="text-[9px] text-purple-400/80 font-mono tracking-widest uppercase block mt-0.5">
                  Game Hub
                </span>
              </div>
            </button>
          </div>

          {/* Horizontally Scrollable Top Bar Navigation Area */}
          <div className="relative flex-1 flex items-center min-w-0 max-w-full overflow-hidden group/nav">
            {/* Scroll Left Indicator Button */}
            <button
              onClick={() => scrollNav('left')}
              className="hidden group-hover/nav:flex items-center justify-center p-1 rounded-full bg-slate-900/90 text-white/80 hover:text-white border border-white/20 absolute left-0 z-10 shadow-lg backdrop-blur-md cursor-pointer"
              title="Scroll Left"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Scrollable Container */}
            <div
              ref={navScrollRef}
              className="flex items-center gap-2 overflow-x-auto scroll-smooth whitespace-nowrap px-1 py-1 no-scrollbar w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              <button
                id="nav-games-button"
                onClick={() => setActiveTab('games')}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shrink-0 ${
                  activeTab === 'games'
                    ? 'bg-purple-600/30 text-white border border-purple-500/50 shadow-md shadow-purple-950/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
                <span>Game Library</span>
              </button>

              {/* My Request History Button */}
              <button
                id="nav-my-requests-button"
                onClick={onOpenRequestsHistory}
                className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent hover:border-white/10 flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer relative shrink-0"
              >
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
                <span>My Requests</span>
              </button>

              {/* Admin Tabs for Kreator */}
              {isAdmin && (
                <div className="flex items-center gap-1.5 pl-2 border-l border-white/10 shrink-0">
                  <button
                    id="nav-admin-requests-button"
                    onClick={() => setActiveTab('admin-requests')}
                    className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer relative shrink-0 ${
                      activeTab === 'admin-requests'
                        ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40 shadow-md shadow-amber-950/20'
                        : 'text-amber-400/80 hover:text-amber-200 hover:bg-amber-500/10 border border-transparent'
                    }`}
                  >
                    <Inbox className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Requests Admin</span>
                    {pendingRequestsCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold text-[10px] animate-pulse">
                        {pendingRequestsCount}
                      </span>
                    )}
                  </button>

                  <button
                    id="nav-admin-accounts-button"
                    onClick={() => setActiveTab('admin-accounts')}
                    className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shrink-0 ${
                      activeTab === 'admin-accounts'
                        ? 'bg-purple-500/20 text-purple-200 border border-purple-500/40 shadow-md shadow-purple-950/20'
                        : 'text-purple-400/80 hover:text-purple-200 hover:bg-purple-500/10 border border-transparent'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Accounts Admin</span>
                  </button>

                  <button
                    id="nav-admin-games-button"
                    onClick={() => setActiveTab('admin-games')}
                    className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shrink-0 ${
                      activeTab === 'admin-games'
                        ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40 shadow-md shadow-rose-950/20'
                        : 'text-rose-400/80 hover:text-rose-200 hover:bg-rose-500/10 border border-transparent'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Games Admin</span>
                  </button>
                </div>
              )}
            </div>

            {/* Scroll Right Indicator Button */}
            <button
              onClick={() => scrollNav('right')}
              className="hidden group-hover/nav:flex items-center justify-center p-1 rounded-full bg-slate-900/90 text-white/80 hover:text-white border border-white/20 absolute right-0 z-10 shadow-lg backdrop-blur-md cursor-pointer"
              title="Scroll Right"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* User Profile, Offline Badge & Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!isOnline && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold animate-pulse">
                <WifiOff className="w-3 h-3" />
                <span className="hidden sm:inline">OFFLINE</span>
              </div>
            )}

            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50' : 'bg-amber-400'}`} />
              <span className="text-xs font-semibold text-purple-300">{user.username}</span>
              {isAdmin && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  KREATOR
                </span>
              )}
            </div>

            <button
              id="nav-settings-button"
              onClick={onOpenSettings}
              className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:text-purple-300 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
              title="Settings & Themes"
            >
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              id="nav-logout-button"
              onClick={onLogout}
              className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/30 transition-all cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
