import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import { Sword, Loader2, Users, Wifi, WifiOff, X, Zap, Shield, Clock } from 'lucide-react';

const REALTIME_URL = import.meta.env.VITE_REALTIME_URL || 'http://localhost:3001';
const API_BASE     = import.meta.env.VITE_API_URL      || 'http://localhost:4000';

// ── Queue phase states ────────────────────────────────────────────────────────
const PHASE = {
  IDLE:       'idle',
  CONNECTING: 'connecting',
  QUEUED:     'queued',
  MATCHED:    'matched',
  ERROR:      'error',
};

// ── Animated dots helper ──────────────────────────────────────────────────────
function Dots() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN(p => (p + 1) % 4), 450);
    return () => clearInterval(t);
  }, []);
  return <span className="font-mono">{'.'.repeat(n)}&nbsp;&nbsp;&nbsp;{''.padEnd(3 - n)}</span>;
}

// ── Elapsed timer ─────────────────────────────────────────────────────────────
function ElapsedTimer({ running }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!running) { setSecs(0); return; }
    const t = setInterval(() => setSecs(p => p + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return <span className="font-mono tabular-nums">{m}:{s}</span>;
}

export default function MatchmakingPage() {
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const socketRef = useRef(null);

  const [phase,     setPhase]     = useState(PHASE.IDLE);
  const [rating,    setRating]    = useState(null);
  const [queueSize, setQueueSize] = useState(null);
  const [matchInfo, setMatchInfo] = useState(null);   // { opponentId, roomId }
  const [errorMsg,  setErrorMsg]  = useState('');
  const [connected, setConnected] = useState(false);

  // ── Fetch user rating on mount ───────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetch(`${API_BASE}/api/users/${user.uid}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.rating) setRating(data.rating); })
      .catch(() => {});
  }, [user]);

  // ── Socket lifecycle ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const socket = io(REALTIME_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('register', user.uid);
      console.log('[matchmaking] socket connected, registered', user.uid);
    });

    socket.on('disconnect', () => {
      setConnected(false);
      // If we were in queue and got disconnected, go back to idle
      setPhase(p => (p === PHASE.QUEUED ? PHASE.IDLE : p));
    });

    socket.on('connect_error', (err) => {
      setConnected(false);
      setPhase(PHASE.ERROR);
      setErrorMsg(`Cannot reach Realtime Server: ${err.message}`);
    });

    // ── Match found! ──────────────────────────────────────────────────────
    socket.on('match-found', ({ opponentId, roomId }) => {
      console.log('[matchmaking] match-found!', { opponentId, roomId });
      setMatchInfo({ opponentId, roomId });
      setPhase(PHASE.MATCHED);

      // Navigate to the duel room after a short celebration delay
      setTimeout(() => {
        navigate(`/duel/${roomId}`, {
          state: { fromMatchmaking: true, opponentId },
        });
      }, 2200);
    });

    return () => {
      socket.off('match-found');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, navigate]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleJoinQueue = () => {
    if (!socketRef.current?.connected) {
      setPhase(PHASE.ERROR);
      setErrorMsg('Not connected to Realtime Server. Is it running on port 3001?');
      return;
    }
    if (!rating) {
      setPhase(PHASE.ERROR);
      setErrorMsg('Could not load your rating. Try refreshing.');
      return;
    }

    setPhase(PHASE.QUEUED);
    socketRef.current.emit('join-queue', { userId: user.uid, rating });
    console.log('[matchmaking] joined queue with rating', rating);
  };

  const handleLeaveQueue = () => {
    socketRef.current?.emit('leave-queue', { userId: user.uid });
    setPhase(PHASE.IDLE);
    console.log('[matchmaking] left queue');
  };

  // ── Redirect if not signed in ─────────────────────────────────────────
  useEffect(() => {
    if (!user) navigate('/auth', { replace: true });
  }, [user, navigate]);

  // ── UI ────────────────────────────────────────────────────────────────────
  const ratingTier = (r) => {
    if (!r) return { label: 'Unranked', color: 'text-[#c9c7ba]/40', bg: 'bg-[#c9c7ba]/5' };
    if (r >= 2000) return { label: 'Grandmaster', color: 'text-[#fbfb7a]',   bg: 'bg-[#fbfb7a]/10' };
    if (r >= 1600) return { label: 'Master',      color: 'text-[#9d1f15]',   bg: 'bg-[#9d1f15]/10' };
    if (r >= 1200) return { label: 'Diamond',     color: 'text-[#c9c7ba]',   bg: 'bg-[#c9c7ba]/10' };
    if (r >= 900)  return { label: 'Gold',        color: 'text-[#fbfb7a]/80',bg: 'bg-[#fbfb7a]/5'  };
    return               { label: 'Bronze',       color: 'text-[#c9c7ba]/60',bg: 'bg-[#c9c7ba]/5'  };
  };

  const tier = ratingTier(rating);

  return (
    <div className="min-h-screen bg-[#29292B] text-[#c9c7ba] flex flex-col items-center justify-center px-6 relative overflow-hidden">

      {/* ── Background ── */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="orb w-[600px] h-[600px] bg-[#9d1f15] opacity-[0.05] -top-32 -left-32 animate-float" />
        <div className="orb w-[500px] h-[500px] bg-[#fbfb7a] opacity-[0.03] bottom-0 right-0" style={{ animationDelay: '-2s' }} />
        <div className="grid-bg" />
      </div>

      {/* ── Back button ── */}
      <button
        onClick={() => { handleLeaveQueue(); navigate('/'); }}
        className="absolute top-6 left-6 z-10 flex items-center gap-2 text-xs font-bold text-[#c9c7ba]/40 hover:text-white transition-colors"
      >
        <X size={14} /> Exit Arena
      </button>

      {/* ── Connection indicator ── */}
      <div className={`absolute top-6 right-6 z-10 flex items-center gap-1.5 text-[0.65rem] font-bold px-2.5 py-1 rounded-full border ${connected ? 'text-[#fbfb7a] border-[#fbfb7a]/20 bg-[#fbfb7a]/5' : 'text-[#9d1f15] border-[#9d1f15]/20 bg-[#9d1f15]/5'}`}>
        {connected ? <Wifi size={11} /> : <WifiOff size={11} />}
        {connected ? 'REALTIME CONNECTED' : 'DISCONNECTED'}
      </div>

      {/* ── Main card ── */}
      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-8">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#9d1f15] to-[#fbfb7a]/30 flex items-center justify-center shadow-xl shadow-[#9d1f15]/20">
            <Sword size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white leading-none">Public Arena</h1>
            <p className="text-[0.65rem] font-bold uppercase tracking-widest text-[#c9c7ba]/40 mt-0.5">Ranked Matchmaking</p>
          </div>
        </div>

        {/* Player card */}
        <div className="w-full bg-[#1e1e20] border border-[#c9c7ba]/10 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#29292B] border border-[#c9c7ba]/10 flex items-center justify-center text-lg font-black text-white select-none">
            {(user?.displayName || user?.email || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white truncate">
              {user?.displayName || user?.email?.split('@')[0] || 'Anonymous'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[0.6rem] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${tier.bg} ${tier.color}`}>
                {tier.label}
              </span>
              <span className="text-[0.65rem] font-bold font-mono text-[#c9c7ba]/50">
                {rating ? `${rating} ELO` : 'Loading...'}
              </span>
            </div>
          </div>
          <Shield size={18} className={tier.color} />
        </div>

        {/* ── Phase: IDLE ── */}
        {phase === PHASE.IDLE && (
          <div className="w-full flex flex-col gap-4 animate-fade-in">
            <div className="w-full bg-[#1e1e20] border border-[#c9c7ba]/5 rounded-2xl p-5 text-center">
              <Users size={28} className="mx-auto mb-3 text-[#c9c7ba]/30" />
              <p className="text-sm text-[#c9c7ba]/50 leading-relaxed">
                Join the ranked queue and we'll match you with a coder of similar skill. The closer the rating, the fairer the fight.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center text-[0.6rem] font-bold uppercase tracking-widest text-[#c9c7ba]/30">
                {[['±200 ELO','Matching Window'],['<30s','Avg. Wait'],['Standard','K=32']].map(([val,lbl]) => (
                  <div key={lbl} className="flex flex-col gap-1">
                    <span className="text-sm font-black text-[#c9c7ba]/60 font-mono">{val}</span>
                    <span>{lbl}</span>
                  </div>
                ))}
              </div>
            </div>
            <button
              id="join-queue-btn"
              onClick={handleJoinQueue}
              disabled={!connected || !rating}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#9d1f15] to-[#9d1f15]/70 text-white font-black text-sm tracking-wide flex items-center justify-center gap-3 hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#9d1f15]/25 active:scale-[0.98]"
            >
              <Zap size={16} className="text-[#fbfb7a]" />
              Find a Match
            </button>
          </div>
        )}

        {/* ── Phase: QUEUED ── */}
        {phase === PHASE.QUEUED && (
          <div className="w-full flex flex-col items-center gap-6 animate-fade-in">

            {/* Pulsing radar */}
            <div className="relative flex items-center justify-center">
              <div className="w-28 h-28 rounded-full border-2 border-[#9d1f15]/20 absolute animate-ping" style={{ animationDuration: '1.5s' }} />
              <div className="w-20 h-20 rounded-full border-2 border-[#9d1f15]/30 absolute animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.3s' }} />
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#9d1f15] to-[#fbfb7a]/20 flex items-center justify-center shadow-xl shadow-[#9d1f15]/30">
                <Loader2 size={20} className="text-white animate-spin" />
              </div>
            </div>

            <div className="text-center">
              <p className="text-base font-black text-white">
                Searching for opponent<Dots />
              </p>
              <p className="text-xs text-[#c9c7ba]/40 mt-1 font-mono">
                Rating window: {rating ? `${rating - 200} – ${rating + 200}` : '…'}
              </p>
            </div>

            {/* Elapsed time */}
            <div className="flex items-center gap-2 text-xs font-bold text-[#c9c7ba]/40">
              <Clock size={13} />
              <ElapsedTimer running={phase === PHASE.QUEUED} />
            </div>

            {/* Queue stats */}
            {queueSize !== null && (
              <p className="text-[0.65rem] font-bold text-[#c9c7ba]/30 uppercase tracking-widest">
                {queueSize} player{queueSize !== 1 ? 's' : ''} in queue
              </p>
            )}

            <button
              onClick={handleLeaveQueue}
              className="flex items-center gap-2 text-xs font-bold text-[#c9c7ba]/40 hover:text-[#9d1f15] transition-colors mt-2"
            >
              <X size={13} /> Cancel Search
            </button>
          </div>
        )}

        {/* ── Phase: MATCHED ── */}
        {phase === PHASE.MATCHED && (
          <div className="w-full flex flex-col items-center gap-5 animate-scale-up">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#fbfb7a]/20 to-[#9d1f15]/30 flex items-center justify-center border-2 border-[#fbfb7a]/30 shadow-2xl shadow-[#fbfb7a]/10">
              <Sword size={30} className="text-[#fbfb7a]" />
            </div>
            <div className="text-center">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#fbfb7a] mb-2">Match Found!</p>
              <h2 className="text-2xl font-black text-white">Opponent Located</h2>
              {matchInfo?.opponentId && (
                <p className="text-xs text-[#c9c7ba]/40 mt-1 font-mono">
                  vs. {matchInfo.opponentId.slice(0, 8)}…
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#fbfb7a]/60">
              <Loader2 size={13} className="animate-spin" />
              Entering the arena…
            </div>
          </div>
        )}

        {/* ── Phase: ERROR ── */}
        {phase === PHASE.ERROR && (
          <div className="w-full bg-[#9d1f15]/10 border border-[#9d1f15]/20 rounded-2xl p-5 text-center animate-fade-in">
            <WifiOff size={24} className="mx-auto mb-3 text-[#9d1f15]/60" />
            <p className="text-sm font-bold text-white/80 mb-1">Connection Error</p>
            <p className="text-xs text-[#c9c7ba]/40 leading-relaxed mb-4">{errorMsg}</p>
            <button
              onClick={() => { setPhase(PHASE.IDLE); setErrorMsg(''); }}
              className="text-xs font-bold text-[#9d1f15] hover:text-white transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
