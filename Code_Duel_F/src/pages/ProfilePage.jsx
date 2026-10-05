import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import NotFoundPage from './NotFoundPage';
import {
  ArrowLeft, Trophy, Sword, Shield, TrendingUp, Activity,
  Star, Award, Target, Zap, Users, Globe, Lock, UserPlus,
  UserCheck, Clock, BarChart2, Loader2, Home, Pencil, Check, X
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// ─── Tier helper ─────────────────────────────────────────────────────────────
function getTier(rating) {
  const r = rating ?? 0;
  if (r >= 2200) return { label: 'Crimson GM', color: '#FF2E2E', bg: 'rgba(255,46,46,0.12)', border: 'rgba(255,46,46,0.35)', icon: '👑' };
  if (r >= 1800) return { label: 'Master',     color: '#fbfb7a', bg: 'rgba(251,251,122,0.1)', border: 'rgba(251,251,122,0.3)', icon: '⚡' };
  if (r >= 1400) return { label: 'Diamond',    color: '#00E5FF', bg: 'rgba(0,229,255,0.1)',   border: 'rgba(0,229,255,0.3)',   icon: '💎' };
  if (r >= 1000) return { label: 'Gold',       color: '#FFB000', bg: 'rgba(255,176,0,0.1)',   border: 'rgba(255,176,0,0.3)',   icon: '🏅' };
  return              { label: 'Bronze',      color: '#a87940', bg: 'rgba(168,121,64,0.1)',  border: 'rgba(168,121,64,0.3)',  icon: '🪙' };
}

// ─── Mini SVG Sparkline (uses rating as proxy for progress) ──────────────────
function Sparkline({ wins, played }) {
  if (!played) return <div className="h-10 flex items-center"><span className="text-[0.55rem] text-white/20">No data</span></div>;
  const pts = Array.from({ length: 7 }, (_, i) => {
    const base = (wins / played) * 100;
    return Math.max(5, Math.min(95, base + (Math.sin(i * 1.3 + wins) * 12)));
  });
  const W = 120, H = 40;
  const xStep = W / (pts.length - 1);
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${i * xStep},${H - (p / 100) * H}`).join(' ');
  const fill = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${i * xStep},${H - (p / 100) * H}`).join(' ') +
    ` L${(pts.length - 1) * xStep},${H} L0,${H} Z`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9d1f15" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#9d1f15" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#sg)" />
      <path d={d} stroke="#9d1f15" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(pts.length - 1) * xStep} cy={H - (pts[pts.length - 1] / 100) * H} r="3" fill="#fbfb7a" />
    </svg>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color = '#9d1f15' }) {
  return (
    <div
      className="flex flex-col p-4 rounded-2xl relative overflow-hidden transition-transform hover:scale-[1.02]"
      style={{ background: `${color}0d`, border: `1px solid ${color}2a` }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[0.6rem] font-black uppercase tracking-widest text-white/40">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon size={13} style={{ color }} />
        </div>
      </div>
      <span className="text-2xl font-black font-mono text-white leading-none">{value}</span>
      {sub && <span className="text-[0.6rem] text-white/30 font-mono mt-1.5">{sub}</span>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  // isOwnProfile: compare to loaded profile uid (handles username-based routing)
  const isOwnProfile = user?.uid === (profile?.uid || uid);

  // ── Redirect /users/uid (or /profile/...) to /users/username if username exists ──
  useEffect(() => {
    if (profile && profile.username) {
      const targetPath = `/users/${profile.username}`;
      if (location.pathname !== targetPath) {
        navigate(targetPath, { replace: true });
      }
    }
  }, [profile, location.pathname, navigate]);

  // Friend state (only relevant when logged in and viewing someone else)
  const [friends,    setFriends]    = useState([]);
  const [pending,    setPending]    = useState([]);
  const [sending,    setSending]    = useState(false);
  const [friendMsg,  setFriendMsg]  = useState('');

  // Edit profile state (own profile only)
  const [editOpen,    setEditOpen]    = useState(false);
  const [editName,    setEditName]    = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editSaving,  setEditSaving]  = useState(false);
  const [editError,   setEditError]   = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [uAvail,  setUAvail]  = useState(null);  // null | true | false
  const [uChecking, setUChecking] = useState(false);
  const [uFmtErr,   setUFmtErr]   = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true); setNotFound(false);
      try {
        const res = await fetch(`${API_BASE}/api/users/${uid}`);
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok) throw new Error('fetch failed');
        setProfile(await res.json());
      } catch { setNotFound(true); }
      finally { setLoading(false); }
    };
    load();
  }, [uid]);
  // ── Username availability check (debounced 600ms) ──
  const validateUFmt = (v) => {
    if (!v) return 'Required.';
    if (v.length < 3) return 'At least 3 characters.';
    if (v.length > 20) return 'Max 20 characters.';
    if (!/^[a-z0-9_]+$/.test(v)) return 'Only a-z, 0-9, _';
    return '';
  };

  const checkUAvail = useCallback((val) => {
    clearTimeout(debounceRef.current);
    setUAvail(null);
    const fmt = validateUFmt(val);
    if (fmt) return;
    if (val === profile?.username) { setUAvail(true); return; } // unchanged
    setUChecking(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/users/check-username/${encodeURIComponent(val)}`);
        const d = await r.json();
        setUAvail(d.available);
        if (!d.available) setUFmtErr('Username already taken.');
        else setUFmtErr('');
      } catch { setUAvail(null); }
      finally { setUChecking(false); }
    }, 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.username]);

  // ── Save handler ──
  const saveProfile = async () => {
    const fmt = validateUFmt(editUsername);
    if (fmt) { setUFmtErr(fmt); return; }
    if (uAvail === false) { setEditError('Username already taken.'); return; }

    setEditSaving(true); setEditError(''); setEditSuccess('');
    try {
      const tok = await user.getIdToken();
      const res = await fetch(`${API_BASE}/api/users/profile`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({
          displayName: editName.trim() || undefined,
          username:    editUsername    || undefined,
        }),
      });
      const data = await res.json();
      if (res.status === 409) { setEditError('Username already taken.'); return; }
      if (!res.ok) { setEditError(data.error || 'Save failed.'); return; }
      // Update local profile state
      setProfile(p => ({ ...p, ...data.updated }));
      setEditSuccess('Profile updated!');
      setTimeout(() => { setEditOpen(false); setEditSuccess(''); }, 1500);
    } catch (err) {
      setEditError(err.message || 'Network error.');
    } finally {
      setEditSaving(false);
    }
  };

  useEffect(() => {
    if (!user || isOwnProfile) return;
    const load = async () => {
      try {
        const tok = await user.getIdToken();
        const h   = { Authorization: `Bearer ${tok}` };
        const [fRes, pRes] = await Promise.all([
          fetch(`${API_BASE}/api/users/friends`,         { headers: h }),
          fetch(`${API_BASE}/api/users/friends/pending`, { headers: h }),
        ]);
        if (fRes.ok) setFriends((await fRes.json()).map(f => f.uid));
        if (pRes.ok) setPending((await pRes.json()).map(r => r.fromUid));
      } catch { /* silent */ }
    };
    load();
  }, [user, uid]);

  const sendRequest = async () => {
    if (!user) { navigate('/auth'); return; }
    setSending(true); setFriendMsg('');
    try {
      const tok = await user.getIdToken();
      const res = await fetch(`${API_BASE}/api/users/friends/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ email: profile.email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setFriendMsg('✓ Request sent!');
      setPending(p => [...p, uid]);
    } catch (err) { setFriendMsg(err.message); }
    finally { setSending(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0B0C10] flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <Loader2 size={32} className="animate-spin text-[#9d1f15]" />
        <span className="text-xs font-bold uppercase tracking-widest text-white/30">Loading Profile…</span>
      </div>
    </div>
  );

  if (notFound) return (
    <NotFoundPage message="We couldn't find any user with that username or UID. Check the URL and try again." />
  );

  const tier     = getTier(profile?.rating);
  const rating   = profile?.rating ?? 1000;
  const played   = profile?.matchesPlayedPublic ?? 0;
  const won      = profile?.matchesWonPublic ?? 0;
  const lost     = profile?.matchesLostPublic ?? 0;
  const winRate  = played ? Math.round((won / played) * 100) : 0;
  const privWon  = profile?.matchesWonPrivate  ?? 0;
  const privLost = profile?.matchesLostPrivate ?? 0;

  // Rank progression within current tier
  const TIER_RANGES = [
    { min: 0,    max: 999,  label: 'Bronze'     },
    { min: 1000, max: 1399, label: 'Gold'       },
    { min: 1400, max: 1799, label: 'Diamond'    },
    { min: 1800, max: 2199, label: 'Master'     },
    { min: 2200, max: 9999, label: 'Crimson GM' },
  ];
  const currentRange = TIER_RANGES.find(t => rating >= t.min && rating <= t.max) || TIER_RANGES[0];
  const tierProgressPct = currentRange.max === 9999
    ? 100
    : Math.round(((rating - currentRange.min) / (currentRange.max - currentRange.min)) * 100);
  const nextThreshold  = TIER_RANGES.find(t => t.min > rating)?.min ?? null;

  // isOwnProfile: compare to loaded profile uid (handles username-based routing)
  // Open edit panel pre-filled with current values
  const openEdit = () => {
    setEditName(profile?.displayName || '');
    setEditUsername(profile?.username || '');
    setUAvail(null);
    setUFmtErr('');
    setEditError('');
    setEditSuccess('');
    setEditOpen(true);
  };

  const isFriend  = friends.includes(profile?.uid || uid);
  const isPending = pending.includes(profile?.uid || uid);
  const initials  = (profile?.displayName || profile?.email || 'CD').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#0B0C10] text-white flex flex-col relative overflow-x-hidden">

      {/* ── Background ── */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-[0.05] blur-3xl animate-pulse" style={{ background: tier.color }} />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-[0.03] blur-3xl" style={{ background: '#9d1f15' }} />
        {/* Diagonal grid lines */}
        <div className="grid-bg opacity-40" />
      </div>

      {/* ── Navbar ── */}
      <div className="relative z-20">
        <Navbar />
      </div>

      <main className="relative z-10 flex-1 max-w-4xl mx-auto w-full px-4 md:px-6 py-6 flex flex-col gap-6 animate-fade-up">

        {/* Navigation Buttons */}
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

        {/* ── HERO CARD ── */}
        <div
          className="rounded-3xl p-6 md:p-8 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${tier.bg}, rgba(11,12,16,0.95))`,
            border: `1px solid ${tier.border}`,
            boxShadow: `0 0 80px ${tier.color}12, 0 20px 60px rgba(0,0,0,0.5)`,
          }}
        >
          {/* Top glow line */}
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${tier.color}88, transparent)` }} />

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">

            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div
                className="w-24 h-24 md:w-28 md:h-28 rounded-3xl flex items-center justify-center text-3xl font-black text-white overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${tier.color}33, ${tier.color}11)`,
                  border: `3px solid ${tier.color}66`,
                  boxShadow: `0 0 30px ${tier.color}30, inset 0 0 20px ${tier.color}0a`,
                }}
              >
                {profile?.photoURL
                  ? <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
                  : initials
                }
              </div>
              {/* Tier icon badge */}
              <div
                className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl flex items-center justify-center text-base border-2"
                style={{ background: '#0B0C10', borderColor: tier.color + '44' }}
              >
                {tier.icon}
              </div>
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h1 className="text-2xl md:text-3xl font-black text-white leading-none">
                  {profile?.displayName || profile?.email?.split('@')[0] || 'Unknown'}
                </h1>
                {isOwnProfile && (
                  <span className="text-[0.55rem] font-black uppercase tracking-widest px-2 py-1 rounded-lg" style={{ background: `${tier.color}22`, color: tier.color, border: `1px solid ${tier.color}44` }}>
                    You
                  </span>
                )}
              </div>
              {profile?.username && (
                <p className="text-[0.7rem] text-white/30 font-mono mb-2">@{profile.username}</p>
              )}

              {/* Rank badge + ELO */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span
                  className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-xl"
                  style={{ background: tier.bg, color: tier.color, border: `1px solid ${tier.border}` }}
                >
                  {tier.icon} {tier.label}
                </span>
                <span className="text-xl font-black font-mono" style={{ color: tier.color }}>
                  {profile?.rating ?? 1000}
                  <span className="text-xs font-bold text-white/30 ml-1">ELO</span>
                </span>
              </div>

              {/* Sparkline + label */}
              <div className="flex items-end gap-4">
                <div>
                  <div className="text-[0.55rem] uppercase tracking-widest text-white/25 font-bold mb-1">Performance</div>
                  <Sparkline wins={won} played={played} />
                </div>
                <div className="pb-1">
                  <div className="text-[0.55rem] text-white/25 uppercase tracking-wider mb-0.5">Win Rate</div>
                  <div className="text-2xl font-black font-mono" style={{ color: winRate >= 50 ? '#00E676' : '#FF2E2E' }}>
                    {winRate}%
                  </div>
                </div>
              </div>
            </div>

            {/* Friend action (not own profile) */}
            {!isOwnProfile && user && (
              <div className="flex-shrink-0">
                {isFriend ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-green-400"
                    style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)' }}>
                    <UserCheck size={14} /> Friends
                  </div>
                ) : isPending ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-yellow-300"
                    style={{ background: 'rgba(251,251,122,0.08)', border: '1px solid rgba(251,251,122,0.2)' }}>
                    <Clock size={14} /> Pending
                  </div>
                ) : (
                  <button
                    onClick={sendRequest}
                    disabled={sending}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:scale-105 disabled:opacity-60"
                    style={{ background: `${tier.color}22`, border: `1px solid ${tier.color}44`, color: tier.color }}
                  >
                    {sending ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                    Add Friend
                  </button>
                )}
                {friendMsg && (
                  <p className="text-[0.6rem] font-bold text-center mt-2 text-white/40">{friendMsg}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── STATS GRID ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Matches Played" value={played}   sub="Public ranked"             icon={Activity}  color="#00E5FF" />
          <StatCard label="Victories"       value={won}     sub={`${winRate}% success rate`} icon={Trophy}    color="#FFB000" />
          <StatCard label="Defeats"         value={lost}    sub="Keep grinding"              icon={Sword}     color="#FF2E2E" />
          <StatCard label="Current Rating"  value={profile?.rating ?? 1000} sub={tier.label} icon={TrendingUp} color={tier.color} />
        </div>

        {/* ── SECONDARY STATS ROW ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

          {/* Private record */}
          <div className="p-5 rounded-2xl flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.2)' }}>
              <Lock size={16} className="text-cyan-400" />
            </div>
            <div>
              <div className="text-[0.6rem] uppercase tracking-widest text-white/30 font-bold mb-1">Private Record</div>
              <div className="font-mono font-black text-white text-sm">
                <span className="text-green-400">{privWon}W</span>
                <span className="text-white/20 mx-1">–</span>
                <span className="text-red-400">{privLost}L</span>
              </div>
            </div>
          </div>

          {/* Total matches */}
          <div className="p-5 rounded-2xl flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(157,31,21,0.1)', border: '1px solid rgba(157,31,21,0.2)' }}>
              <Globe size={16} className="text-red-400" />
            </div>
            <div>
              <div className="text-[0.6rem] uppercase tracking-widest text-white/30 font-bold mb-1">Total Matches</div>
              <div className="font-mono font-black text-white text-sm">
                {(played + (profile?.matchesPlayedPrivate ?? 0))} games
              </div>
            </div>
          </div>

          {/* Joined */}
          <div className="p-5 rounded-2xl flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.2)' }}>
              <Star size={16} className="text-green-400" />
            </div>
            <div>
              <div className="text-[0.6rem] uppercase tracking-widest text-white/30 font-bold mb-1">Member Since</div>
              <div className="font-mono font-black text-white text-sm">
                {profile?.createdAt?.seconds
                  ? new Date(profile.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  : '—'
                }
              </div>
            </div>
          </div>
        </div>

        {/* ── RANK PROGRESSION BAR ── */}
        <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-black uppercase tracking-wider text-white/40 flex items-center gap-2">
              <BarChart2 size={13} /> Rank Progression
            </span>
            <span className="text-[0.6rem] font-mono text-white/25">
              Next: {profile?.rating >= 2200 ? 'MAX' : [1000, 1400, 1800, 2200].find(t => t > (profile?.rating ?? 0)) ?? 'MAX'} ELO
            </span>
          </div>

          {/* Tier track */}
          <div className="flex items-center gap-2 mb-3">
            {[
              { label: 'Bronze',  min: 0,    max: 999,  color: '#a87940' },
              { label: 'Gold',    min: 1000, max: 1399, color: '#FFB000' },
              { label: 'Diamond', min: 1400, max: 1799, color: '#00E5FF' },
              { label: 'Master',  min: 1800, max: 2199, color: '#fbfb7a' },
              { label: 'GM',      min: 2200, max: 9999, color: '#FF2E2E' },
            ].map(({ label, min, max, color }) => {
              const r   = profile?.rating ?? 0;
              const cur = r >= min && r <= max;
              const done = r > max;
              return (
                <div key={label} className="flex-1">
                  <div className="h-1.5 rounded-full mb-1.5 transition-all" style={{ background: done ? color : cur ? `${color}88` : `${color}22` }} />
                  <div className="text-[0.45rem] text-center uppercase tracking-wider font-bold" style={{ color: cur ? color : 'rgba(255,255,255,0.2)' }}>{label}</div>
                </div>
              );
            })}
          </div>

          {/* Current ELO progress within tier */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${tierProgressPct}%`,
                  background: `linear-gradient(90deg, ${tier.color}88, ${tier.color})`,
                  boxShadow: `0 0 10px ${tier.color}44`,
                }}
              />
            </div>
            <span className="text-[0.6rem] font-mono font-black text-white/40 flex-shrink-0">
              {rating} / {nextThreshold ?? '∞'}
            </span>
          </div>
        </div>

        {/* ── PERFORMANCE OVERVIEW ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Pub W',  value: won,      color: '#00E676', icon: '✓' },
            { label: 'Pub L',  value: lost,     color: '#FF2E2E', icon: '✗' },
            { label: 'Priv W', value: privWon,  color: '#00E5FF', icon: '✓' },
            { label: 'Priv L', value: privLost, color: '#FF6B6B', icon: '✗' },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="p-4 rounded-2xl text-center" style={{ background: `${color}08`, border: `1px solid ${color}22` }}>
              <div className="text-2xl mb-1" style={{ color }}>{icon}</div>
              <div className="text-xl font-black font-mono text-white">{value}</div>
              <div className="text-[0.55rem] uppercase tracking-widest font-bold mt-1" style={{ color }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── EDIT PROFILE (own profile only) ── */}
        {isOwnProfile && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {/* Header / toggle */}
            <button
              onClick={() => editOpen ? setEditOpen(false) : openEdit()}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-all cursor-pointer"
            >
              <span className="text-xs font-black uppercase tracking-wider text-white/40 flex items-center gap-2">
                <Pencil size={12} /> Edit Profile
              </span>
              <span className="text-white/20 text-xs">{editOpen ? '▲' : '▼'}</span>
            </button>

            {editOpen && (
              <div className="px-5 pb-5 flex flex-col gap-4 border-t border-white/[0.04]">

                {/* Display Name */}
                <div className="space-y-1.5 pt-4">
                  <label className="text-[0.6rem] font-extrabold text-white/30 uppercase tracking-widest block">Display Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={50}
                    placeholder="Your display name"
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-white/20 transition-all"
                  />
                </div>

                {/* Username */}
                <div className="space-y-1.5">
                  <label className="text-[0.6rem] font-extrabold text-white/30 uppercase tracking-widest block">Username</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm pointer-events-none">@</span>
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(e) => {
                        const v = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                        setEditUsername(v);
                        const fmt = validateUFmt(v);
                        setUFmtErr(fmt);
                        setUAvail(null);
                        if (!fmt) checkUAvail(v);
                      }}
                      maxLength={20}
                      placeholder="your_username"
                      className={`w-full bg-white/[0.03] rounded-xl pl-8 pr-8 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-all border ${
                        uAvail === true  ? 'border-green-500/40' :
                        uAvail === false ? 'border-red-500/40'   :
                        'border-white/[0.06] focus:border-white/20'
                      }`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      {uChecking && <Loader2 size={11} className="animate-spin text-white/30" />}
                      {!uChecking && uAvail === true  && <Check size={11} className="text-green-400" />}
                      {!uChecking && uAvail === false && <X    size={11} className="text-red-400"   />}
                    </div>
                  </div>
                  {uFmtErr ? (
                    <p className="text-[0.55rem] text-red-400 font-semibold">{uFmtErr}</p>
                  ) : uAvail === true && editUsername !== profile?.username ? (
                    <p className="text-[0.55rem] text-green-400 font-semibold">✓ Available</p>
                  ) : (
                    <p className="text-[0.55rem] text-white/20">3–20 chars · a-z · 0-9 · _</p>
                  )}
                </div>

                {/* Feedback */}
                {editError   && <p className="text-[0.65rem] text-red-400 font-semibold">{editError}</p>}
                {editSuccess && <p className="text-[0.65rem] text-green-400 font-semibold">{editSuccess}</p>}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={saveProfile}
                    disabled={editSaving || uChecking || uAvail === false || !!uFmtErr}
                    className="flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-[#9d1f15] hover:bg-[#b02218] disabled:opacity-40 transition-all cursor-pointer"
                  >
                    {editSaving ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => setEditOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white/40 hover:text-white/70 border border-white/[0.06] hover:border-white/20 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
