import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import codeDuelLogo from '../assets/code_duel_logo.png';
import {
  Sword, ArrowLeft, CheckCircle, XCircle, Clock, AlertCircle,
  Loader2, BarChart2, Filter, RefreshCw, LogOut, FileCode2, Home
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/* ── helpers ─────────────────────────────────────────────── */
function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/* ── Verdict config ──────────────────────────────────────── */
const VERDICT_CONFIG = {
  'Accepted':              { color: 'text-brand-green', bg: 'bg-brand-green/10', border: 'border-brand-green/20', icon: CheckCircle },
  'Wrong Answer':          { color: 'text-brand-red',   bg: 'bg-brand-red/10',   border: 'border-brand-red/20',   icon: XCircle    },
  'Time Limit Exceeded':   { color: 'text-brand-amber', bg: 'bg-brand-amber/10', border: 'border-brand-amber/20', icon: Clock      },
  'Compilation Error':     { color: 'text-brand-pink',  bg: 'bg-brand-pink/10',  border: 'border-brand-pink/20',  icon: AlertCircle },
  'Runtime Error':         { color: 'text-brand-pink',  bg: 'bg-brand-pink/10',  border: 'border-brand-pink/20',  icon: AlertCircle },
  'Internal Error':        { color: 'text-white/40',    bg: 'bg-white/5',        border: 'border-white/10',        icon: AlertCircle },
};

function verdictCfg(verdict) {
  return VERDICT_CONFIG[verdict] ?? {
    color: 'text-white/50', bg: 'bg-white/5', border: 'border-white/10', icon: AlertCircle,
  };
}

const FILTERS = ['All', 'Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Other'];

/* ── Skeleton loader ─────────────────────────────────────── */
function SubmissionSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.04] animate-pulse">
      <div className="w-24 h-5 rounded-lg bg-white/5" />
      <div className="flex-1 h-4 rounded-lg bg-white/5" />
      <div className="w-16 h-4 rounded-lg bg-white/5" />
      <div className="w-20 h-4 rounded-lg bg-white/5" />
    </div>
  );
}

/* ── Stat card ───────────────────────────────────────────── */
function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`glass-card rounded-2xl p-5 flex flex-col gap-1 ${accent ? 'border-brand-purple/15' : ''}`}>
      <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-white/30">{label}</span>
      <span className={`text-3xl font-black tracking-tight ${accent || 'text-white'}`}>{value}</span>
      {sub && <span className="text-[0.65rem] text-white/30 mt-0.5">{sub}</span>}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────── */
export default function SubmissionsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [filter, setFilter]           = useState('All');
  const [refreshKey, setRefreshKey]   = useState(0);

  /* ── Fetch ── */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const idToken = await user.getIdToken();
        const res  = await fetch(`${API_BASE}/api/submissions`, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (!cancelled) setSubmissions(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user, refreshKey]);

  /* ── Stats ── */
  const stats = useMemo(() => {
    const total    = submissions.length;
    const accepted = submissions.filter(s => s.verdict === 'Accepted').length;
    const rate     = total ? Math.round((accepted / total) * 100) : 0;
    return { total, accepted, rate };
  }, [submissions]);

  /* ── Verdict breakdown (sorted by count) ── */
  const breakdown = useMemo(() => {
    const counts = {};
    submissions.forEach(s => { counts[s.verdict] = (counts[s.verdict] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [submissions]);

  /* ── Filtered list ── */
  const filtered = useMemo(() => {
    if (filter === 'All') return submissions;
    if (filter === 'Other') {
      return submissions.filter(s =>
        !['Accepted', 'Wrong Answer', 'Time Limit Exceeded'].includes(s.verdict)
      );
    }
    return submissions.filter(s => s.verdict === filter);
  }, [submissions, filter]);

  return (
    <div className="min-h-screen bg-bg-space text-white flex flex-col">

      {/* Ambient orbs */}
      <div className="orb w-[400px] h-[400px] bg-brand-purple/6 -top-20 -left-20 fixed" />
      <div className="orb w-[300px] h-[300px] bg-brand-cyan/5 bottom-0 right-0 fixed" />
      <div className="grid-bg fixed inset-0" />

      {/* ── Nav ── */}
      <nav className="glass-nav flex items-center justify-between px-5 py-3 relative z-20 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm font-black bg-transparent border-0 cursor-pointer text-white"
          >
            <img src={codeDuelLogo} alt="CodeDuel Logo" className="w-5 h-5 object-contain" />
            <span className="hidden sm:inline">CodeDuel</span>
          </button>
          <div className="h-4 w-px bg-white/10" />
          <h1 className="text-sm font-bold text-white/70 flex items-center gap-2">
            <BarChart2 size={14} className="text-brand-violet" />
            My Submissions
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* User info */}
          <div className="hidden sm:flex items-center gap-2 bg-bg-panel border border-white/[0.05] rounded-xl px-3 py-1.5">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="w-5 h-5 rounded-full" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-brand-purple/30 flex items-center justify-center text-[0.55rem] font-bold text-brand-violet">
                {(user?.displayName || user?.email || '?')[0].toUpperCase()}
              </div>
            )}
            <span className="text-[0.65rem] font-semibold text-white/50">
              {user?.displayName || user?.email?.split('@')[0]}
            </span>
          </div>

          <button
            onClick={() => navigate('/duel')}
            className="btn-primary py-1.5 px-3.5 text-xs"
          >
            <Sword size={12} /> New Duel
          </button>

          <button
            onClick={async () => { await logout(); navigate('/auth'); }}
            title="Sign out"
            className="p-2 rounded-xl border border-white/[0.05] bg-bg-panel text-white/25 hover:text-brand-red hover:border-brand-red/25 transition-colors"
          >
            <LogOut size={13} />
          </button>
        </div>
      </nav>

      {/* ── Body ── */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 relative z-10 flex flex-col gap-6">
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

        {/* ── Stats row ── */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Submissions" value={stats.total} />
          <StatCard label="Accepted"     value={stats.accepted} accent="text-brand-green" />
          <StatCard label="Success Rate" value={`${stats.rate}%`} sub={`${stats.accepted} of ${stats.total} accepted`} />
        </div>

        {/* ── Verdict breakdown bar ── */}
        {submissions.length > 0 && (
          <div className="glass-card rounded-2xl p-5 space-y-3">
            <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-white/30">
              Verdict Breakdown
            </p>
            {breakdown.map(([verdict, count]) => {
              const cfg = verdictCfg(verdict);
              const pct = Math.round((count / stats.total) * 100);
              return (
                <div key={verdict} className="flex items-center gap-3">
                  <span className={`text-[0.65rem] font-bold w-36 flex-shrink-0 ${cfg.color}`}>
                    {verdict}
                  </span>
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${cfg.color.replace('text-', 'bg-')} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[0.65rem] font-bold text-white/30 w-12 text-right">
                    {count} <span className="font-normal opacity-60">({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Filter tabs + refresh ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1 bg-bg-panel border border-white/[0.05] rounded-xl p-1">
            <Filter size={11} className="text-white/20 ml-2" />
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[0.6rem] font-bold px-2.5 py-1 rounded-lg transition-all ${
                  filter === f
                    ? 'bg-brand-purple/20 text-brand-violet border border-brand-purple/25'
                    : 'text-white/35 hover:text-white/60'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            disabled={loading}
            className="flex items-center gap-1.5 text-[0.65rem] font-semibold text-white/30 hover:text-white/60 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* ── Submissions list ── */}
        <div className="flex flex-col gap-2">

          {/* Loading */}
          {loading && Array.from({ length: 5 }).map((_, i) => (
            <SubmissionSkeleton key={i} />
          ))}

          {/* Error */}
          {!loading && error && (
            <div className="flex items-center gap-3 glass-card rounded-2xl p-6 text-brand-red/80">
              <AlertCircle size={18} className="flex-shrink-0" />
              <div>
                <p className="text-sm font-bold">Failed to load submissions</p>
                <p className="text-xs opacity-70 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-brand-purple/10 border border-brand-purple/15 flex items-center justify-center">
                <FileCode2 size={22} className="text-brand-violet/50" />
              </div>
              <div>
                <p className="text-sm font-bold text-white/50">
                  {filter === 'All' ? 'No submissions yet' : `No "${filter}" submissions`}
                </p>
                <p className="text-xs text-white/25 mt-1">
                  {filter === 'All'
                    ? 'Submit a solution from the Duel page to see it here.'
                    : 'Try a different filter.'}
                </p>
              </div>
              {filter === 'All' && (
                <button onClick={() => navigate('/duel')} className="btn-primary py-2 px-5 text-xs mt-2">
                  <Sword size={12} /> Start a Duel
                </button>
              )}
            </div>
          )}

          {/* Rows */}
          {!loading && !error && filtered.map((s) => {
            const cfg = verdictCfg(s.verdict);
            const VerdictIcon = cfg.icon;
            const pct = s.total > 0 ? Math.round((s.passed / s.total) * 100) : 0;

            return (
              <div
                key={s.id}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border ${cfg.border} bg-bg-panel hover:bg-bg-element transition-colors animate-fade-in`}
              >
                {/* Verdict badge */}
                <div className={`flex items-center gap-1.5 min-w-[140px] ${cfg.color}`}>
                  <VerdictIcon size={13} className="flex-shrink-0" />
                  <span className="text-xs font-bold truncate">{s.verdict}</span>
                </div>

                {/* Problem slug */}
                <code className="flex-1 font-mono-code text-[0.7rem] text-white/40 truncate">
                  {s.problemId}
                </code>

                {/* Pass ratio + mini bar */}
                <div className="flex items-center gap-2 min-w-[100px]">
                  <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${cfg.color.replace('text-', 'bg-')}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[0.65rem] font-bold text-white/40 tabular-nums">
                    {s.passed}/{s.total}
                  </span>
                </div>

                {/* Time */}
                <div className="text-right min-w-[80px]">
                  <p className="text-[0.65rem] font-semibold text-white/25">{timeAgo(s.submittedAt)}</p>
                  <p className="text-[0.55rem] text-white/15 mt-0.5">{formatDate(s.submittedAt)}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Count footer */}
        {!loading && filtered.length > 0 && (
          <p className="text-center text-[0.6rem] text-white/20 pb-4">
            Showing {filtered.length} submission{filtered.length !== 1 ? 's' : ''}
            {filter !== 'All' ? ` · filtered by "${filter}"` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
