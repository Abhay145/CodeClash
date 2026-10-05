import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  ArrowLeft, Home, Trophy, Award, TrendingUp, Activity,
  Globe, Lock, Star, ChevronRight, Loader2, Sparkles, Shield, RefreshCw
} from 'lucide-react';


const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// ── Rating Tier Helper ──────────────────────────────────────────────────────
function getRatingTier(r) {
  if (!r || r < 1000) return { label: 'Bronze',     color: '#a87940', glow: '#a87940', icon: '🪙' };
  if (r >= 2200)      return { label: 'Crimson GM', color: '#FF2E2E', glow: '#FF2E2E', icon: '👑' };
  if (r >= 1800)      return { label: 'Master',     color: '#fbfb7a', glow: '#fbfb7a', icon: '⚡' };
  if (r >= 1400)      return { label: 'Diamond',    color: '#00E5FF', glow: '#00E5FF', icon: '💎' };
  return               { label: 'Gold',       color: '#00E676', glow: '#00E676', icon: '🏅' };
}

// ── Skeleton Loader ─────────────────────────────────────────────────────────
function Skeleton({ className = '', style }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-white/5 ${className}`}
      style={style}
    />
  );
}

// ── SVG Sparkline (uses rating as proxy for progress) ────────────────────────
function Sparkline({ wins, played, color = '#9d1f15' }) {
  if (!played) {
    return (
      <div className="h-10 flex items-center justify-center">
        <span className="text-[0.6rem] text-white/20 uppercase tracking-widest font-bold">No progress data</span>
      </div>
    );
  }
  const pts = Array.from({ length: 8 }, (_, i) => {
    const base = (wins / played) * 100;
    return Math.max(5, Math.min(95, base + (Math.sin(i * 1.5 + wins) * 15)));
  });
  const W = 160, H = 45;
  const xStep = W / (pts.length - 1);
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${i * xStep},${H - (p / 100) * H}`).join(' ');
  const fill = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${i * xStep},${H - (p / 100) * H}`).join(' ') +
    ` L${(pts.length - 1) * xStep},${H} L0,${H} Z`;
  return (
    <svg width="100%" height="45" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="overflow-visible">
      <defs>
        <linearGradient id="areaGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#areaGlow)" />
      <path d={d} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(pts.length - 1) * xStep} cy={H - (pts[pts.length - 1] / 100) * H} r="3.5" fill="#fbfb7a" className="animate-pulse" />
    </svg>
  );
}

// ── Stat Card Component ──────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color = '#9d1f15' }) {
  return (
    <div
      className="flex flex-col p-4 rounded-2xl relative overflow-hidden transition-transform hover:scale-[1.02] border"
      style={{ background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.04)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[0.6rem] font-black uppercase tracking-widest text-white/40">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 border border-white/10">
          <Icon size={13} style={{ color }} />
        </div>
      </div>
      <span className="text-2xl font-black font-mono text-white leading-none">{value}</span>
      {sub && <span className="text-[0.6rem] text-white/30 font-mono mt-1.5">{sub}</span>}
    </div>
  );
}

// ── Player Profile Modal ────────────────────────────────────────────────────
function PlayerModal({ player, onClose }) {
  if (!player) return null;
  const tier = getRatingTier(player.rating);
  const winRate = player.matchesPlayedPublic
    ? Math.round((player.matchesWonPublic / player.matchesPlayedPublic) * 100)
    : 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl border overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0d1117 0%, #151a22 100%)',
          borderColor: `${tier.color}33`,
          boxShadow: `0 0 60px ${tier.glow}15, 0 20px 60px rgba(0,0,0,0.6)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, transparent, ${tier.color}, transparent)` }} />

        <button onClick={onClose} className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all cursor-pointer">
          <span className="text-xs">✕</span>
        </button>

        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black text-white overflow-hidden border"
                style={{ background: `${tier.color}15`, borderColor: `${tier.color}44` }}
              >
                {player.photoURL
                  ? <img src={player.photoURL} alt={player.displayName} className="w-full h-full object-cover" />
                  : (player.displayName || 'CD').slice(0, 2).toUpperCase()
                }
              </div>
              <div className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full border-2 border-[#0d1117] flex items-center justify-center text-[0.55rem]" style={{ background: tier.color }}>
                {tier.icon}
              </div>
            </div>
            <div>
              <h3 className="text-base font-black text-white">{player.displayName || 'Anonymous'}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[0.55rem] font-black uppercase tracking-widest px-2 py-0.5 rounded border" style={{ color: tier.color, borderColor: `${tier.color}33`, background: `${tier.color}0a` }}>
                  {tier.label}
                </span>
                <span className="text-xs font-mono font-black" style={{ color: tier.color }}>{player.rating ?? 1000} ELO</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Played', value: player.matchesPlayedPublic ?? 0, icon: Activity },
              { label: 'Won',    value: player.matchesWonPublic ?? 0,    icon: Award },
              { label: 'Win %',  value: `${winRate}%`,                   icon: TrendingUp },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="text-center p-3 rounded-xl bg-white/[0.01] border border-white/[0.04]">
                <Icon size={13} className="mx-auto mb-1" style={{ color: tier.color }} />
                <div className="text-sm font-black text-white font-mono">{value}</div>
                <div className="text-[0.55rem] uppercase tracking-wider text-white/40 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl mb-3 bg-white/[0.01] border border-white/[0.04]">
            <span className="text-[0.6rem] font-bold uppercase tracking-wider text-white/40 flex items-center gap-1.5"><Lock size={10} />Private Record</span>
            <span className="text-xs font-mono font-black text-white/60">
              {player.matchesWonPrivate ?? 0}W – {player.matchesLostPrivate ?? 0}L
            </span>
          </div>

          <div className="text-center py-2 text-[0.6rem] uppercase tracking-wider text-white/20 font-bold">CodeDuel Profile Card</div>
        </div>
      </div>
    </div>
  );
}

export default function ArenaPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Profile data
  const [profile,    setProfile]    = useState(null);
  const [loadingPr,  setLoadingPr]  = useState(true);

  // Leaderboard data
  const [leaderboard,  setLeaderboard]  = useState([]);
  const [loadingLdb,   setLoadingLdb]   = useState(true);

  // Modal profile player
  const [modalPlayer, setModalPlayer] = useState(null);
  const [loadingMod,  setLoadingMod]  = useState(false);

  const fetchUserProfile = useCallback(async () => {
    if (!user) return;
    setLoadingPr(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/${user.uid}`);
      if (res.ok) setProfile(await res.json());
    } catch { /* silent */ }
    finally { setLoadingPr(false); }
  }, [user]);

  const fetchLeaderboard = useCallback(async () => {
    setLoadingLdb(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/leaderboard`);
      if (res.ok) setLeaderboard(await res.json());
    } catch { /* silent */ }
    finally { setLoadingLdb(false); }
  }, []);

  const openPlayerModal = async (uid) => {
    setLoadingMod(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/${uid}`);
      if (res.ok) setModalPlayer(await res.json());
    } catch { /* silent */ }
    finally { setLoadingMod(false); }
  };

  useEffect(() => {
    if (!user) { navigate('/auth', { replace: true }); return; }
    fetchUserProfile();
    fetchLeaderboard();
  }, [user, fetchUserProfile, fetchLeaderboard]);

  const plPlayed   = profile?.matchesPlayedPublic ?? 0;
  const plWon      = profile?.matchesWonPublic ?? 0;
  const plLost     = profile?.matchesLostPublic ?? 0;
  const plWinRate  = plPlayed ? Math.round((plWon / plPlayed) * 100) : 0;
  const privWon  = profile?.matchesWonPrivate  ?? 0;
  const privLost = profile?.matchesLostPrivate ?? 0;

  const myTier = getRatingTier(profile?.rating);

  // Extract Podium (Top 3) and remaining table players (4-20)
  const topThree = leaderboard.slice(0, 3);
  const tablePlayers = leaderboard.slice(3, 20);

  return (
    <div className="min-h-screen bg-[#0B0C10] text-white flex flex-col relative overflow-x-hidden selection:bg-[#9d1f15]/30">
      
      {/* Background decor */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="orb w-[600px] h-[600px] bg-[#9d1f15] opacity-[0.03] -top-32 -left-32 animate-float" />
        <div className="orb w-[500px] h-[500px] bg-[#00E5FF] opacity-[0.01] bottom-0 right-0 animate-pulse" />
        <div className="grid-bg" />
      </div>

      <Navbar />

      {/* Profile Modal */}
      {(modalPlayer || loadingMod) && (
        loadingMod
          ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <Loader2 size={28} className="animate-spin text-white/40" />
            </div>
          : <PlayerModal player={modalPlayer} onClose={() => setModalPlayer(null)} />
      )}

      <main className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-4 md:px-6 py-6 flex flex-col gap-6 animate-fade-up">
        
        {/* Navigation / Header */}
        <div className="flex items-center justify-between">
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
          <div className="text-right">
            <h1 className="text-xl font-black text-white leading-none">ARENA LEADERBOARD</h1>
            <p className="text-[0.6rem] font-bold uppercase tracking-widest text-[#c9c7ba]/40 mt-1">Profile Stats & rankings</p>
          </div>
        </div>

        {/* Primary Layout Grid (Chess.com structure) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6 items-start">
          
          {/* COLUMN 1: Profile Summary, Stats Cards, sparkline */}
          <div className="flex flex-col gap-5">
            
            {/* PROFILE SUMMARY HERO CARD */}
            <div
              className="rounded-3xl p-6 relative overflow-hidden border"
              style={{
                background: `linear-gradient(135deg, ${myTier.color}0a, rgba(11,12,16,0.95))`,
                borderColor: 'rgba(255,255,255,0.04)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
              }}
            >
              {loadingPr ? (
                <div className="flex items-center gap-4">
                  <Skeleton className="w-20 h-20 rounded-2xl" />
                  <div className="flex-1 flex flex-col gap-2">
                    <Skeleton className="w-36 h-4" />
                    <Skeleton className="w-24 h-3" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white overflow-hidden border"
                      style={{
                        background: `${myTier.color}15`,
                        borderColor: `${myTier.color}55`,
                        boxShadow: `0 0 20px ${myTier.color}18`
                      }}
                    >
                      {profile?.photoURL
                        ? <img src={profile.photoURL} alt="me" className="w-full h-full object-cover" />
                        : (profile?.displayName || 'CD').slice(0, 2).toUpperCase()
                      }
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full border-2 border-[#0B0C10] flex items-center justify-center text-[0.5rem]" style={{ background: myTier.color }}>
                      {myTier.icon}
                    </div>
                  </div>

                  {/* Profile info */}
                  <div className="min-w-0">
                    <h2 className="text-lg font-black text-white leading-none truncate">
                      {profile?.displayName || profile?.email?.split('@')[0]}
                    </h2>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[0.55rem] font-black uppercase tracking-widest px-2 py-0.5 rounded border" style={{ color: myTier.color, borderColor: `${myTier.color}35`, background: `${myTier.color}0a` }}>
                        {myTier.label}
                      </span>
                      <span className="text-xs font-mono font-black" style={{ color: myTier.color }}>
                        {profile?.rating ?? 1000} ELO
                      </span>
                    </div>
                    {profile?.createdAt && (
                      <p className="text-[0.55rem] text-white/25 mt-1.5 uppercase font-mono">
                        Joined: {new Date(profile.createdAt.seconds * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* STATS CARDS MINI GRID */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Public Matches" value={plPlayed} sub={`${plWon}W / ${plLost}L`} icon={Activity} color="#00E5FF" />
              <StatCard label="Win Rate" value={`${plWinRate}%`} sub="Public Arena" icon={TrendingUp} color="#00E676" />
              <StatCard label="Trophy Standings" value={myTier.icon + ' ' + myTier.label} sub={`ELO rating: ${profile?.rating ?? 1000}`} icon={Award} color="#FFB000" />
              <StatCard label="Private Record" value={`${privWon}W - ${privLost}L`} sub="Custom Lobby" icon={Lock} color="#FF2E2E" />
            </div>

            {/* SVG PROGRESS SPARKLINE */}
            <div className="p-5 rounded-2xl border bg-white/[0.01] border-white/[0.04] flex flex-col gap-3">
              <span className="text-[0.6rem] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                <TrendingUp size={13} /> Rating Progress Trend
              </span>
              {loadingPr ? (
                <Skeleton className="w-full h-[45px] rounded-lg" />
              ) : (
                <Sparkline wins={plWon} played={plPlayed} color={myTier.color} />
              )}
            </div>

            {/* RANK PROGRESS TRACK */}
            <div className="p-5 rounded-2xl border bg-white/[0.01] border-white/[0.04]">
              <div className="flex items-center justify-between mb-3.5">
                <span className="text-[0.6rem] font-black uppercase tracking-widest text-white/40">Tier Progress</span>
                <span className="text-[0.55rem] font-mono text-white/20">Next Rank: {[1000, 1400, 1800, 2200].find(t => t > (profile?.rating ?? 0)) ?? 'MAX'} ELO</span>
              </div>
              <div className="flex gap-2">
                {[
                  { label: 'Bronze',  min: 0,    max: 999,  color: '#a87940' },
                  { label: 'Gold',    min: 1000, max: 1399, color: '#00E676' },
                  { label: 'Diamond', min: 1400, max: 1799, color: '#00E5FF' },
                  { label: 'Master',  min: 1800, max: 2199, color: '#fbfb7a' },
                  { label: 'GM',      min: 2200, max: 9999, color: '#FF2E2E' },
                ].map(({ label, min, max, color }) => {
                  const r = profile?.rating ?? 0;
                  const cur = r >= min && r <= max;
                  const done = r > max;
                  return (
                    <div key={label} className="flex-1">
                      <div className="h-1 rounded-full mb-1 transition-all" style={{ background: done ? color : cur ? `${color}88` : `${color}15` }} />
                      <div className="text-[0.4rem] text-center uppercase tracking-wider font-bold" style={{ color: cur ? color : 'rgba(255,255,255,0.15)' }}>{label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* COLUMN 2: GLOBAL LEADERBOARD */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="text-yellow-400" size={16} />
                <h2 className="text-sm font-black text-white uppercase tracking-wider">Global Rankings</h2>
              </div>
              <button
                onClick={fetchLeaderboard}
                disabled={loadingLdb}
                className="text-[0.6rem] font-black uppercase tracking-wider text-yellow-400/60 hover:text-yellow-400 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={11} className={loadingLdb ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>

            {loadingLdb ? (
              <div className="flex flex-col gap-3 py-10">
                <div className="flex justify-center gap-4 mb-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="w-20 h-28" />
                  ))}
                </div>
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="w-full h-12" />
                ))}
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.04] bg-white/[0.01] p-12 text-center flex flex-col items-center justify-center gap-3">
                <Trophy size={28} className="text-white/10" />
                <div>
                  <p className="text-xs font-black text-white/30 uppercase tracking-wider">No Standings Yet</p>
                  <p className="text-[0.6rem] text-white/20 mt-1">Play public matches to rank on the global leaderboard.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                
                {/* Podium Cards (Top 3) */}
                <div className="flex items-end justify-center gap-3 pt-6 pb-2">
                  {/* SECOND PLACE */}
                  {topThree[1] && (
                    <div
                      onClick={() => openPlayerModal(topThree[1].uid)}
                      className="flex-1 max-w-[120px] p-3 rounded-2xl text-center border cursor-pointer hover:scale-[1.03] transition-all bg-white/[0.005] border-white/[0.03] card-hover stagger-2 animate-fade-in"
                      style={{ transform: 'translateY(12px)' }}
                    >
                      <span className="text-lg block">🥈</span>
                      <div className="w-10 h-10 rounded-full mx-auto my-2 overflow-hidden border-2 border-slate-400 flex items-center justify-center text-xs font-black bg-white/5">
                        {topThree[1].photoURL
                          ? <img src={topThree[1].photoURL} alt="p2" className="w-full h-full object-cover" />
                          : topThree[1].displayName.slice(0, 2).toUpperCase()
                        }
                      </div>
                      <p className="text-[0.65rem] font-black text-white truncate">{topThree[1].displayName}</p>
                      <p className="text-[0.6rem] font-bold text-slate-300 font-mono mt-0.5">{topThree[1].rating}</p>
                    </div>
                  )}

                  {/* FIRST PLACE */}
                  {topThree[0] && (
                    <div
                      onClick={() => openPlayerModal(topThree[0].uid)}
                      className="flex-1 max-w-[130px] p-4 rounded-2xl text-center border cursor-pointer hover:scale-[1.03] transition-all relative card-hover stagger-1 animate-glow-pulse animate-fade-in"
                      style={{
                        background: 'linear-gradient(135deg, rgba(251,251,122,0.05), rgba(0,0,0,0.4))',
                        borderColor: 'rgba(251,251,122,0.25)',
                        boxShadow: '0 4px 20px rgba(251,251,122,0.06)'
                      }}
                    >
                      <span className="text-xl block">🥇</span>
                      <div className="w-12 h-12 rounded-full mx-auto my-2 overflow-hidden border-2 border-yellow-400 flex items-center justify-center text-xs font-black bg-yellow-400/5 shadow-[0_0_10px_rgba(251,251,122,0.2)]">
                        {topThree[0].photoURL
                          ? <img src={topThree[0].photoURL} alt="p1" className="w-full h-full object-cover" />
                          : topThree[0].displayName.slice(0, 2).toUpperCase()
                        }
                      </div>
                      <p className="text-[0.7rem] font-black text-white truncate">{topThree[0].displayName}</p>
                      <p className="text-[0.65rem] font-black text-yellow-300 font-mono mt-0.5">{topThree[0].rating}</p>
                    </div>
                  )}

                  {/* THIRD PLACE */}
                  {topThree[2] && (
                    <div
                      onClick={() => openPlayerModal(topThree[2].uid)}
                      className="flex-1 max-w-[120px] p-3 rounded-2xl text-center border cursor-pointer hover:scale-[1.03] transition-all bg-white/[0.005] border-white/[0.03] card-hover stagger-3 animate-fade-in"
                      style={{ transform: 'translateY(18px)' }}
                    >
                      <span className="text-lg block">🥉</span>
                      <div className="w-10 h-10 rounded-full mx-auto my-2 overflow-hidden border-2 border-amber-600 flex items-center justify-center text-xs font-black bg-white/5">
                        {topThree[2].photoURL
                          ? <img src={topThree[2].photoURL} alt="p3" className="w-full h-full object-cover" />
                          : topThree[2].displayName.slice(0, 2).toUpperCase()
                        }
                      </div>
                      <p className="text-[0.65rem] font-black text-white truncate">{topThree[2].displayName}</p>
                      <p className="text-[0.6rem] font-bold text-amber-600 font-mono mt-0.5">{topThree[2].rating}</p>
                    </div>
                  )}
                </div>

                {/* Table for remaining players (4+) */}
                {tablePlayers.length > 0 && (
                  <div className="flex flex-col gap-2 mt-4">
                    {tablePlayers.map((player, idx) => {
                      const isMe = player.uid === user?.uid;
                      const plTier = getRatingTier(player.rating);
                      return (
                        <div
                          key={player.uid}
                          onClick={() => openPlayerModal(player.uid)}
                          className={`flex items-center justify-between p-3.5 rounded-2xl cursor-pointer border transition-all hover:bg-white/[0.01] card-hover stagger-${Math.min(5, idx + 1)} animate-fade-in`}
                          style={{
                            background: isMe ? `${plTier.color}08` : 'rgba(255,255,255,0.01)',
                            borderColor: isMe ? `${plTier.color}35` : 'rgba(255,255,255,0.03)'
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-7 text-center font-mono font-black text-xs text-white/30">
                              #{player.rank}
                            </span>
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black overflow-hidden flex-shrink-0 border"
                              style={{ background: `${plTier.color}15`, borderColor: `${plTier.color}44`, color: plTier.color }}
                            >
                              {player.photoURL
                                ? <img src={player.photoURL} alt={player.displayName} className="w-full h-full object-cover" />
                                : player.displayName.slice(0, 2).toUpperCase()
                              }
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-black text-white flex items-center gap-1.5">
                                {player.displayName}
                                {isMe && <span className="text-[0.45rem] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border border-yellow-300/30 bg-yellow-300/10 text-yellow-300">You</span>}
                              </p>
                              <p className="text-[0.5rem] font-bold mt-0.5" style={{ color: plTier.color }}>{plTier.label}</p>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0 font-mono">
                            <div className="text-xs font-black text-yellow-400">{player.rating}</div>
                            <div className="text-[0.5rem] text-white/20 mt-0.5">{player.matchesWonPublic}W / {player.matchesPlayedPublic}G</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            )}
          </div>

        </div>

      </main>

      <Footer />
    </div>
  );
}
