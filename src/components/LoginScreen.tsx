import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BrandingFooter } from './BrandingFooter';
import {
  User as UserIcon,
  KeyRound,
  ShieldAlert,
  Key,
  UserPlus,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  Sparkles,
  Search,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { User, AccountCreationRequest } from '../types';
import kreationsLogo from '../assets/images/kreations_sleek_logo_1785626924672.jpg';
import {
  authenticateAccount,
  createAccountRequestStore,
  checkAccountRequestStatus,
} from '../services/firestoreStore';
import { authenticateLocally, KREATOR_ADMIN_USER } from '../utils/localAuth';

interface LoginScreenProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'request' | 'status'>('login');

  // Login form state
  const [name, setName] = useState('');
  const [secretWord, setSecretWord] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Request form state
  const [reqUsername, setReqUsername] = useState('');
  const [reqSecretWord, setReqSecretWord] = useState('');
  const [reqNote, setReqNote] = useState('');
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqSubmittedSuccess, setReqSubmittedSuccess] = useState(false);
  const [reqError, setReqError] = useState<string | null>(null);

  // Status check state
  const [searchUsername, setSearchUsername] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<AccountCreationRequest | null | 'not_found'>(null);

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

  const handleLoginSubmit = async (e: React.FormEvent) => {
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

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = reqUsername.trim();
    const cleanWord = reqSecretWord.trim();

    if (!cleanName || !cleanWord) {
      setReqError('Please provide both your preferred username and secret word.');
      return;
    }

    if (cleanName.toLowerCase() === 'kreator') {
      setReqError('The username "Kreator" is reserved for the platform administrator.');
      return;
    }

    setReqSubmitting(true);
    setReqError(null);

    const newRequest: AccountCreationRequest = {
      id: `accreq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      preferredUsername: cleanName,
      preferredSecretWord: cleanWord,
      note: reqNote.trim() || undefined,
      status: 'pending',
      createdAt: Date.now(),
    };

    try {
      await createAccountRequestStore(newRequest);
      setReqSubmittedSuccess(true);
    } catch (err) {
      console.warn('Account request submit failed:', err);
      setReqError('Failed to submit request to Firestore. Please try again.');
    } finally {
      setReqSubmitting(false);
    }
  };

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchUsername.trim();
    if (!clean) return;

    setSearchLoading(true);
    setSearchResult(null);
    try {
      const result = await checkAccountRequestStatus(clean);
      if (result) {
        setSearchResult(result);
      } else {
        setSearchResult('not_found');
      }
    } catch (err) {
      console.warn('Status check failed:', err);
      setSearchResult('not_found');
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div
      id="login-container"
      className="min-h-screen flex flex-col items-center justify-center bg-[#050505] text-slate-100 p-4 py-8 relative overflow-y-auto select-none"
    >
      {/* Background Animated Floating Blobs */}
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.15, 0.25, 0.15],
          x: [-20, 20, -20],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-purple-600/20 rounded-full blur-[150px] pointer-events-none"
      />
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.2, 0.1],
          y: [-20, 20, -20],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="absolute bottom-1/4 left-1/3 w-[450px] h-[450px] bg-indigo-600/15 rounded-full blur-[150px] pointer-events-none"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md z-10 space-y-5"
      >
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <motion.img
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
            src={kreationsLogo}
            alt="Kreational Logo"
            className="w-16 h-16 mx-auto rounded-2xl object-cover border border-purple-500/40 shadow-xl shadow-purple-900/40 mb-1"
            referrerPolicy="no-referrer"
          />
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white font-mono flex items-center justify-center gap-2">
              <span>KREATIONAL</span>
            </h1>
            <p className="text-xs text-purple-300 font-medium tracking-wide mt-1">
              Curated Arcade & Entertainment Hub
            </p>
          </div>
        </div>

        {/* Prominent Branding Banner on Login */}
        <BrandingFooter variant="prominent" />

        {/* Main Interactive Card */}
        <motion.div
          id="login-card"
          layout
          className="glass-modal p-6 sm:p-7 border border-white/10 shadow-2xl relative backdrop-blur-2xl"
        >
          {/* Navigation Pill Switcher */}
          <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10 mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setError(null);
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'login'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('request');
                setReqError(null);
                setReqSubmittedSuccess(false);
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'request'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Request Account</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('status');
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'status'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Check Request Status"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>

          <AnimatePresence mode="wait">
            {/* TAB 1: SIGN IN */}
            {activeTab === 'login' && (
              <motion.div
                key="login-tab"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.25 }}
              >
                <form onSubmit={handleLoginSubmit} className="space-y-4">
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
                      Secret Word / Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        id="secret-word-input"
                        type="password"
                        value={secretWord}
                        onChange={(e) => setSecretWord(e.target.value)}
                        placeholder="Enter your secret word"
                        className="w-full glass-input pl-10 pr-4 py-2.5 text-sm"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      id="login-error-alert"
                      className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2"
                    >
                      <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{error}</span>
                    </motion.div>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    id="login-submit-button"
                    type="submit"
                    disabled={loading}
                    className="w-full btn-primary py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Key className="w-4 h-4" />
                        <span>Access Account</span>
                      </>
                    )}
                  </motion.button>
                </form>

                <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                  <span>Need an account?</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('request')}
                    className="text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span>Submit Request</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* TAB 2: REQUEST ACCOUNT CREATION */}
            {activeTab === 'request' && (
              <motion.div
                key="request-tab"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.25 }}
              >
                {reqSubmittedSuccess ? (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center py-4 space-y-4"
                  >
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-white font-mono">
                        Account Request Submitted!
                      </h3>
                      <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                        Your request for <strong className="text-purple-300">"{reqUsername}"</strong> has been sent to Kreator. Once approved, you can log in right away with your chosen secret word!
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-200 text-left font-mono space-y-1">
                      <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Status: Pending Review by Kreator</span>
                      </div>
                      <p className="text-slate-400 text-[10px]">
                        You can check back here anytime using the status lookup tab.
                      </p>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReqSubmittedSuccess(false);
                          setReqUsername('');
                          setReqSecretWord('');
                          setReqNote('');
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-semibold cursor-pointer"
                      >
                        Submit Another
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setName(reqUsername);
                          setSecretWord(reqSecretWord);
                          setActiveTab('login');
                        }}
                        className="flex-1 btn-primary py-2 px-3 text-xs font-bold cursor-pointer"
                      >
                        Back to Login
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <form onSubmit={handleRequestSubmit} className="space-y-4">
                    <div className="flex items-center gap-2 pb-1 text-slate-300">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold font-mono">Join the Kreational Community</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Preferred Username
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <input
                          id="req-username-input"
                          type="text"
                          value={reqUsername}
                          onChange={(e) => setReqUsername(e.target.value)}
                          placeholder="e.g. Alex, NeonGamer"
                          className="w-full glass-input pl-10 pr-4 py-2.5 text-sm font-mono"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Preferred Secret Word / Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <KeyRound className="w-4 h-4" />
                        </div>
                        <input
                          id="req-password-input"
                          type="text"
                          value={reqSecretWord}
                          onChange={(e) => setReqSecretWord(e.target.value)}
                          placeholder="Unique secret key (e.g. Phoenix99)"
                          className="w-full glass-input pl-10 pr-4 py-2.5 text-sm font-mono"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Note to Kreator (Optional)
                      </label>
                      <textarea
                        id="req-note-input"
                        value={reqNote}
                        onChange={(e) => setReqNote(e.target.value)}
                        placeholder="e.g. Hey Kreator, it's Alex from school! Looking forward to playing."
                        rows={2}
                        className="w-full glass-input px-3.5 py-2 text-xs resize-none"
                      />
                    </div>

                    {reqError && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{reqError}</span>
                      </div>
                    )}

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      id="submit-account-request-button"
                      type="submit"
                      disabled={reqSubmitting}
                      className="w-full btn-primary py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
                    >
                      {reqSubmitting ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Send Request to Kreator</span>
                        </>
                      )}
                    </motion.button>
                  </form>
                )}
              </motion.div>
            )}

            {/* TAB 3: CHECK STATUS */}
            {activeTab === 'status' && (
              <motion.div
                key="status-tab"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div className="text-center space-y-1">
                  <h3 className="text-sm font-bold text-white font-mono flex items-center justify-center gap-1.5">
                    <Search className="w-4 h-4 text-purple-400" />
                    <span>Check Account Request Status</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Enter the username you requested to see if Kreator has approved it.
                  </p>
                </div>

                <form onSubmit={handleCheckStatus} className="space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchUsername}
                      onChange={(e) => setSearchUsername(e.target.value)}
                      placeholder="Enter requested username"
                      className="w-full glass-input pl-3.5 pr-10 py-2.5 text-xs font-mono"
                      required
                    />
                    <button
                      type="submit"
                      disabled={searchLoading}
                      className="absolute inset-y-1 right-1 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center justify-center cursor-pointer transition-colors"
                    >
                      {searchLoading ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </form>

                {searchResult === 'not_found' && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-slate-900/80 border border-white/10 text-center space-y-1"
                  >
                    <p className="text-xs text-slate-300">
                      No pending request found for <span className="text-purple-300 font-mono">"{searchUsername}"</span>.
                    </p>
                    <p className="text-[10px] text-slate-500">
                      If it was already approved and registered, you can try signing in.
                    </p>
                  </motion.div>
                )}

                {searchResult && searchResult !== 'not_found' && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl bg-slate-900/90 border border-purple-500/30 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-white">
                        {searchResult.preferredUsername}
                      </span>
                      {searchResult.status === 'accepted' ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Approved!
                        </span>
                      ) : searchResult.status === 'denied' ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-bold flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Declined
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Pending Review
                        </span>
                      )}
                    </div>

                    {searchResult.reviewerNotes && (
                      <p className="text-[11px] text-slate-300 bg-white/5 p-2 rounded-lg border border-white/5">
                        <strong className="text-purple-300">Kreator:</strong> {searchResult.reviewerNotes}
                      </p>
                    )}

                    {searchResult.status === 'accepted' && (
                      <button
                        type="button"
                        onClick={() => {
                          setName(searchResult.preferredUsername);
                          setSecretWord(searchResult.preferredSecretWord);
                          setActiveTab('login');
                        }}
                        className="w-full btn-primary py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>Sign In as {searchResult.preferredUsername}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
};

