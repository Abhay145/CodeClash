import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import codeDuelLogo from '../assets/code_duel_logo.png';
import {
  Sword, Mail, Lock, User, Eye, EyeOff,
  Loader2, AlertCircle, Zap, Code2, Trophy,
  Shield, ChevronRight,
} from 'lucide-react';

/* ── tiny Google wordmark SVG ── */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

/* ── feature pills shown on the left panel ── */
const FEATURES = [
  { icon: Zap,    label: 'Real-time duels',    desc: 'Compete live against other coders' },
  { icon: Code2,  label: 'Hidden test cases',  desc: 'Judged by a real C++ compiler server' },
  { icon: Trophy, label: 'Rating system',      desc: 'Climb the leaderboard over time' },
  { icon: Shield, label: 'Secure sandbox',     desc: 'Code runs in an isolated environment' },
];

/* ── map Firebase error codes → friendly messages ── */
function friendlyError(code) {
  const map = {
    'auth/email-already-in-use':   'That email is already registered. Try signing in.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/user-not-found':         'No account with that email. Sign up first?',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/invalid-credential':     'Incorrect email or password.',
    'auth/too-many-requests':      'Too many attempts. Please wait a moment.',
    'auth/popup-closed-by-user':   'Google sign-in was cancelled.',
    'auth/network-request-failed': 'Network error. Check your connection.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

export default function AuthPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, setPendingUsername }  = useAuth();

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, navigate, from]);

  /* ── form state ── */
  const [mode, setMode]         = useState('login');   // 'login' | 'signup'
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [usernameError, setUsernameError]       = useState('');
  const [usernameAvail, setUsernameAvail]       = useState(null); // null | true | false
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [animating, setAnimating] = useState(false);
  const debounceRef = useRef(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  const switchMode = (next) => {
    if (next === mode) return;
    setAnimating(true);
    setTimeout(() => {
      setMode(next);
      setError(null);
      setUsernameError('');
      setUsernameAvail(null);
      setAnimating(false);
    }, 220);
  };

  const validateUsername = (val) => {
    if (!val) return 'Username is required.';
    if (val.length < 3) return 'At least 3 characters.';
    if (val.length > 20) return 'Max 20 characters.';
    if (!/^[a-z0-9_]+$/.test(val)) return 'Only lowercase letters, numbers, and underscores.';
    return '';
  };

  // Debounced availability check
  const checkAvailability = useCallback((val) => {
    clearTimeout(debounceRef.current);
    setUsernameAvail(null);
    if (validateUsername(val)) return; // only check if format is valid
    setCheckingUsername(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/users/check-username/${encodeURIComponent(val)}`);
        const data = await res.json();
        setUsernameAvail(data.available);
        if (data.available === false) {
          setUsernameError('Username already taken.');
        } else {
          setUsernameError('');
        }
      } catch {
        setUsernameAvail(null); // network error — let backend decide at submit
      } finally {
        setCheckingUsername(false);
      }
    }, 600);
  }, [API_BASE]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signup') {
        const uErr = validateUsername(username);
        if (uErr) { setUsernameError(uErr); setLoading(false); return; }
        // Block if we already know it's taken
        if (usernameAvail === false) {
          setUsernameError('Username already taken. Please choose another.');
          setLoading(false);
          return;
        }
        // Final availability check right before account creation
        const checkRes = await fetch(`${API_BASE}/api/users/check-username/${encodeURIComponent(username)}`);
        const checkData = await checkRes.json();
        if (!checkData.available) {
          setUsernameError('Username just got taken! Please choose another.');
          setUsernameAvail(false);
          setLoading(false);
          return;
        }
        // Store username so AuthContext can pass it to /api/users/init
        setPendingUsername(username.trim());
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (username.trim()) {
          await updateProfile(cred.user, { displayName: username.trim() });
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  /* ── Google sign-in ── */
  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-space flex overflow-hidden">

      {/* ── Ambient background orbs ── */}
      <div className="orb w-[500px] h-[500px] bg-brand-purple/8 -top-40 -left-40 fixed" />
      <div className="orb w-[400px] h-[400px] bg-brand-pink/6 bottom-0 right-0 fixed" />
      <div className="orb w-[300px] h-[300px] bg-brand-cyan/5 top-1/2 left-1/3 fixed" />
      <div className="grid-bg fixed inset-0" />

      {/* ════════════════════════════
          LEFT  — brand panel
      ════════════════════════════ */}
      <aside className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 relative z-10 p-12 border-r border-white/[0.04]">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl bg-brand-purple/30 blur-lg" />
            <img src={codeDuelLogo} alt="CodeDuel Logo" className="w-10 h-10 object-contain relative z-10" />
          </div>
          <div>
            <span className="text-lg font-black text-white tracking-tight">CodeDuel</span>
            <p className="text-[0.6rem] text-white/30 font-semibold uppercase tracking-widest -mt-0.5">
              Competitive Coding Arena
            </p>
          </div>
        </div>

        {/* Hero headline */}
        <div className="space-y-6">
          <h1 className="text-4xl font-black leading-[1.1] tracking-tight">
            <span className="text-white">Code.</span>{' '}
            <span className="text-white">Duel.</span>{' '}
            <br />
            <span className="text-gradient-hero">Dominate.</span>
          </h1>
          <p className="text-sm text-white/40 leading-relaxed max-w-xs">
            Challenge coders in real-time head-to-head coding battles.
            Hidden test cases, live judging, and a ranking system that rewards skill.
          </p>

          {/* Feature list */}
          <ul className="space-y-4 mt-8">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <li key={label} className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-lg bg-brand-purple/10 border border-brand-purple/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={15} className="text-brand-violet" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white/80">{label}</p>
                  <p className="text-xs text-white/30 mt-0.5">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer note */}
        <p className="text-[0.6rem] text-white/20 font-semibold uppercase tracking-widest">
          © 2026 CodeDuel · Built for hackers
        </p>
      </aside>

      {/* ════════════════════════════
          RIGHT — auth card
      ════════════════════════════ */}
      <main className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <img src={codeDuelLogo} alt="CodeDuel Logo" className="w-8 h-8 object-contain" />
            <span className="text-base font-black text-white">CodeDuel</span>
          </div>

          {/* Card */}
          <div className="glass-card rounded-2xl p-8 shadow-2xl">

            {/* Mode tabs */}
            <div className="flex bg-bg-element rounded-xl p-1 mb-8 relative">
              {/* sliding pill */}
              <div
                className="absolute top-1 bottom-1 rounded-lg bg-brand-purple/20 border border-brand-purple/25 transition-all duration-300 ease-out"
                style={{
                  left:  mode === 'login'  ? '4px' : '50%',
                  width: 'calc(50% - 4px)',
                }}
              />
              {['login', 'signup'].map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 py-2 text-xs font-bold tracking-wide rounded-lg transition-colors duration-200 relative z-10 ${
                    mode === m
                      ? 'text-white'
                      : 'text-white/35 hover:text-white/60'
                  }`}
                >
                  {m === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>

            {/* Heading */}
            <div className={`mb-6 transition-opacity duration-200 ${animating ? 'opacity-0' : 'opacity-100'}`}>
              <h2 className="text-xl font-black text-white">
                {mode === 'login' ? 'Welcome back' : 'Join the arena'}
              </h2>
              <p className="text-xs text-white/35 mt-1">
                {mode === 'login'
                  ? 'Sign in to continue your coding duels'
                  : 'Create your account and start competing'}
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2.5 bg-brand-red/8 border border-brand-red/20 rounded-xl px-3.5 py-3 mb-5 animate-fade-in">
                <AlertCircle size={14} className="text-brand-red flex-shrink-0 mt-0.5" />
                <p className="text-xs text-brand-red/90 leading-relaxed">{error}</p>
              </div>
            )}

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className={`space-y-4 transition-opacity duration-200 ${animating ? 'opacity-0' : 'opacity-100'}`}
            >

              {/* Username — signup only */}
              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <label className="text-[0.65rem] font-extrabold text-white/40 uppercase tracking-widest block">
                    Username <span className="text-brand-red">*</span>
                  </label>
                  <div className="relative">
                    <User size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                    <input
                      id="auth-username"
                      type="text"
                      value={username}
                      onChange={(e) => {
                        const v = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                        setUsername(v);
                        const fmtErr = validateUsername(v);
                        setUsernameError(fmtErr);
                        if (!fmtErr) checkAvailability(v);
                        else { setUsernameAvail(null); setCheckingUsername(false); }
                      }}
                      placeholder="e.g. shubham_codes"
                      autoComplete="username"
                      required
                      maxLength={20}
                      className={`w-full bg-bg-element rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-all border ${
                        usernameAvail === true
                          ? 'border-green-500/50 focus:border-green-500/70'
                          : usernameAvail === false
                          ? 'border-red-500/50 focus:border-red-500/70'
                          : 'border-white/[0.06] focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20'
                      }`}
                    />
                    {/* Availability indicator icon */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      {checkingUsername && <Loader2 size={12} className="animate-spin text-white/30" />}
                      {!checkingUsername && usernameAvail === true && (
                        <span className="text-green-400 text-xs font-black">✓</span>
                      )}
                      {!checkingUsername && usernameAvail === false && (
                        <span className="text-red-400 text-xs font-black">✗</span>
                      )}
                    </div>
                  </div>
                  {/* Status message */}
                  {usernameError ? (
                    <p className="text-[0.6rem] text-red-400 font-semibold mt-0.5">{usernameError}</p>
                  ) : usernameAvail === true ? (
                    <p className="text-[0.6rem] text-green-400 font-semibold mt-0.5">✓ Username available</p>
                  ) : (
                    <p className="text-[0.55rem] text-white/20">3–20 chars · lowercase · letters, numbers, underscores</p>
                  )}
                </div>
              )}


              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[0.65rem] font-extrabold text-white/40 uppercase tracking-widest block">
                  Email
                </label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className="w-full bg-bg-element border border-white/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[0.65rem] font-extrabold text-white/40 uppercase tracking-widest block">
                  Password
                </label>
                <div className="relative">
                  <Lock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                  <input
                    id="auth-password"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    required
                    className="w-full bg-bg-element border border-white/[0.06] rounded-xl pl-9 pr-10 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                id="auth-submit-btn"
                type="submit"
                disabled={loading || (mode === 'signup' && (checkingUsername || usernameAvail === false))}
                className="btn-primary w-full py-2.5 text-sm mt-2 group"
              >
                {loading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <>
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                    <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[0.6rem] text-white/25 font-bold uppercase tracking-widest">or continue with</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* Google */}
            <button
              id="auth-google-btn"
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] text-sm font-semibold text-white/70 hover:bg-white/[0.05] hover:border-white/15 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* Switch mode footer */}
            <p className="text-center text-[0.7rem] text-white/30 mt-6">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                className="text-brand-violet font-bold hover:text-white transition-colors"
              >
                {mode === 'login' ? 'Sign up free' : 'Sign in'}
              </button>
            </p>
          </div>

          {/* Terms note */}
          <p className="text-center text-[0.6rem] text-white/15 mt-5 leading-relaxed">
            By continuing you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </main>
    </div>
  );
}
