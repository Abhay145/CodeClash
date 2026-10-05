import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import Editor from '@monaco-editor/react';
import {
  Trophy, Award, ArrowLeft, Loader2, Users, Flame, Star, Clock, Zap, Flag,
  Code2, TrendingUp, TrendingDown, Minus, BarChart3, Globe, Lock, ChevronDown, ChevronUp
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const LANG_MONACO = {
  python: 'python', py: 'python',
  cpp: 'cpp', c: 'c', java: 'java',
  javascript: 'javascript', js: 'javascript',
};

function RatingDeltaBadge({ delta, size = 'md' }) {
  const cls = size === 'lg'
    ? 'text-base font-black px-4 py-1.5 rounded-xl gap-2'
    : 'text-[0.6rem] font-extrabold px-2.5 py-1 rounded-full gap-1';
  const iconSize = size === 'lg' ? 16 : 9;
  if (delta == null) return null;
  if (delta > 0) return (
    <span className={`inline-flex items-center ${cls} text-[#00E676] bg-[#00E676]/10 border border-[#00E676]/25`}>
      <TrendingUp size={iconSize} /> +{delta}
    </span>
  );
  if (delta < 0) return (
    <span className={`inline-flex items-center ${cls} text-[#FF2E2E] bg-[#FF2E2E]/10 border border-[#FF2E2E]/25`}>
      <TrendingDown size={iconSize} /> {delta}
    </span>
  );
  return (
    <span className={`inline-flex items-center ${cls} text-white/40 bg-white/5 border border-white/10`}>
      <Minus size={iconSize} /> 0
    </span>
  );
}

function CodeBlock({ participant, profile, isMe, isTie, isWinner, winnerOf }) {
  const [expanded, setExpanded] = useState(true);
  const code = participant?.bestCode || participant?.code || '';
  const lang = participant?.language || 'python';
  const monacoLang = LANG_MONACO[lang] || lang;
  const submitCount = participant?.submitCount ?? 0;
  const solved = participant?.solved ?? false;
  const passed = participant?.testCasesPassed ?? participant?.score ?? 0;
  const label = isMe ? 'You' : (profile?.displayName || 'Opponent');

  const accentColor = isWinner && !isTie ? '#00E676'
    : isTie ? '#fbfb7a'
    : !isWinner && winnerOf ? '#FF2E2E'
    : '#c9c7ba';

  return (
    <div
      className="flex-1 min-w-0 flex flex-col rounded-2xl border overflow-hidden"
      style={{ borderColor: `${accentColor}22` }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: `${accentColor}18`, background: `${accentColor}08` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[0.65rem] font-black uppercase overflow-hidden border"
            style={{ borderColor: `${accentColor}40`, background: `${accentColor}12`, color: accentColor }}
          >
            {profile?.photoURL
              ? <img src={profile.photoURL} alt={label} className="w-full h-full object-cover" />
              : label.slice(0, 2)
            }
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-white">{label}</span>
              {isMe && <span className="text-[0.5rem] font-black uppercase tracking-wider bg-white/10 text-white/40 px-1.5 py-0.5 rounded">YOU</span>}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[0.55rem] font-bold uppercase tracking-wider" style={{ color: accentColor }}>
                {isWinner && !isTie ? '🏆 Winner' : isTie ? '🤝 Tie' : '❌ Defeated'}
              </span>
              {solved && <span className="text-[0.55rem] font-black text-[#00E676]">• Solved</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-xs font-black font-mono text-white">{passed} <span className="text-white/30 text-[0.6rem] font-sans">passed</span></span>
            <span className="text-[0.55rem] font-bold text-white/30">{submitCount} submit{submitCount !== 1 ? 's' : ''}</span>
          </div>
          <span className="text-[0.55rem] font-bold text-white/30 bg-white/5 border border-white/10 px-2 py-0.5 rounded font-mono uppercase">{lang}</span>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Code Editor (read-only) */}
      {expanded && (
        <div className="flex-1 min-h-[240px] max-h-[420px] bg-[#0d0d14]">
          {code ? (
            <Editor
              height="320px"
              language={monacoLang}
              value={code}
              theme="vs-dark"
              options={{
                readOnly: true,
                fontSize: 12,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                renderLineHighlight: 'gutter',
                wordWrap: 'on',
                tabSize: 2,
                padding: { top: 12, bottom: 12 },
                scrollbar: { verticalScrollbarSize: 4 },
              }}
            />
          ) : (
            <div className="h-[320px] flex flex-col items-center justify-center gap-2 text-white/20">
              <Code2 size={24} />
              <span className="text-xs font-bold">No code submitted</span>
              <span className="text-[0.65rem] text-white/15">Player had no active submission</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profiles, setProfiles] = useState({});

  // Subscribe to match document from matches collection
  useEffect(() => {
    if (!matchId) return;
    setLoading(true);
    const matchRef = doc(db, 'matches', matchId);
    const unsubscribe = onSnapshot(
      matchRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setError('Match data not found.');
          setLoading(false);
          return;
        }
        setMatch({ id: snapshot.id, ...snapshot.data() });
        setLoading(false);
      },
      (err) => {
        console.error('Failed to get match results:', err);
        setError('Failed to fetch match results.');
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [matchId]);

  // Fetch profiles for all participants
  useEffect(() => {
    if (!match?.participantIds?.length) return;
    async function fetchProfiles() {
      const fetched = {};
      await Promise.all(
        match.participantIds.map(async (uid) => {
          try {
            const res = await fetch(`${API_BASE}/api/users/${uid}`);
            fetched[uid] = res.ok ? await res.json() : { displayName: `Player (${uid.slice(0, 6)})` };
          } catch {
            fetched[uid] = { displayName: 'Player' };
          }
        })
      );
      setProfiles(fetched);
    }
    fetchProfiles();
  }, [match?.participantIds]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0C10] flex flex-col items-center justify-center gap-4 relative overflow-hidden">
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
          <div className="orb w-[500px] h-[500px] bg-[#9d1f15] opacity-[0.05] -top-32 -left-32 animate-float" />
          <div className="grid-bg" />
        </div>
        <Loader2 size={36} className="animate-spin text-[#9d1f15] relative z-10" />
        <p className="text-xs font-bold font-mono tracking-widest text-[#c9c7ba]/40 uppercase relative z-10">
          Loading Post-Game Analysis…
        </p>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="min-h-screen bg-[#0B0C10] flex flex-col items-center justify-center gap-6 relative overflow-hidden px-6 text-center">
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
          <div className="orb w-[500px] h-[500px] bg-[#9d1f15] opacity-[0.05] -top-32 -left-32 animate-float" />
          <div className="grid-bg" />
        </div>
        <div className="glass-card max-w-md w-full p-8 rounded-2xl border border-danger/20 relative z-10 flex flex-col items-center">
          <h2 className="text-lg font-black tracking-wider text-white mb-2 uppercase">Results Error</h2>
          <p className="text-sm text-[#c9c7ba]/65 mb-6">{error || 'Unable to display results.'}</p>
          <button onClick={() => navigate('/')} className="btn-primary w-full">
            <ArrowLeft size={14} /> Return to Arena
          </button>
        </div>
      </div>
    );
  }

  // ── Derived data ──────────────────────────────────────────────────────────────
  const isDraw = match.winnerId === 'tie';
  let resultType = 'defeat';
  if (isDraw) resultType = 'tie';
  else if (user && match.winnerId === user.uid) resultType = 'victory';

  const formatDuration = (secs) => {
    if (!secs && secs !== 0) return '—';
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const reasonConfig = {
    solved:    { label: 'Solved',    icon: <Zap size={11} />,   color: 'text-brand-green bg-brand-green/10 border-brand-green/25' },
    timeout:   { label: 'Timeout',   icon: <Clock size={11} />, color: 'text-brand-amber bg-brand-amber/10 border-brand-amber/25' },
    surrender: { label: 'Surrender', icon: <Flag size={11} />,  color: 'text-brand-red bg-brand-red/10 border-brand-red/25' },
  };
  const reason = reasonConfig[match.completionReason] ?? { label: match.completionReason ?? '—', icon: null, color: 'text-white/40 bg-white/5 border-white/10' };

  const resultConfig = {
    victory: {
      title: 'VICTORY',
      subtitle: 'Outstanding clash! You conquered the arena.',
      textColor: 'text-[#00E676]',
      glowColor: 'shadow-[#00E676]/10 border-[#00E676]/30',
      bg: 'bg-[#00E676]/[0.03]',
      icon: <Trophy size={48} className="text-[#00E676]" />,
    },
    tie: {
      title: 'TIE',
      subtitle: 'An equal match — you both fought to a standstill.',
      textColor: 'text-[#fbfb7a]',
      glowColor: 'shadow-[#fbfb7a]/10 border-[#fbfb7a]/30',
      bg: 'bg-[#fbfb7a]/[0.02]',
      icon: <Users size={48} className="text-[#fbfb7a]" />,
    },
    defeat: {
      title: 'DEFEAT',
      subtitle: "Good game! Study the code and come back stronger.",
      textColor: 'text-[#FF2E2E]',
      glowColor: 'shadow-[#FF2E2E]/10 border-[#FF2E2E]/30',
      bg: 'bg-[#FF2E2E]/[0.02]',
      icon: <Flame size={48} className="text-[#FF2E2E] animate-pulse" />,
    },
  }[resultType];

  const participantList = (match.participantIds ?? []).map((uid) => {
    const participant = (match.participants ?? []).find((p) => p.userId === uid) ?? {};
    const profile = profiles[uid] ?? {};
    const isWinner = match.winnerId === uid;
    const isMe = user?.uid === uid;
    const ratingDelta = match.ratingDelta?.[uid] ?? null;
    return { uid, participant, profile, isWinner, isMe, ratingDelta };
  });

  // Me first
  participantList.sort((a, b) => (a.isMe ? -1 : b.isMe ? 1 : 0));

  const myRatingDelta = user ? (match.ratingDelta?.[user.uid] ?? null) : null;
  const matchTypeLabel = match.matchType === 'public' ? { label: 'Public Arena', icon: <Globe size={11} /> }
    : { label: 'Private Duel', icon: <Lock size={11} /> };

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#c9c7ba] flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="orb w-[700px] h-[700px] bg-[#9d1f15] opacity-[0.05] -top-48 -left-48 animate-float" />
        <div className="orb w-[500px] h-[500px] bg-[#fbfb7a] opacity-[0.02] bottom-0 right-0" style={{ animationDelay: '-2s' }} />
        <div className="grid-bg" />
      </div>

      <main className="relative z-10 w-full max-w-5xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* ── SECTION 1: OUTCOME BANNER ── */}
        <div className={`rounded-3xl border ${resultConfig.glowColor} ${resultConfig.bg} p-8 flex flex-col items-center text-center gap-4 shadow-2xl animate-scale-up`}>
          {/* Icon */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
            {resultConfig.icon}
          </div>

          {/* Outcome title + rating delta */}
          <div className="flex flex-col items-center gap-2">
            <h1 className={`text-5xl md:text-6xl font-black tracking-widest ${resultConfig.textColor} leading-none`}>
              {resultConfig.title}
            </h1>
            <p className="text-sm text-white/40 leading-relaxed max-w-sm">{resultConfig.subtitle}</p>
          </div>

          {/* Rating delta */}
          {myRatingDelta != null && (
            <RatingDeltaBadge delta={myRatingDelta} size="lg" />
          )}

          {/* Meta badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            <span className={`inline-flex items-center gap-1 text-[0.6rem] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${reason.color}`}>
              {reason.icon} {reason.label}
            </span>
            {match.durationSeconds != null && (
              <span className="inline-flex items-center gap-1 text-[0.6rem] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border text-white/50 bg-white/[0.03] border-white/10">
                <Clock size={11} /> {formatDuration(match.durationSeconds)}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[0.6rem] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border text-white/40 bg-white/[0.02] border-white/[0.05]">
              {matchTypeLabel.icon} {matchTypeLabel.label}
            </span>
          </div>
        </div>

        {/* ── SECTION 2: PLAYER COMPARISON CARDS ── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={14} className="text-[#9d1f15]" />
            <h2 className="text-xs font-black uppercase tracking-widest text-white/50">Player Comparison</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {participantList.map(({ uid, participant, profile, isWinner, isMe, ratingDelta }) => {
              const label = isMe ? 'You' : (profile?.displayName || uid.slice(0, 8));
              const passed = participant?.testCasesPassed ?? participant?.score ?? 0;
              const submitCount = participant?.submitCount ?? 0;
              const cardAccent = isWinner && !isDraw ? '#00E676'
                : isDraw ? '#fbfb7a'
                : '#FF2E2E';

              return (
                <div
                  key={uid}
                  className="glass-card rounded-2xl p-5 flex flex-col gap-4 border"
                  style={{ borderColor: `${cardAccent}22`, background: `${cardAccent}04` }}
                >
                  {/* Player header */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black uppercase overflow-hidden border"
                      style={{ borderColor: `${cardAccent}40`, background: `${cardAccent}12` }}
                    >
                      {profile?.photoURL
                        ? <img src={profile.photoURL} alt={label} className="w-full h-full object-cover" />
                        : <span style={{ color: cardAccent }}>{label.slice(0, 2)}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white truncate">{label}</span>
                        {isMe && <span className="text-[0.5rem] font-black uppercase tracking-wider bg-white/10 text-white/40 px-1.5 py-0.5 rounded">YOU</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[0.55rem] font-black uppercase" style={{ color: cardAccent }}>
                          {isWinner && !isDraw ? '🏆 Winner' : isDraw ? '🤝 Tie' : '❌ Defeated'}
                        </span>
                        {profile?.rating && (
                          <span className="text-[0.55rem] font-mono text-white/30">• {profile.rating} ELO</span>
                        )}
                      </div>
                    </div>
                    {ratingDelta != null && <RatingDeltaBadge delta={ratingDelta} />}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Tests Passed', value: passed, highlight: true },
                      { label: 'Submissions', value: submitCount, highlight: false },
                      { label: 'Status', value: participant?.solved ? 'Solved' : participant?.surrendered ? 'Surrendered' : 'Timed Out', highlight: false, small: true },
                    ].map((s) => (
                      <div key={s.label} className="flex flex-col items-center bg-white/[0.02] border border-white/[0.04] rounded-xl py-2.5 px-2">
                        <span className={`text-base font-black font-mono leading-none ${s.highlight ? '' : 'text-white'}`} style={s.highlight ? { color: cardAccent } : {}}>
                          {s.small ? (
                            <span className="text-[0.6rem] font-extrabold uppercase tracking-wide">
                              {s.value}
                            </span>
                          ) : s.value}
                        </span>
                        <span className="text-[0.5rem] font-bold uppercase tracking-wider text-white/25 mt-1">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── SECTION 3: CODE COMPARISON ── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Code2 size={14} className="text-[#9d1f15]" />
            <h2 className="text-xs font-black uppercase tracking-widest text-white/50">Code Comparison</h2>
            <span className="text-[0.55rem] font-bold text-white/20 bg-white/5 px-2 py-0.5 rounded">Read Only</span>
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
            {participantList.map(({ uid, participant, profile, isWinner, isMe }) => (
              <CodeBlock
                key={uid}
                participant={participant}
                profile={profile}
                isMe={isMe}
                isTie={isDraw}
                isWinner={isWinner}
                winnerOf={!isDraw ? match.winnerId : null}
              />
            ))}
          </div>
        </div>

        {/* ── SECTION 4: MATCH FOOTER ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white/[0.01] border border-white/[0.04] rounded-2xl px-6 py-4">
          <div className="flex items-center gap-2 text-white/30">
            <Star size={13} className="text-[#fbfb7a]" />
            <span className="text-xs font-bold">Problem: </span>
            <span className="text-xs font-mono text-white/60">{match.problemId ?? '—'}</span>
          </div>
          {match.roomCode && (
            <div className="flex items-center gap-2 text-white/30">
              <span className="text-xs font-bold">Room: </span>
              <span className="text-xs font-mono text-white/60">{match.roomCode}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/matches')}
              className="btn-outline px-5 py-2 text-xs font-bold flex items-center gap-1.5"
            >
              <Award size={12} /> Match History
            </button>
            <button
              onClick={() => navigate('/')}
              className="btn-primary px-6 py-2 text-xs font-bold flex items-center gap-1.5"
            >
              <ArrowLeft size={12} /> Back to Arena
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}
