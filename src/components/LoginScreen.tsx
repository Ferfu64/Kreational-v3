import React, { useState, useEffect, useRef } from 'react';
import { BrandingFooter } from './BrandingFooter';
import { User as UserIcon, KeyRound, ShieldAlert, Key } from 'lucide-react';
import { User } from '../types';
import kreationsLogo from '../assets/images/kreations_sleek_logo_1785626924672.jpg';
import { authenticateAccount } from '../services/firestoreStore';
import { authenticateLocally, KREATOR_ADMIN_USER } from '../utils/localAuth';

interface LoginScreenProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [name, setName] = useState('');
  const [secretWord, setSecretWord] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const keyBufferRef = useRef<string>('');

  // Global "Override" typing bypass listener when not focused in an input box
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (isInput) {
        return; // Do not intercept if user is typing in a text field
      }

      if (e.key && e.key.length === 1) {
        keyBufferRef.current = (keyBufferRef.current + e.key).slice(-20);
        if (keyBufferRef.current.toLowerCase().endsWith('override')) {
          keyBufferRef.current = '';
          // Instant automatic sign-in as Kreator Admin with Firestore persistence
          authenticateAccount('Kreator', 'Override').then((match) => {
            if (match) {
              onLoginSuccess(match.user, match.token);
            } else {
              onLoginSuccess(KREATOR_ADMIN_USER, `token-kreator-${Date.now()}`);
            }
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onLoginSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanWord = secretWord.trim();

    if (!cleanName || !cleanWord) {
      setError('Please enter your Name and Secret Word');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const match = await authenticateAccount(cleanName, cleanWord);
      if (match) {
        onLoginSuccess(match.user, match.token);
        setLoading(false);
        return;
      }
      setError('Invalid name or secret word.');
    } catch {
      const localMatch = authenticateLocally(cleanName, cleanWord);
      if (localMatch) {
        onLoginSuccess(localMatch.user, localMatch.token);
        setLoading(false);
        return;
      }
      setError('Invalid name or secret word.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="login-container"
      className="min-h-screen flex flex-col items-center justify-center bg-[#050505] text-slate-100 p-4 py-8 relative overflow-y-auto select-none"
    >
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <img
            src={kreationsLogo}
            alt="Kreational Logo"
            className="w-16 h-16 mx-auto rounded-2xl object-cover border border-purple-500/40 shadow-xl shadow-purple-900/40 mb-1"
            referrerPolicy="no-referrer"
          />
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white font-mono">
              KREATIONAL
            </h1>
          </div>
        </div>

        {/* Prominent Branding Banner on Login */}
        <BrandingFooter variant="prominent" />

        {/* Login Form Card */}
        <div id="login-card" className="glass-modal p-8 border border-white/10 shadow-2xl relative">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Your Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  id="name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full glass-input pl-10 pr-4 py-2.5 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Secret Word
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="secret-word-input"
                  type="text"
                  value={secretWord}
                  onChange={(e) => setSecretWord(e.target.value)}
                  placeholder="Enter your secret word"
                  className="w-full glass-input pl-10 pr-4 py-2.5 text-sm"
                  required
                />
              </div>
            </div>

            {error && (
              <div id="login-error-alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              id="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  <span>Access Account</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <p className="text-xs text-slate-400">
              Accounts and secret words are managed directly by Kreator in the admin panel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
