import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Trophy, Flame, Users, Clock, ChevronRight, ArrowLeft,
  TrendingUp, TrendingDown, Minus, Sword, Code2, Loader2, Lock, Globe, Home
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function RatingDeltaBadge({ delta }) {
  if (delta == null) return null;
  if (delta > 0) return (
    <span className="inline-flex items-center gap-1 text-[0.6rem] font-extrabold text-[#00E676] bg-[#00E676]/10 border border-[#00E676]/25 px-2 py-0.5 rounded-full">
      <TrendingUp size={9} /> +{delta}
    </span>
  );
  if (delta < 0) return (
    <span className="inline-flex items-center gap-1 text-[0.6rem] font-extrabold text-[#FF2E2E] bg-[#FF2E2E]/10 border border-[#FF2E2E]/25 px-2 py-0.5 rounded-full">
      <TrendingDown size={9} /> {delta}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[0.6rem] font-extrabold text-white/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
      <Minus size={9} /> 0
    </span>
  );
}

function OutcomeBadge({ outcome }) {
  if (outcome === 'victory') return (
    <span className="inline-flex items-center gap-1 text-[0.65rem] font-extrabold text-[#00E676] bg-[#00E676]/10 border border-[#00E676]/25 px-2.5 py-1 rounded-full">
      <Trophy size={10} /> WIN
    </span>
  );
  if (outcome === 'tie') return (
    <span className="inline-flex items-center gap-1 text-[0.65rem] font-extrabold text-[#fbfb7a] bg-[#fbfb7a]/10 border border-[#fbfb7a]/25 px-2.5 py-1 rounded-full">
      <Users size={10} /> TIE
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[0.65rem] font-extrabold text-[#FF2E2E] bg-[#FF2E2E]/10 border border-[#FF2E2E]/25 px-2.5 py-1 rounded-full">
      <Flame size={10} /> LOSS
    </span>
  );
}

function formatDuration(secs) {
  if (!secs && secs !== 0) return '—';
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function MatchCard({ match, uid, profiles, onClick }) {
  const winnerId = match.winnerId;
  const isDraw = winnerId === 'tie';
  let outcome = 'defeat';
  if (isDraw) outcome = 'tie';
  else if (winnerId === uid) outcome = 'victory';

  const opponentId = (match.participantIds || []).find((id) => id !== uid);
  const opponentProfile = profiles[opponentId] || {};
  const opponentName = opponentProfile.displayName || (opponentId ? opponentId.slice(0, 8) : 'Unknown');

  const ratingDelta = match.ratingDelta?.[uid] ?? null;
  const myParticipant = (match.participants || []).find((p) => p.userId === uid);
  const submitCount = myParticipant?.submitCount ?? 0;

  const reasonConfig = {
    solved:    { label: 'Solved',    color: 'text-[#00E676]' },
    timeout:   { label: 'Timeout',   color: 'text-[#fbfb7a]' },
    surrender: { label: 'Surrender', color: 'text-[#FF2E2E]' },
  };
  const reason = reasonConfig[match.completionReason] ?? { label: match.completionReason ?? '—', color: 'text-white/30' };

  return (
    <div
      onClick={onClick}
      className="w-full flex items-center justify-between gap-4 p-4 rounded-2xl border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.03] hover:border-[#9d1f15]/30 transition-all cursor-pointer group"
    >
      {/* Outcome + date */}
      <div className="flex flex-col items-center gap-1.5 min-w-[56px]">
        <OutcomeBadge outcome={outcome} />
        <span className="text-[0.55rem] text-white/25 font-bold">{formatDate(match.completedAt)}</span>
      </div>

      {/* vs opponent */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#9d1f15]/10 border border-[#9d1f15]/20 flex items-center justify-center text-[0.65rem] font-black text-white/70 uppercase overflow-hidden flex-shrink-0">
            {opponentProfile.photoURL
              ? <img src={opponentProfile.photoURL} alt={opponentName} className="w-full h-full object-cover" />
              : opponentName.slice(0, 2)
            }
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-white/80 truncate block">vs. {opponentName}</span>
            <span className="text-[0.6rem] text-white/30 font-mono">Problem: {match.problemId?.slice(0, 12) ?? '—'}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-4 text-[0.6rem] text-white/35 font-bold">
        <div className="flex items-center gap-1">
          <Clock size={10} />
          <span>{formatDuration(match.durationSeconds)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Code2 size={10} />
          <span>{submitCount} submit{submitCount !== 1 ? 's' : ''}</span>
        </div>
        <span className={reason.color}>{reason.label}</span>
      </div>

      {/* Rating delta */}
      <div className="flex items-center gap-2">
        <RatingDeltaBadge delta={ratingDelta} />
        <ChevronRight size={14} className="text-white/15 group-hover:text-white/40 transition-colors" />
      </div>
    </div>
  );
}

export default function MatchHistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tab, setTab] = useState('public'); // 'public' | 'private'
  const [matches, setMatches] = useState({ public: null, private: null });
  const [loading, setLoading] = useState({ public: false, private: false });
  const [profiles, setProfiles] = useState({});
  const [userStats, setUserStats] = useState(null);

  // Fetch matches for the active tab
  useEffect(() => {
    if (!user || matches[tab] !== null) return;

    const fetchMatches = async () => {
      setLoading((l) => ({ ...l, [tab]: true }));
      try {
        const idToken = await user.getIdToken();
        const res = await fetch(`${API_BASE}/api/matches?matchType=${tab}&limit=30`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setMatches((m) => ({ ...m, [tab]: data }));

        // Collect all opponent IDs for profile fetch
        const opponentIds = new Set();
        data.forEach((match) => {
          (match.participantIds || []).forEach((id) => {
            if (id !== user.uid) opponentIds.add(id);
          });
        });

        // Fetch missing profiles
        const newProfiles = {};
        await Promise.all(
          [...opponentIds].map(async (uid) => {
            if (profiles[uid]) return;
            try {
              const r = await fetch(`${API_BASE}/api/users/${uid}`);
              if (r.ok) newProfiles[uid] = await r.json();
            } catch { /* ignore */ }
          })
        );
        if (Object.keys(newProfiles).length > 0) {
          setProfiles((p) => ({ ...p, ...newProfiles }));
        }
      } catch (err) {
        console.error('[MatchHistory] fetch error:', err.message);
        setMatches((m) => ({ ...m, [tab]: [] }));
      } finally {
        setLoading((l) => ({ ...l, [tab]: false }));
      }
    };

    fetchMatches();
  }, [tab, user, matches]);

  // Fetch user stats
  useEffect(() => {
    if (!user) return;
    fetch(`${API_BASE}/api/users/${user.uid}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setUserStats(data); })
      .catch(() => {});
  }, [user]);

  const currentMatches = matches[tab] || [];
  const isLoading = loading[tab];

  const statCards = tab === 'public'
    ? [
        { label: 'Played', value: userStats?.matchesPlayedPublic ?? '—', color: 'text-white' },
        { label: 'Won',    value: userStats?.matchesWonPublic   ?? '—', color: 'text-[#00E676]' },
        { label: 'Lost',   value: userStats?.matchesLostPublic  ?? '—', color: 'text-[#FF2E2E]' },
        { label: 'Tied',   value: userStats?.matchesTiedPublic  ?? '—', color: 'text-[#fbfb7a]' },
      ]
    : [
        { label: 'Played', value: userStats?.matchesPlayedPrivate ?? '—', color: 'text-white' },
        { label: 'Won',    value: userStats?.matchesWonPrivate   ?? '—', color: 'text-[#00E676]' },
        { label: 'Lost',   value: userStats?.matchesLostPrivate  ?? '—', color: 'text-[#FF2E2E]' },
        { label: 'Tied',   value: userStats?.matchesTiedPrivate  ?? '—', color: 'text-[#fbfb7a]' },
      ];

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#c9c7ba] flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="orb w-[600px] h-[600px] bg-[#9d1f15] opacity-[0.05] -top-32 -left-32 animate-float" />
        <div className="orb w-[400px] h-[400px] bg-[#fbfb7a] opacity-[0.02] bottom-0 right-0" style={{ animationDelay: '-2s' }} />
        <div className="grid-bg" />
      </div>

      <main className="relative z-10 max-w-3xl mx-auto w-full px-6 py-12 flex flex-col gap-8">
        {/* Navigation / Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/20 transition-all text-xs font-bold text-white/60 hover:text-white cursor-pointer"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/20 transition-all text-xs font-bold text-white/60 hover:text-white cursor-pointer"
            >
              <Home size={14} /> Home
            </button>
          </div>
          <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-2">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Match History</h1>
              <p className="text-xs text-white/30 font-bold uppercase tracking-wider mt-0.5">
                {user?.displayName || user?.email?.split('@')[0] || 'Player'}'s Past Duels
              </p>
            </div>
            <div className="flex items-center gap-2">
              {userStats?.rating && (
                <div className="flex flex-col items-end">
                  <span className="text-lg font-black font-mono text-[#fbfb7a] leading-none">{userStats.rating}</span>
                  <span className="text-[0.55rem] font-bold uppercase tracking-widest text-white/30">ELO</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stat overview */}
        <div className="grid grid-cols-4 gap-3">
          {statCards.map((s) => (
            <div key={s.label} className="glass-card rounded-2xl p-4 border border-white/[0.05] text-center">
              <div className={`text-2xl font-black font-mono ${s.color}`}>{s.value}</div>
              <div className="text-[0.6rem] font-bold uppercase tracking-wider text-white/30 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tab toggle */}
        <div className="flex bg-[#1e1e20] p-1 rounded-xl border border-white/[0.04]">
          <button
            onClick={() => setTab('public')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all ${
              tab === 'public'
                ? 'bg-[#29292B] text-white border border-white/[0.05] shadow'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            <Globe size={12} /> Public Arena
          </button>
          <button
            onClick={() => setTab('private')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all ${
              tab === 'private'
                ? 'bg-[#29292B] text-white border border-white/[0.05] shadow'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            <Lock size={12} /> Private Duels
          </button>
        </div>

        {/* Match list */}
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-16 text-white/30">
            <Loader2 size={24} className="animate-spin text-[#9d1f15]" />
            <span className="text-xs font-bold uppercase tracking-wider">Loading matches…</span>
          </div>
        ) : currentMatches.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
              <Sword size={24} className="text-white/15" />
            </div>
            <div>
              <p className="text-sm font-bold text-white/50">No {tab} matches yet</p>
              <p className="text-xs text-white/25 mt-1">
                {tab === 'public'
                  ? 'Head to the Public Arena to start ranked matchmaking.'
                  : 'Create or join a private room to start a friendly duel.'}
              </p>
            </div>
            <button
              onClick={() => navigate('/clash')}
              className="btn-primary px-6 py-2.5 text-xs cursor-pointer"
            >
              {tab === 'public' ? 'Find a Match' : 'Create Private Room'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {currentMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                uid={user?.uid}
                profiles={profiles}
                onClick={() => navigate(`/match/${match.id}/results`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
