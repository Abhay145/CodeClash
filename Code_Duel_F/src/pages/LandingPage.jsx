import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Sword, Users, Code2, Trophy, Activity, ChevronDown,
  User, TrendingUp, BarChart2, Eye, BookOpen,
  Terminal, Sparkles, Loader2
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Header from '../components/Header';
import Footer from '../components/Footer';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const STATS = [
  { value: '25K+', label: 'Duels Fought',   icon: Sword },
  { value: '8.4K', label: 'Active Coders',  icon: Users },
  { value: '1.2K+',label: 'Challenges',     icon: Code2 },
  { value: '99.9%',label: 'Match Success',  icon: Activity },
];

const FEATURE_EXPLORER = [
  { id: 'battle',   title: '1v1 Battle Arena',          subtitle: 'Competitive coding meets esports mechanics.',     icon: Sword,    badge: 'Core Feature'  },
  { id: 'practice', title: 'Solo Practice & Problems',  subtitle: '1,200+ curated algorithmic tasks.',               icon: BookOpen, badge: 'Offline Mode'  },
  { id: 'ranked',   title: 'Glicko-2 Ranked Ladder',   subtitle: 'Calibrated competitive matchmaking tiers.',       icon: Trophy,   badge: 'Global Leagues' },
  { id: 'profile',  title: 'Deep Analytics Dashboard',  subtitle: 'Skill breakdowns, win rates, and rating charts.', icon: BarChart2,badge: 'Stats Engine'  },
];

const MOCK_LIVE_MATCHES = [
  { id: 1, p1: 'hyperion', p1Rating: 2150, p1Progress: 85, p2: 'cyber_sensei', p2Rating: 2095, p2Progress: 76, lang: 'Python',     problem: 'Valid Parentheses',     difficulty: 'Easy',   time: '04:12' },
  { id: 2, p1: 'null_ptr', p1Rating: 1840, p1Progress: 45, p2: 'alex_codes',  p2Rating: 1890, p2Progress: 92, lang: 'C++',        problem: 'Merge K Sorted Lists',  difficulty: 'Hard',   time: '12:08' },
  { id: 3, p1: 'zen_coder',p1Rating: 1420, p1Progress: 100,p2: 'bot_alpha',   p2Rating: 1350, p2Progress: 35, lang: 'JavaScript', problem: 'Longest Palindrome',    difficulty: 'Medium', time: '02:45' },
];

const FAQS = [
  { q: 'How do I start a 1v1 coding duel?',                  a: 'You can challenge a friend by creating a private room and sharing the room code, or join the public queue in the Arena Dashboard to get matched with an opponent of similar skill.' },
  { q: 'Which programming languages are supported?',         a: 'Currently Python, C++, and JavaScript (Node.js). We compile and run your code against automated test suites in isolated sandbox containers with real-time feedback.' },
  { q: 'Are my ratings affected by private duels?',          a: 'No. Only public arena matches affect your ELO rating. Private duels are friendly matches for practice and custom challenges.' },
  { q: 'How do I add friends on CodeDuel?',                  a: 'Navigate to the Friends page, and enter your friend\'s email address to send a request.' },
];

// ─── Tier helper ─────────────────────────────────────────────────────────────
function getTier(r) {
  if (!r || r < 1000) return { label: 'Bronze',     color: '#a87940', icon: '🪙' };
  if (r >= 2200)      return { label: 'Crimson GM', color: '#FF2E2E', icon: '👑' };
  if (r >= 1800)      return { label: 'Master',     color: '#fbfb7a', icon: '⚡' };
  if (r >= 1400)      return { label: 'Diamond',    color: '#00E5FF', icon: '💎' };
  return               { label: 'Gold',       color: '#FFB000', icon: '🏅' };
}

function StatItem({ value, label, icon: Icon }) {
  return (
    <div className="flex items-center gap-4 px-6 py-5 rounded-2xl bg-[#29292B] border border-[#c9c7ba]/10 hover:border-[#c9c7ba]/25 transition-all">
      <div className="p-3 rounded-xl bg-[#c9c7ba]/5 text-[#c9c7ba]"><Icon size={20} /></div>
      <div className="flex flex-col">
        <span className="text-2xl font-black font-mono leading-none text-[#c9c7ba]">{value}</span>
        <span className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[#c9c7ba]/40 mt-1.5">{label}</span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const [currentFaq, setCurrentFaq] = useState(null);
  const [activeTab,  setActiveTab]  = useState('battle');

  // Live leaderboard
  const [leaderboard, setLeaderboard] = useState([]);
  const [lbLoading,   setLbLoading]   = useState(false);

  useEffect(() => {
    const load = async () => {
      setLbLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/users/leaderboard`);
        if (res.ok) setLeaderboard(await res.json());
      } catch { /* silent */ }
      finally { setLbLoading(false); }
    };
    load();
  }, []);

  const handleStartDuel = async () => {
    if (!user) { navigate('/auth', { state: { from: { pathname: '/' } } }); return; }
    try {
      const idToken  = await user.getIdToken();
      const res      = await fetch(`${API_BASE}/api/rooms/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `HTTP ${res.status}`); }
      const data = await res.json();
      navigate(`/room/${data.roomId}`);
    } catch (err) { alert('Failed to create room: ' + err.message); }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#29292B] text-[#c9c7ba] flex flex-col selection:bg-[#9d1f15]/30 selection:text-white">

      {/* ── BACKGROUND ── */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="orb w-[600px] h-[600px] bg-[#9d1f15] opacity-[0.06] -top-32 -left-32 animate-float" />
        <div className="orb w-[500px] h-[500px] bg-[#fbfb7a] opacity-[0.03] top-1/3 right-0" style={{ animationDelay: '-1.5s' }} />
        <div className="orb w-[450px] h-[450px] bg-[#9d1f15] opacity-[0.03] -bottom-32 left-1/4 animate-float" style={{ animationDelay: '-3s' }} />
        <div className="grid-bg" />
      </div>

      {/* ── NAVBAR ── */}
      <Navbar onStartDuel={handleStartDuel} />

      {/* ── HERO ── */}
      <Header onStartDuel={handleStartDuel} />

      {/* ── STATS ── */}
      <section className="relative z-10 border-t border-b border-[#c9c7ba]/5 bg-[#29292B]/30 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {STATS.map(s => <StatItem key={s.label} {...s} />)}
          </div>
        </div>
      </section>

      {/* ── FEATURE EXPLORER ── */}
      <section id="features" className="relative z-10 py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">

          <div className="text-center max-w-2xl mx-auto mb-16 flex flex-col items-center">
            <span className="text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-[#fbfb7a] bg-[#fbfb7a]/5 border border-[#fbfb7a]/15 px-3.5 py-1.5 rounded-full mb-4">
              Comprehensive Toolkit
            </span>
            <h2 className="text-3xl md:text-5xl font-black tracking-[-1.5px] leading-tight mb-4 text-white">
              Every Tool Built For <span className="text-gradient-hero">Clash Arena</span>
            </h2>
            <p className="text-sm md:text-base text-[#c9c7ba]/50 max-w-lg leading-relaxed">
              Explore all premium features engineered directly into our competitive, multiplayer sandbox environment.
            </p>
          </div>

          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-center">
            {/* Tab list */}
            <div className="flex flex-col gap-4">
              {FEATURE_EXPLORER.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 flex items-start gap-4 group ${activeTab === item.id
                    ? 'bg-[#29292B] border-[#9d1f15] shadow-lg shadow-[#9d1f15]/5'
                    : 'bg-transparent border-[#c9c7ba]/5 hover:border-[#c9c7ba]/15 hover:bg-[#29292B]/35'}`}
                >
                  <div className={`p-3 rounded-xl border transition-colors ${activeTab === item.id
                    ? 'bg-[#9d1f15]/10 border-[#9d1f15] text-[#9d1f15]'
                    : 'bg-[#1e1e20] border-[#c9c7ba]/5 text-[#c9c7ba]/40 group-hover:text-[#c9c7ba]/70'}`}>
                    <item.icon size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className={`text-sm font-black transition-colors ${activeTab === item.id ? 'text-white' : 'text-[#c9c7ba]/70'}`}>{item.title}</h4>
                      <span className="text-[0.55rem] font-bold uppercase tracking-wider bg-[#1e1e20] text-[#c9c7ba]/40 px-2 py-0.5 rounded border border-[#c9c7ba]/5">{item.badge}</span>
                    </div>
                    <p className="text-xs text-[#c9c7ba]/40 mt-1 leading-relaxed">{item.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Preview console */}
            <div className="rounded-2xl glass-card border border-[#c9c7ba]/5 overflow-hidden min-h-[360px] flex flex-col bg-[#1e1e20] shadow-2xl relative">
              <div className="px-5 py-4 border-b border-[#c9c7ba]/5 bg-[#29292B] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-[#fbfb7a]" />
                  <span className="text-xs font-mono font-black text-white capitalize">{activeTab} Live Demo</span>
                </div>
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#c9c7ba]/10" />
                  <span className="w-2 h-2 rounded-full bg-[#c9c7ba]/25" />
                  <span className="w-2 h-2 rounded-full bg-[#9d1f15]" />
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-center">
                {activeTab === 'battle' && (
                  <div className="flex flex-col gap-4 animate-fade-in">
                    <div className="p-4 rounded-xl border border-[#c9c7ba]/5 bg-[#29292B] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Sword className="text-[#9d1f15]" size={16} />
                        <div>
                          <h5 className="text-xs font-extrabold text-white">1v1 Match Connected</h5>
                          <p className="text-[0.6rem] text-[#c9c7ba]/40">Room ID: rm_battle_4821</p>
                        </div>
                      </div>
                      <span className="text-[0.6rem] font-bold text-[#fbfb7a] font-mono bg-[#fbfb7a]/5 border border-[#fbfb7a]/15 px-2 py-0.5 rounded">Active Duel</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-[0.65rem] font-mono">
                      <div className="p-3.5 rounded-xl bg-[#29292B] border border-[#c9c7ba]/5">
                        <div className="flex justify-between items-center mb-1 text-[#c9c7ba]/40 font-bold"><span>Your Input</span><span className="text-[#fbfb7a]">82%</span></div>
                        <code className="text-[#fbfb7a]">def check_anagram...</code>
                      </div>
                      <div className="p-3.5 rounded-xl bg-[#29292B] border border-[#c9c7ba]/5">
                        <div className="flex justify-between items-center mb-1 text-[#c9c7ba]/40 font-bold"><span>Opponent</span><span className="text-white">65%</span></div>
                        <code className="text-white/40">function solveStr()...</code>
                      </div>
                    </div>
                    <button className="btn-primary w-full text-xs py-2.5 shadow-none" onClick={handleStartDuel}>Join Arena & Fight</button>
                  </div>
                )}
                {activeTab === 'practice' && (
                  <div className="flex flex-col gap-3.5 animate-fade-in">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Problems Registry</span>
                      <span className="text-[0.6rem] text-[#c9c7ba]/40 font-mono">1,240 Total Tasks</span>
                    </div>
                    <div className="divide-y divide-[#c9c7ba]/5">
                      {[
                        { name: 'Reverse Linked List',          diff: 'Easy',   rating: 900,  score: '100 pts' },
                        { name: 'Binary Tree Inorder Traversal',diff: 'Medium', rating: 1200, score: '200 pts' },
                        { name: 'Edit Distance Subsequence',    diff: 'Hard',   rating: 1850, score: '400 pts' },
                      ].map((prob, i) => (
                        <div key={i} className="py-2.5 flex justify-between items-center text-[0.65rem]">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${prob.diff === 'Easy' ? 'bg-[#fbfb7a]' : prob.diff === 'Medium' ? 'bg-[#c9c7ba]' : 'bg-[#9d1f15]'}`} />
                            <span className="font-extrabold text-white hover:text-[#fbfb7a] cursor-pointer">{prob.name}</span>
                          </div>
                          <div className="flex gap-3 text-[#c9c7ba]/45 font-mono"><span>★ {prob.rating}</span><span>{prob.score}</span></div>
                        </div>
                      ))}
                    </div>
                    <button className="btn-primary w-full text-xs py-2.5 mt-2 flex items-center justify-center gap-1.5" onClick={() => navigate('/practice')}>
                      <BookOpen size={13} /> Start Practicing Now
                    </button>
                  </div>
                )}
                {activeTab === 'ranked' && (
                  <div className="flex flex-col gap-4 animate-fade-in">
                    <div className="text-center">
                      <Trophy className="mx-auto text-[#fbfb7a] mb-2 animate-bounce" size={24} />
                      <h5 className="text-xs font-bold text-white uppercase tracking-wider">Active Division Tiers</h5>
                      <p className="text-[0.6rem] text-[#c9c7ba]/45">Based on calibrated Glicko-2 ratings</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5 text-center text-[0.6rem] font-bold">
                      <div className="p-3 rounded-xl bg-[#29292B] border border-[#c9c7ba]/5"><span className="text-[#9d1f15] block mb-1">🔴 Crimson</span><span className="text-white/40 block font-mono">&gt;2200</span></div>
                      <div className="p-3 rounded-xl bg-[#29292B] border border-[#9d1f15]/20 shadow-md shadow-[#9d1f15]/5"><span className="text-[#fbfb7a] block mb-1">🟡 Master</span><span className="text-white/40 block font-mono">1800–2200</span></div>
                      <div className="p-3 rounded-xl bg-[#29292B] border border-[#c9c7ba]/5"><span className="text-[#c9c7ba] block mb-1">⚪ Gold</span><span className="text-white/40 block font-mono">1000–1800</span></div>
                    </div>
                    <div className="p-3 bg-[#29292B] rounded-xl border border-[#c9c7ba]/5 flex justify-between items-center text-[0.65rem]">
                      <span className="text-[#c9c7ba]/50 flex items-center gap-1.5"><TrendingUp size={12} className="text-[#9d1f15]" />Avg queue time</span>
                      <span className="font-mono text-white">~14 seconds</span>
                    </div>
                  </div>
                )}
                {activeTab === 'profile' && (
                  <div className="flex flex-col gap-4 animate-fade-in">
                    <div className="flex items-center gap-4 p-3.5 bg-[#29292B] rounded-xl border border-[#c9c7ba]/5">
                      <div className="w-10 h-10 rounded-lg bg-[#9d1f15]/10 border border-[#9d1f15]/25 flex items-center justify-center text-[#9d1f15]"><User size={18} /></div>
                      <div>
                        <h5 className="text-xs font-extrabold text-white">dev_ace</h5>
                        <p className="text-[0.6rem] text-[#c9c7ba]/40">Member since June 2026</p>
                      </div>
                      <div className="ml-auto text-right">
                        <div className="text-xs font-black font-mono text-[#fbfb7a]">2,150 ELO</div>
                        <span className="text-[0.55rem] uppercase font-bold text-[#9d1f15] tracking-widest bg-[#9d1f15]/5 border border-[#9d1f15]/15 px-1.5 rounded">Master</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[0.6rem]">
                      {[['Arrays / Matrices','95%'],['Dynamic Prog.','72%'],['Graph Structures','58%'],['Strings / Sorting','88%']].map(([k,v]) => (
                        <div key={k} className="p-2.5 rounded-lg bg-[#29292B] border border-[#c9c7ba]/5 flex justify-between items-center">
                          <span className="text-[#c9c7ba]/50">{k}</span>
                          <span className="font-mono text-[#fbfb7a] font-bold">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LIVE BATTLES ── */}
      <section id="live-battles" className="relative z-10 py-20 bg-[#29292B]/30 border-t border-b border-[#c9c7ba]/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <span className="text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-[#fbfb7a] bg-[#fbfb7a]/5 border border-[#fbfb7a]/15 px-3.5 py-1.5 rounded-full mb-4 inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#fbfb7a] animate-ping" />Live Broadcast
              </span>
              <h2 className="text-2xl md:text-4xl font-black tracking-[-1px] text-white mt-2">Spectate Active Duels</h2>
            </div>
            <p className="text-xs md:text-sm text-[#c9c7ba]/50 max-w-md">Watch real-time matches currently unfolding in the arena. Study the best programmers' live keyboard inputs, problem analysis, and speed.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {MOCK_LIVE_MATCHES.map((match) => (
              <div key={match.id} className="rounded-2xl glass-card p-6 border border-[#c9c7ba]/5 flex flex-col justify-between bg-[#29292B]/10">
                <div>
                  <div className="flex justify-between items-center text-[0.6rem] font-bold text-[#c9c7ba]/30 mb-4">
                    <span className="px-2 py-0.5 rounded-md bg-[#1e1e20] text-[#c9c7ba] border border-[#c9c7ba]/5 uppercase tracking-wider">{match.lang}</span>
                    <span className="flex items-center gap-1 text-[#fbfb7a]"><span className="w-1.5 h-1.5 rounded-full bg-[#fbfb7a] animate-ping" />{match.time} Elapsed</span>
                  </div>
                  <h4 className="text-sm font-extrabold text-white mb-1">{match.problem}</h4>
                  <div className="flex items-center gap-1.5 mb-6">
                    <span className={`text-[0.55rem] font-bold px-2 py-0.5 rounded-full border ${match.difficulty === 'Easy' ? 'bg-[#fbfb7a]/5 border-[#fbfb7a]/15 text-[#fbfb7a]' : match.difficulty === 'Medium' ? 'bg-[#c9c7ba]/5 border-[#c9c7ba]/15 text-[#c9c7ba]' : 'bg-[#9d1f15]/5 border-[#9d1f15]/15 text-white'}`}>
                      {match.difficulty}
                    </span>
                  </div>
                  <div className="flex flex-col gap-4 mb-6">
                    {[
                      { name: match.p1, rating: match.p1Rating, pct: match.p1Progress, c: 'from-[#9d1f15] to-[#fbfb7a]', tc: 'text-[#9d1f15]' },
                      { name: match.p2, rating: match.p2Rating, pct: match.p2Progress, c: 'from-[#fbfb7a] to-[#9d1f15]', tc: 'text-[#fbfb7a]' },
                    ].map(({ name, rating, pct, c, tc }) => (
                      <div key={name}>
                        <div className="flex justify-between text-[0.65rem] text-[#c9c7ba]/50 mb-1.5 font-bold">
                          <span>{name} ({rating})</span><span className={`${tc} font-mono font-black`}>{pct}%</span>
                        </div>
                        <div className="h-1 bg-[#1e1e20] rounded-full overflow-hidden">
                          <div className={`h-full bg-gradient-to-r ${c} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={() => navigate('/duel', { state: { username: 'Spectator' } })} className="btn-outline w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 border-[#c9c7ba]/10 bg-white/[0.005]">
                  <Eye size={13} /> Spectate Duel
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LEADERBOARD ── */}
      <section id="leaderboard" className="relative z-10 py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
            <div>
              <span className="text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-[#fbfb7a] bg-[#fbfb7a]/5 border border-[#fbfb7a]/15 px-3.5 py-1.5 rounded-full mb-4 inline-block">
                Top Performers
              </span>
              <h2 className="text-3xl md:text-5xl font-black tracking-[-1.5px] leading-tight text-white mt-3">
                Hall of <span className="text-gradient-hero">Grandmasters</span>
              </h2>
            </div>
            <p className="text-sm text-[#c9c7ba]/40 max-w-xs">Compete and win to rise through the global rankings. Live data updated every match.</p>
          </div>

          {lbLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 size={28} className="animate-spin text-[#fbfb7a]/40" />
              <span className="text-xs font-bold uppercase tracking-widest text-[#c9c7ba]/30">Loading rankings…</span>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Trophy size={36} className="text-white/10" />
              <span className="text-sm font-bold text-white/25">No rankings yet — play ranked matches to appear here!</span>
            </div>
          ) : (
            <div className="flex flex-col gap-10">

              {/* Top 3 Podium */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
                {[1, 0, 2].map(idx => {
                  const player = leaderboard[idx];
                  if (!player) return <div key={idx} />;
                  const tier    = getTier(player.rating);
                  const rank    = player.rank;
                  const podiumH = rank === 1 ? 'md:mt-0' : rank === 2 ? 'md:mt-8' : 'md:mt-14';
                  const medals  = { 1: '🥇', 2: '🥈', 3: '🥉' };
                  const winRate = player.matchesPlayedPublic
                    ? Math.round((player.matchesWonPublic / player.matchesPlayedPublic) * 100) : 0;

                  return (
                    <div
                      key={player.uid}
                      onClick={() => navigate(`/users/${player.username || player.uid}`)}
                      className={`relative flex flex-col items-center p-6 rounded-3xl cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 ${podiumH}`}
                      style={{
                        background: rank === 1
                          ? `linear-gradient(135deg, ${tier.color}18, rgba(41,41,43,0.95))`
                          : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${rank === 1 ? tier.color + '44' : 'rgba(255,255,255,0.07)'}`,
                        boxShadow: rank === 1 ? `0 0 60px ${tier.color}14, 0 20px 40px rgba(0,0,0,0.4)` : '0 8px 30px rgba(0,0,0,0.3)',
                      }}
                    >
                      <div className="absolute top-0 left-0 right-0 h-px rounded-t-3xl" style={{ background: `linear-gradient(90deg, transparent, ${tier.color}${rank === 1 ? 'bb' : '44'}, transparent)` }} />
                      <div className="text-3xl mb-3">{medals[rank]}</div>
                      <div
                        className="w-20 h-20 rounded-2xl flex items-center justify-center text-xl font-black text-white mb-4 overflow-hidden"
                        style={{
                          background: `linear-gradient(135deg, ${tier.color}33, ${tier.color}11)`,
                          border: `2px solid ${tier.color}66`,
                          boxShadow: rank === 1 ? `0 0 25px ${tier.color}40` : 'none',
                        }}
                      >
                        {player.photoURL
                          ? <img src={player.photoURL} alt={player.displayName} className="w-full h-full object-cover" />
                          : (player.displayName || '??').slice(0, 2).toUpperCase()
                        }
                      </div>
                      <h3 className="text-sm font-black text-white text-center mb-2 truncate max-w-[140px]">{player.displayName}</h3>
                      <span
                        className="text-[0.55rem] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg mb-4"
                        style={{ color: tier.color, background: `${tier.color}18`, border: `1px solid ${tier.color}33` }}
                      >
                        {tier.icon} {tier.label}
                      </span>
                      <div className="w-full grid grid-cols-2 gap-2 text-center">
                        <div className="py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div className="text-lg font-black font-mono" style={{ color: tier.color }}>{player.rating}</div>
                          <div className="text-[0.5rem] text-white/30 uppercase tracking-wider mt-0.5">ELO</div>
                        </div>
                        <div className="py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div className="text-lg font-black font-mono text-green-400">{winRate}%</div>
                          <div className="text-[0.5rem] text-white/30 uppercase tracking-wider mt-0.5">Win Rate</div>
                        </div>
                      </div>
                      <div className="absolute top-4 right-4 text-[0.6rem] font-black font-mono text-white/20">#{rank}</div>
                    </div>
                  );
                })}
              </div>

              {/* Ranks 4+ table */}
              {leaderboard.length > 3 && (
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
                  <div className="grid grid-cols-[40px_1fr_100px_80px] gap-3 px-5 py-3 text-[0.55rem] font-black uppercase tracking-widest text-white/25"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                    <span>#</span><span>Player</span><span className="text-center">ELO</span><span className="text-right">Win %</span>
                  </div>
                  {leaderboard.slice(3).map((player, i) => {
                    const tier    = getTier(player.rating);
                    const winRate = player.matchesPlayedPublic
                      ? Math.round((player.matchesWonPublic / player.matchesPlayedPublic) * 100) : 0;
                    return (
                      <div
                        key={player.uid}
                        onClick={() => navigate(`/users/${player.username || player.uid}`)}
                        className="grid grid-cols-[40px_1fr_100px_80px] gap-3 px-5 py-3.5 items-center cursor-pointer transition-colors hover:bg-white/[0.02] group"
                        style={{ borderBottom: i < leaderboard.length - 4 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}
                      >
                        <span className="text-xs font-black font-mono text-white/25">#{player.rank}</span>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black overflow-hidden flex-shrink-0"
                            style={{ background: `${tier.color}18`, border: `1px solid ${tier.color}33`, color: tier.color }}>
                            {player.photoURL
                              ? <img src={player.photoURL} alt={player.displayName} className="w-full h-full object-cover" />
                              : (player.displayName || '??').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black text-white truncate group-hover:text-[#fbfb7a] transition-colors">{player.displayName}</div>
                            <div className="text-[0.5rem] font-bold mt-0.5" style={{ color: tier.color }}>{tier.icon} {tier.label}</div>
                          </div>
                        </div>
                        <div className="text-center">
                          <span className="text-xs font-black font-mono" style={{ color: tier.color }}>{player.rating}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-black" style={{ color: winRate >= 50 ? '#00E676' : '#FF2E2E' }}>{winRate}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="text-center">
                <button onClick={() => navigate('/arena')} className="text-xs font-black uppercase tracking-widest text-[#fbfb7a]/50 hover:text-[#fbfb7a] transition-colors flex items-center gap-2 mx-auto">
                  <Trophy size={13} /> View Full Rankings in Arena Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="relative z-10 py-20 bg-[#29292B]/30 border-t border-b border-[#c9c7ba]/5">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16 flex flex-col items-center">
            <span className="text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-[#9d1f15] bg-[#9d1f15]/5 border border-[#9d1f15]/15 px-3.5 py-1.5 rounded-full mb-4">
              Common Questions
            </span>
            <h2 className="text-2xl md:text-4xl font-black tracking-[-1px] text-white">Frequently Asked Questions</h2>
          </div>
          <div className="flex flex-col gap-4">
            {FAQS.map((faq, index) => (
              <div key={index} className="rounded-2xl glass-card border border-[#c9c7ba]/5 overflow-hidden transition-all duration-300">
                <button
                  onClick={() => setCurrentFaq(currentFaq === index ? null : index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-white/[0.005] transition-colors"
                >
                  <span className="text-xs md:text-sm font-bold text-white">{faq.q}</span>
                  <ChevronDown size={16} className={`text-[#c9c7ba]/45 transition-transform duration-300 ${currentFaq === index ? 'rotate-180 text-[#fbfb7a]' : ''}`} />
                </button>
                <div className={`transition-all duration-300 ease-in-out ${currentFaq === index ? 'max-h-[200px] border-t border-[#c9c7ba]/5' : 'max-h-0'}`} style={{ overflow: 'hidden' }}>
                  <p className="px-6 py-5 text-xs md:text-sm text-[#c9c7ba]/50 leading-relaxed bg-[#29292B]/10">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 py-24 md:py-32 flex flex-col items-center text-center overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#9d1f15]/10 blur-[150px] rounded-full" />
        </div>
        <div className="relative z-10 max-w-3xl px-6 flex flex-col items-center">
          <h2 className="text-3xl md:text-6xl font-black tracking-[-2px] mb-6 leading-[1.1] text-white">
            Ready to Prove Your<br />Speed in <span className="text-gradient-brand">Real-Time</span>?
          </h2>
          <p className="text-sm md:text-base text-[#c9c7ba]/50 leading-relaxed max-w-lg mb-10">
            Join thousands of developers climbing the global rating ladder. Step into the matchmaking arena and challenge your first opponent today.
          </p>
          <button
            id="cta-bottom-start-btn"
            onClick={() => navigate('/arena')}
            className="btn-primary px-8 py-4 text-sm font-bold shadow-2xl shadow-[#9d1f15]/40 group hover:scale-[1.02]"
          >
            <Sword size={16} className="group-hover:rotate-12 transition-transform text-white" /> Enter the Arena Now
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <Footer />

    </div>
  );
}
