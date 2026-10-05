import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  ArrowLeft, Home, Sword, Lock, Users, Loader2, Sparkles,
  Check, Radio, Shield, Plus, Hash, X, Zap, Wifi, WifiOff,
  AlertCircle, UserCheck, Swords
} from 'lucide-react';

const REALTIME_URL = import.meta.env.VITE_REALTIME_URL || 'http://localhost:3001';
const API_BASE     = import.meta.env.VITE_API_URL      || 'http://localhost:4000';

const PHASE = {
  IDLE:       'idle',
  CONNECTING: 'connecting',
  QUEUED:     'queued',
  MATCHED:    'matched',
  ERROR:      'error',
};

function getRatingTier(r) {
  if (!r || r < 1000) return { label: 'Bronze',     color: '#a87940', glow: '#a87940' };
  if (r >= 2200)      return { label: 'Crimson GM', color: '#FF2E2E', glow: '#FF2E2E' };
  if (r >= 1800)      return { label: 'Master',     color: '#fbfb7a', glow: '#fbfb7a' };
  if (r >= 1400)      return { label: 'Diamond',    color: '#00E5FF', glow: '#00E5FF' };
  return               { label: 'Gold',       color: '#00E676', glow: '#00E676' };
}

function Skeleton({ className = '', style }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-white/5 ${className}`}
      style={style}
    />
  );
}

function Dots() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN(p => (p + 1) % 4), 450);
    return () => clearInterval(t);
  }, []);
  return <span className="font-mono">{'.'.repeat(n)}&nbsp;&nbsp;&nbsp;{''.padEnd(3 - n)}</span>;
}

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

// ── Incoming Challenge Popup ─────────────────────────────────────────────────
function ChallengePopup({ challenge, onAccept, onDecline }) {
  if (!challenge) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="rounded-2xl p-6 max-w-sm w-full relative animate-scale-up"
        style={{
          background: 'linear-gradient(135deg, rgba(21,26,34,0.98), rgba(11,12,16,0.99))',
          border: '1px solid rgba(0,229,255,0.4)',
          boxShadow: '0 0 60px rgba(0,229,255,0.12), 0 20px 60px rgba(0,0,0,0.8)'
        }}
      >
        {/* Glow */}
        <div className="absolute -top-px left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <Swords size={20} className="text-cyan-400" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-cyan-400">Challenge Incoming!</p>
            <p className="text-sm font-black text-white mt-0.5">{challenge.fromDisplayName}</p>
          </div>
        </div>

        <p className="text-xs text-white/50 mb-1 font-mono">Room Code:</p>
        <div className="mb-5 px-4 py-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-center">
          <span className="text-xl font-black text-white tracking-[0.3em] font-mono">{challenge.roomCode}</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onAccept}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-black bg-cyan-400 hover:bg-cyan-300 transition-all cursor-pointer"
          >
            <Check size={13} className="inline mr-1.5" />
            Accept & Join
          </button>
          <button
            onClick={onDecline}
            className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-red-400 border border-red-500/25 bg-red-500/5 hover:bg-red-500/10 transition-all cursor-pointer"
          >
            <X size={13} className="inline mr-1.5" />
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClashNowPage() {
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const socketRef = useRef(null);

  // Tab state: 'public' | 'private'
  const [activeTab, setActiveTab] = useState('public');

  // Connection
  const [connected, setConnected] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  // Matchmaking
  const [mmPhase,   setMmPhase]   = useState(PHASE.IDLE);
  const [queueSize, setQueueSize] = useState(null);
  const [matchInfo, setMatchInfo] = useState(null);
  const [mmError,   setMmError]   = useState('');

  // Private Match Join
  const [roomCode,     setRoomCode]     = useState('');
  const [joiningRoom,  setJoiningRoom]  = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [privateError, setPrivateError] = useState('');

  // Friends (for private match section)
  const [friends,        setFriends]        = useState([]);
  const [onlineUsers,    setOnlineUsers]     = useState(new Set()); // set of online userIds
  const [activeRooms,    setActiveRooms]     = useState({}); // uid → roomId if in match
  const [loadingFriends, setLoadingFriends]  = useState(false);
  const [challengingFriendId, setChallengingFriendId] = useState(null);

  // Incoming challenge
  const [incomingChallenge, setIncomingChallenge] = useState(null);

  // Toast
  const [toast, setToast] = useState({ type: '', text: '', code: '' });

  const showToast = (type, text, code = '') => setToast({ type, text, code });
  const closeToast = () => setToast({ type: '', text: '', code: '' });
  useEffect(() => {
    if (toast.text) {
      const t = setTimeout(() => setToast({ type: '', text: '', code: '' }), 6000);
      return () => clearTimeout(t);
    }
  }, [toast.text]);

  const formatLastActive = (timestamp) => {
    if (!timestamp) return 'Never clashing';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    if (isNaN(date.getTime())) return 'Active recently';
    const diffMs = Date.now() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // ─── Data Fetchers ──────────────────────────────────────────────────────────
  const fetchUserProfile = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/users/${user.uid}`);
      if (res.ok) setUserProfile(await res.json());
    } catch { /* silent */ }
  };

  const fetchFriends = async () => {
    if (!user) return;
    setLoadingFriends(true);
    try {
      const tok = await user.getIdToken();
      const res = await fetch(`${API_BASE}/api/users/friends`, {
        headers: { Authorization: `Bearer ${tok}` }
      });
      if (res.ok) setFriends(await res.json());
    } catch { /* silent */ }
    finally { setLoadingFriends(false); }
  };

  // Check which friends are currently in active rooms
  const checkFriendsInMatches = async (friendsList) => {
    if (!friendsList || friendsList.length === 0) return;
    try {
      const q = query(
        collection(db, 'rooms'),
        where('status', 'in', ['waiting', 'active'])
      );
      const snap = await getDocs(q);
      const roomMap = {};
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.participants) {
          Object.keys(data.participants).forEach(uid => {
            roomMap[uid] = doc.id;
          });
        }
      });
      setActiveRooms(roomMap);
    } catch { /* silent */ }
  };

  // ─── Socket Lifecycle ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const socket = io(REALTIME_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('register', user.uid);
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setMmPhase(p => p === PHASE.QUEUED ? PHASE.IDLE : p);
    });

    socket.on('connect_error', err => {
      setConnected(false);
      setMmPhase(PHASE.ERROR);
      setMmError(`Socket connection error: ${err.message}`);
    });

    socket.on('queue-stats', ({ size }) => setQueueSize(size));

    socket.on('match-found', ({ opponentId, roomId }) => {
      setMatchInfo({ opponentId, roomId });
      setMmPhase(PHASE.MATCHED);
      setTimeout(() => {
        navigate(`/duel/${roomId}`, { state: { fromMatchmaking: true, opponentId } });
      }, 2200);
    });

    // Listen for incoming challenge
    socket.on('challenge-received', (data) => {
      setIncomingChallenge(data);
    });

    // Listen for challenge declined notification
    socket.on('challenge-declined', ({ byDisplayName }) => {
      showToast('error', `${byDisplayName} declined your challenge.`);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, navigate]);

  // ─── Initial Load ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { navigate('/auth', { replace: true }); return; }
    fetchUserProfile();
    fetchFriends();
  }, [user]);

  useEffect(() => {
    if (friends.length > 0) {
      checkFriendsInMatches(friends);
    }
  }, [friends]);

  // ─── Action Handlers ────────────────────────────────────────────────────────
  const joinQueue = () => {
    if (!socketRef.current?.connected) {
      setMmPhase(PHASE.ERROR);
      setMmError('Socket disconnected. Is the Realtime Server running?');
      return;
    }
    setMmPhase(PHASE.QUEUED);
    setMmError('');
    socketRef.current.emit('join-queue', {
      userId: user.uid,
      rating: userProfile?.rating ?? 1000
    });
  };

  const leaveQueue = () => {
    socketRef.current?.emit('leave-queue', { userId: user.uid });
    setMmPhase(PHASE.IDLE);
  };

  const createRoom = async () => {
    setCreatingRoom(true);
    setPrivateError('');
    try {
      const tok = await user.getIdToken();
      const res = await fetch(`${API_BASE}/api/rooms/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      navigate(`/room/${data.roomId}`);
    } catch (err) {
      setPrivateError(err.message);
    } finally {
      setCreatingRoom(false);
    }
  };

  const joinRoom = async (e) => {
    e.preventDefault();
    if (!roomCode.trim()) return;
    setJoiningRoom(true);
    setPrivateError('');
    try {
      const tok = await user.getIdToken();
      const res = await fetch(`${API_BASE}/api/rooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ roomCode: roomCode.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Room not found.');
      navigate(`/room/${data.roomId}`);
    } catch (err) {
      setPrivateError(err.message);
    } finally {
      setJoiningRoom(false);
    }
  };

  // Challenge a friend: create room → send socket challenge → navigate to room
  const challengeFriend = async (friend) => {
    setChallengingFriendId(friend.uid);
    try {
      const tok = await user.getIdToken();
      const res = await fetch(`${API_BASE}/api/rooms/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize match');

      const { roomCode: code, roomId } = data;

      // Send socket challenge to friend
      if (socketRef.current?.connected) {
        socketRef.current.emit('send-challenge', {
          fromUserId: user.uid,
          fromDisplayName: userProfile?.displayName || user.displayName || 'A friend',
          fromPhotoURL: userProfile?.photoURL || user.photoURL || null,
          toUserId: friend.uid,
          roomCode: code,
          roomId,
        });
      }

      showToast('success', `Challenge sent to ${friend.displayName}! You've been moved to the lobby.`, code);
      // Navigate challenger to the room
      navigate(`/room/${roomId}`);
    } catch (err) {
      showToast('error', 'Could not start friend challenge: ' + err.message);
    } finally {
      setChallengingFriendId(null);
    }
  };

  // Accept incoming challenge
  const acceptChallenge = async () => {
    if (!incomingChallenge) return;
    const { roomCode: code, roomId } = incomingChallenge;
    setIncomingChallenge(null);
    try {
      const tok = await user.getIdToken();
      const res = await fetch(`${API_BASE}/api/rooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ roomCode: code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Room not found.');
      navigate(`/room/${data.roomId || roomId}`);
    } catch (err) {
      showToast('error', 'Could not join challenge room: ' + err.message);
    }
  };

  // Decline incoming challenge
  const declineChallenge = () => {
    if (!incomingChallenge) return;
    if (socketRef.current?.connected) {
      socketRef.current.emit('decline-challenge', {
        fromUserId: incomingChallenge.fromUserId,
        toUserId: user.uid,
        toDisplayName: userProfile?.displayName || user.displayName || 'Your friend',
      });
    }
    setIncomingChallenge(null);
  };

  // ─── Sort friends: online first, then in-match, then offline ───────────────
  const sortedFriends = [...friends].sort((a, b) => {
    const aOnline = onlineUsers.has(a.uid);
    const bOnline = onlineUsers.has(b.uid);
    const aInMatch = !!activeRooms[a.uid];
    const bInMatch = !!activeRooms[b.uid];

    if (aOnline && !aInMatch && !(bOnline && !bInMatch)) return -1;
    if (bOnline && !bInMatch && !(aOnline && !aInMatch)) return 1;
    if (aOnline && !bOnline) return -1;
    if (bOnline && !aOnline) return 1;
    return 0;
  });

  const myTier = getRatingTier(userProfile?.rating);

  return (
    <div className="min-h-screen bg-[#0B0C10] text-white flex flex-col relative overflow-x-hidden selection:bg-[#9d1f15]/30">

      {/* Background decoration */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="orb w-[600px] h-[600px] bg-[#9d1f15] opacity-[0.04] -top-32 -left-32 animate-float" />
        <div className="orb w-[500px] h-[500px] bg-[#00E5FF] opacity-[0.02] bottom-0 right-0 animate-pulse" />
        <div className="grid-bg" />
      </div>

      {/* Incoming Challenge Popup */}
      {incomingChallenge && (
        <ChallengePopup
          challenge={incomingChallenge}
          onAccept={acceptChallenge}
          onDecline={declineChallenge}
        />
      )}

      <Navbar />

      <main className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 md:px-6 py-6 flex flex-col gap-6 animate-fade-up">

        {/* ── Top Bar ── */}
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
            <h1 className="text-xl font-black text-white leading-none">CLASH HUB</h1>
            <p className="text-[0.6rem] font-bold uppercase tracking-widest text-[#c9c7ba]/40 mt-1">Multiplayer Matchmaking</p>
          </div>
        </div>

        {/* Toast */}
        {toast.text && (
          <div
            className={`rounded-2xl p-4 border animate-bounce-in flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-300 scan-sweep ${
              toast.type === 'success'
                ? 'bg-cyan-500/10 border-cyan-500/35 text-cyan-400'
                : 'bg-danger/10 border-danger/35 text-red-400'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 ${toast.type === 'success' ? 'bg-cyan-500/15 border-cyan-500/30' : 'bg-danger/15 border-danger/30'}`}>
                {toast.type === 'success' ? <Check size={16} /> : <X size={16} />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide">
                  {toast.type === 'success' ? 'Lobby Ready' : 'System Notice'}
                </p>
                <p className="text-[0.65rem] opacity-90 font-mono mt-0.5 leading-relaxed">
                  {toast.text}
                  {toast.code && (
                    <span className="ml-2 font-bold text-white px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40">
                      {toast.code}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={closeToast}
              className={`px-3 py-1.5 rounded-lg text-[0.6rem] font-black uppercase tracking-wider transition-all border cursor-pointer ${toast.type === 'success' ? 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10' : 'text-red-400 border-red-500/20 bg-red-500/5 hover:bg-red-500/10'}`}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Public / Private Tab Toggle ── */}
        <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.02] border border-white/[0.06] w-fit">
          <button
            onClick={() => setActiveTab('public')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'public'
                ? 'bg-[#9d1f15] text-white shadow-lg shadow-[#9d1f15]/30'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            <Sword size={13} />
            Public Match
          </button>
          <button
            onClick={() => setActiveTab('private')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'private'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            <Lock size={13} />
            Private Match
          </button>
        </div>

        {/* ── PUBLIC SECTION ── */}
        {activeTab === 'public' && (
          <div
            className="rounded-2xl p-6 relative overflow-hidden card-hover animate-fade-in"
            style={{
              background: 'linear-gradient(135deg, rgba(21,26,34,0.9), rgba(11,12,16,0.95))',
              border: '1px solid rgba(157,31,21,0.35)',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
            }}
          >
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #9d1f15 0, #9d1f15 1px, transparent 0, transparent 50%)', backgroundSize: '10px 10px' }} />

            <div className="relative flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-danger/10 border border-danger/25 text-red-500">
                  <Sword size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white uppercase tracking-wider">Public Match (Ranked)</h2>
                  <p className="text-[0.6rem] text-white/30 font-mono mt-0.5">ELO affected · Standard K-factor</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[0.55rem] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-[#9d1f15]/30 bg-[#9d1f15]/10 text-red-400">
                  Ranked
                </span>
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[0.55rem] font-black ${connected ? 'text-green-400 bg-green-500/5' : 'text-red-400 bg-red-500/5'}`}>
                  {connected ? <Wifi size={10} /> : <WifiOff size={10} />}
                  {connected ? 'Live' : 'Offline'}
                </div>
              </div>
            </div>

            {mmPhase === PHASE.IDLE && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <p className="text-xs text-white/40 leading-relaxed">
                  Join the public competitive ladder matchmaking pool. You will be matched with players of similar rating (within ±200 ELO).
                </p>
                <button
                  onClick={joinQueue}
                  disabled={!connected || creatingRoom || joiningRoom}
                  className="w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #9d1f15, #bd2e24)',
                    boxShadow: '0 4px 20px rgba(157,31,21,0.4)'
                  }}
                >
                  <Zap size={15} className="text-yellow-300" />
                  FIND RANKED MATCH
                </button>
              </div>
            )}

            {mmPhase === PHASE.QUEUED && (
              <div className="flex flex-col items-center justify-center py-5 gap-4 animate-fade-in">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full opacity-20 animate-ping bg-danger/40" style={{ animationDuration: '1.5s' }} />
                  <div className="absolute inset-2 rounded-full opacity-35 animate-ping bg-danger/30" style={{ animationDuration: '1.5s', animationDelay: '0.4s' }} />
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-danger/25 border border-danger/55">
                    <Radio size={18} className="text-red-400 animate-pulse" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-black text-white uppercase tracking-wider">Finding Opponent<Dots /></p>
                  <p className="text-[0.6rem] text-white/30 font-mono mt-1">
                    Queueing: <ElapsedTimer running={mmPhase === PHASE.QUEUED} />
                  </p>
                  {queueSize !== null && (
                    <p className="text-[0.55rem] text-[#c9c7ba]/30 mt-0.5 font-mono">{queueSize} developers online</p>
                  )}
                </div>
                <button
                  onClick={leaveQueue}
                  className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-wider cursor-pointer"
                >
                  Cancel Search
                </button>
              </div>
            )}

            {mmPhase === PHASE.MATCHED && (
              <div className="flex flex-col items-center justify-center py-5 gap-4 text-center animate-scale-up">
                <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-[#9d1f15] to-[#fbfb7a]/25 border-2 border-yellow-300/35 shadow-2xl shadow-yellow-300/10">
                  <Sword size={22} className="text-yellow-300" />
                </div>
                <div>
                  <p className="text-sm font-black text-white uppercase tracking-wider">Match Found!</p>
                  <p className="text-[0.6rem] text-white/30 font-mono mt-1">Room {matchInfo?.roomId?.slice(0, 8)}…</p>
                </div>
                <span className="text-[0.65rem] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg text-yellow-300 animate-pulse border border-yellow-300/20 bg-yellow-300/5">
                  ENTERING ARENA
                </span>
              </div>
            )}

            {mmPhase === PHASE.ERROR && (
              <div className="p-4 rounded-xl text-center animate-fade-in bg-danger/5 border border-danger/20">
                <p className="text-xs font-black text-red-500 uppercase tracking-wider mb-1">Queue Failure</p>
                <p className="text-[0.65rem] text-white/40 leading-relaxed mb-3">{mmError}</p>
                <button
                  onClick={() => setMmPhase(PHASE.IDLE)}
                  className="text-[0.6rem] font-black uppercase text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── PRIVATE SECTION ── */}
        {activeTab === 'private' && (
          <div className="grid md:grid-cols-[1fr_1.3fr] gap-6 animate-fade-in">

            {/* Left: Create/Join Room */}
            <div
              className="rounded-2xl p-6 relative overflow-hidden card-hover"
              style={{
                background: 'linear-gradient(135deg, rgba(21,26,34,0.9), rgba(11,12,16,0.95))',
                border: '1px solid rgba(0,229,255,0.2)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
              }}
            >
              <div className="relative flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-500/10 border border-cyan-500/25 text-cyan-400">
                    <Lock size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-white uppercase tracking-wider">Private Match</h2>
                    <p className="text-[0.6rem] text-white/30 font-mono mt-0.5">Invite only · Rating unaffected</p>
                  </div>
                </div>
                <span className="text-[0.55rem] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                  Custom
                </span>
              </div>

              <div className="flex flex-col gap-4">
                <p className="text-xs text-white/40 leading-relaxed">
                  Create a lobby to play against a friend, or enter an active room code below.
                </p>

                {/* Join form */}
                <form onSubmit={joinRoom} className="flex gap-2">
                  <div className="relative flex-1">
                    <Hash size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
                    <input
                      type="text"
                      value={roomCode}
                      onChange={e => setRoomCode(e.target.value)}
                      placeholder="Enter room code"
                      maxLength={6}
                      disabled={joiningRoom || creatingRoom}
                      className="w-full pl-9 pr-3 py-3 rounded-xl text-xs font-mono font-black text-white placeholder-white/10 tracking-widest outline-none transition-all"
                      style={{ background: 'rgba(0,229,255,0.03)', border: '1px solid rgba(0,229,255,0.15)' }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!roomCode.trim() || joiningRoom || creatingRoom}
                    className="px-5 rounded-xl text-xs font-black uppercase tracking-wider text-cyan-400 border border-cyan-500/35 bg-cyan-500/5 transition-all hover:bg-cyan-500/10 disabled:opacity-40 cursor-pointer"
                  >
                    {joiningRoom ? <Loader2 size={13} className="animate-spin" /> : 'Join'}
                  </button>
                </form>

                <div className="flex items-center gap-2 text-[0.55rem] text-white/20 uppercase tracking-widest font-bold">
                  <div className="flex-1 h-px bg-white/5" /> or <div className="flex-1 h-px bg-white/5" />
                </div>

                <button
                  onClick={createRoom}
                  disabled={joiningRoom || creatingRoom}
                  className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2 border border-dashed border-cyan-500/25 bg-cyan-500/5 hover:bg-cyan-500/10 cursor-pointer"
                >
                  {creatingRoom ? <Loader2 size={13} className="animate-spin" /> : <><Plus size={13} className="text-cyan-400" /> CREATE PRIVATE ROOM</>}
                </button>

                {privateError && (
                  <p className="text-[0.6rem] font-bold text-red-400 text-center uppercase tracking-wider animate-fade-in">{privateError}</p>
                )}
              </div>
            </div>

            {/* Right: Friends List */}
            <div
              className="rounded-2xl p-6 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(15,18,26,0.95), rgba(11,12,16,0.98))',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-cyan-400" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Friends</h3>
                  {friends.length > 0 && (
                    <span className="text-[0.55rem] font-black px-1.5 py-0.5 rounded-md bg-white/5 border border-white/[0.06] text-white/40 font-mono">
                      {friends.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => navigate('/friends')}
                  className="text-[0.6rem] font-black uppercase tracking-wider text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                >
                  Manage →
                </button>
              </div>

              <p className="text-[0.6rem] text-white/30 mb-3 font-mono">Online friends shown first — challenge available when not in a match</p>

              {loadingFriends ? (
                <div className="flex flex-col gap-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Skeleton className="w-7 h-7 rounded-lg" />
                        <div className="flex flex-col gap-1">
                          <Skeleton className="w-20 h-2.5" />
                          <Skeleton className="w-14 h-2" />
                        </div>
                      </div>
                      <Skeleton className="w-16 h-6" />
                    </div>
                  ))}
                </div>
              ) : friends.length === 0 ? (
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-8 text-center flex flex-col items-center justify-center gap-3">
                  <Users size={22} className="text-white/10" />
                  <div>
                    <p className="text-xs font-black text-white/30 uppercase tracking-wider">No Friends Yet</p>
                    <p className="text-[0.6rem] text-white/20 mt-1">Add friends to challenge them to private matches.</p>
                  </div>
                  <button
                    onClick={() => navigate('/friends')}
                    className="text-[0.6rem] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg text-cyan-400 bg-cyan-500/5 border border-cyan-500/20 cursor-pointer hover:bg-cyan-500/10 transition-all"
                  >
                    Add Friends
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                  {sortedFriends.map((friend, idx) => {
                    const fTier = getRatingTier(friend.rating);
                    const isOnline = onlineUsers.has(friend.uid);
                    const isInMatch = !!activeRooms[friend.uid];
                    const canChallenge = isOnline && !isInMatch;

                    return (
                      <div
                        key={friend.uid}
                        className={`p-3 rounded-xl flex items-center justify-between border transition-all animate-fade-in ${
                          canChallenge
                            ? 'border-cyan-500/10 bg-cyan-500/[0.02] hover:bg-cyan-500/[0.04]'
                            : 'border-white/[0.04] bg-white/[0.01]'
                        }`}
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Avatar */}
                          <div className="relative flex-shrink-0">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-[0.6rem] font-black overflow-hidden border"
                              style={{ background: `${fTier.color}15`, borderColor: `${fTier.color}30`, color: fTier.color }}
                            >
                              {friend.photoURL
                                ? <img src={friend.photoURL} alt={friend.displayName} className="w-full h-full object-cover" />
                                : (friend.displayName || '??').slice(0, 2).toUpperCase()
                              }
                            </div>
                            {/* Online indicator */}
                            <div
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#0B0C10] ${
                                isInMatch ? 'bg-yellow-400' : isOnline ? 'bg-green-400' : 'bg-white/20'
                              }`}
                            />
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-black text-white truncate">{friend.displayName}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <p className="text-[0.5rem] text-white/30 font-mono">{friend.rating} ELO</p>
                              {isInMatch ? (
                                <span className="text-[0.5rem] font-black text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-1 py-0.5 rounded uppercase tracking-wider">
                                  In Match
                                </span>
                              ) : isOnline ? (
                                <span className="text-[0.5rem] font-black text-green-400 bg-green-400/10 border border-green-400/20 px-1 py-0.5 rounded uppercase tracking-wider">
                                  Online
                                </span>
                              ) : (
                                <span className="text-[0.5rem] font-bold text-white/20 uppercase tracking-wider">
                                  Offline
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {canChallenge && (
                          <button
                            onClick={() => challengeFriend(friend)}
                            disabled={challengingFriendId !== null}
                            className="px-2.5 py-1.5 rounded-lg text-[0.55rem] font-black uppercase tracking-wider text-cyan-400 bg-cyan-500/5 hover:bg-cyan-500/10 border border-cyan-500/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex-shrink-0 flex items-center gap-1"
                          >
                            {challengingFriendId === friend.uid ? <Loader2 size={9} className="animate-spin" /> : <><Sword size={9} /> Challenge</>}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
