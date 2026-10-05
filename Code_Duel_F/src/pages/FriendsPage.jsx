import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  ArrowLeft, Home, Users, UserPlus, Bell, Check, X, Loader2,
  Trash2, Sword, Mail, Swords
} from 'lucide-react';

const API_BASE     = import.meta.env.VITE_API_URL      || 'http://localhost:4000';
const REALTIME_URL = import.meta.env.VITE_REALTIME_URL || 'http://localhost:3001';

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

export default function FriendsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const socketRef = useRef(null);

  // Friends & Requests States
  const [friends,         setFriends]         = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading,         setLoading]         = useState(true);

  // User profile
  const [userProfile, setUserProfile] = useState(null);

  // Send request states
  const [emailInput,  setEmailInput]  = useState('');
  const [sendingReq,  setSendingReq]  = useState(false);
  const [requestMsg,  setRequestMsg]  = useState({ type: '', text: '' });

  // Challenge states
  const [challengingId,     setChallengingId]     = useState(null);
  const [incomingChallenge, setIncomingChallenge] = useState(null);
  const [toast, setToast] = useState({ type: '', text: '', code: '' });

  const showToast = (type, text, code = '') => setToast({ type, text, code });
  const closeToast = () => setToast({ type: '', text: '', code: '' });
  useEffect(() => {
    if (toast.text) {
      const t = setTimeout(() => setToast({ type: '', text: '', code: '' }), 6000);
      return () => clearTimeout(t);
    }
  }, [toast.text]);

  const fetchUserProfile = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/users/${user.uid}`);
      if (res.ok) setUserProfile(await res.json());
    } catch { /* silent */ }
  };

  const fetchFriendsAndRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const tok = await user.getIdToken();
      const headers = { Authorization: `Bearer ${tok}` };
      
      const [friendsRes, pendingRes] = await Promise.all([
        fetch(`${API_BASE}/api/users/friends`, { headers }),
        fetch(`${API_BASE}/api/users/friends/pending`, { headers })
      ]);
      
      if (friendsRes.ok) setFriends(await friendsRes.json());
      if (pendingRes.ok) setPendingRequests(await pendingRes.json());
    } catch (err) {
      console.error('Failed to sync friends & requests:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) { navigate('/auth', { replace: true }); return; }
    fetchUserProfile();
    fetchFriendsAndRequests();
  }, [user, fetchFriendsAndRequests]);

  // ─── Socket for challenge events ───────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const socket = io(REALTIME_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('register', user.uid);
    });

    socket.on('challenge-received', (data) => {
      setIncomingChallenge(data);
    });

    socket.on('challenge-declined', ({ byDisplayName }) => {
      showToast('error', `${byDisplayName} declined your challenge.`);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  const sendFriendRequest = async (e) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setSendingReq(true);
    setRequestMsg({ type: '', text: '' });

    try {
      const tok = await user.getIdToken();
      const res = await fetch(`${API_BASE}/api/users/friends/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ email: emailInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send request');

      setRequestMsg({ type: 'success', text: 'Friend request sent successfully!' });
      setEmailInput('');
      fetchFriendsAndRequests();
    } catch (err) {
      setRequestMsg({ type: 'error', text: err.message });
    } finally {
      setSendingReq(false);
    }
  };

  const acceptRequest = async (fromUid) => {
    try {
      const tok = await user.getIdToken();
      const res = await fetch(`${API_BASE}/api/users/friends/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ fromUid })
      });
      if (res.ok) {
        fetchFriendsAndRequests();
      } else {
        const d = await res.json();
        alert('Error: ' + d.error);
      }
    } catch (err) {
      console.error('Failed to accept request:', err);
    }
  };

  const declineRequest = async (fromUid) => {
    try {
      const tok = await user.getIdToken();
      const res = await fetch(`${API_BASE}/api/users/friends/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ fromUid })
      });
      if (res.ok) fetchFriendsAndRequests();
    } catch (err) {
      console.error('Failed to decline request:', err);
    }
  };

  const removeFriend = async (friendId) => {
    if (!window.confirm('Are you sure you want to remove this friend?')) return;
    try {
      const tok = await user.getIdToken();
      const res = await fetch(`${API_BASE}/api/users/friends/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ friendId })
      });
      if (res.ok) fetchFriendsAndRequests();
    } catch (err) {
      console.error('Failed to remove friend:', err);
    }
  };

  // Challenge friend: create room → socket notification → navigate to room
  const challengeFriend = async (friend) => {
    setChallengingId(friend.uid);
    try {
      const tok = await user.getIdToken();
      const res = await fetch(`${API_BASE}/api/rooms/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize match');
      
      const { roomCode: code, roomId } = data;

      // Send socket challenge notification to friend
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

      showToast('success', `Challenge sent to ${friend.displayName}! Moving you to the lobby.`, code);
      // Navigate challenger to the lobby
      navigate(`/room/${roomId}`);
    } catch (err) {
      showToast('error', 'Could not challenge friend: ' + err.message);
    } finally {
      setChallengingId(null);
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

  // Sort alphabetically
  const sortedFriends = [...friends].sort((a, b) =>
    (a.displayName || '').localeCompare(b.displayName || '')
  );

  return (
    <div className="min-h-screen bg-[#0B0C10] text-white flex flex-col relative overflow-x-hidden selection:bg-[#9d1f15]/30">
      
      {/* Background decoration */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="orb w-[600px] h-[600px] bg-[#9d1f15] opacity-[0.03] -top-32 -left-32 animate-float" />
        <div className="orb w-[400px] h-[400px] bg-[#00E5FF] opacity-[0.015] bottom-10 right-10" />
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
            <h1 className="text-xl font-black text-white leading-none">FRIENDS</h1>
            <p className="text-[0.6rem] font-bold uppercase tracking-widest text-[#c9c7ba]/40 mt-1">Manage Your Squad</p>
          </div>
        </div>

        {/* Toast Notification Banner */}
        {toast.text && (
          <div
            className={`rounded-2xl p-4 border animate-bounce-in flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-300 scan-sweep ${
              toast.type === 'success'
                ? 'bg-cyan-500/10 border-cyan-500/35 text-cyan-400'
                : 'bg-danger/10 border-danger/35 text-red-400'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 ${
                  toast.type === 'success'
                    ? 'bg-cyan-500/15 border-cyan-500/30'
                    : 'bg-danger/15 border-danger/30'
                }`}
              >
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
              className={`px-3 py-1.5 rounded-lg text-[0.6rem] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                toast.type === 'success'
                  ? 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10'
                  : 'text-red-400 border-red-500/20 bg-red-500/5 hover:bg-red-500/10'
              }`}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-6">
          
          {/* LEFT: Friends List */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-red-500" />
              <h2 className="text-sm font-black text-white uppercase tracking-wider">
                Mutual Friends ({friends.length})
              </h2>
            </div>



            {loading ? (
              <div className="flex flex-col gap-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-4 bg-white/[0.01] border border-white/[0.04] rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-9 h-9 rounded-xl" />
                      <div className="flex flex-col gap-1.5">
                        <Skeleton className="w-24 h-3" />
                        <Skeleton className="w-20 h-2.5" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="w-14 h-8" />
                      <Skeleton className="w-8 h-8" />
                    </div>
                  </div>
                ))}
              </div>
            ) : friends.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.04] bg-[#12161e]/50 p-12 text-center flex flex-col items-center justify-center gap-3">
                <Users size={28} className="text-white/10" />
                <div>
                  <p className="text-xs font-black text-white/30 uppercase tracking-wider">No Squad Members Yet</p>
                  <p className="text-[0.6rem] text-white/20 mt-1">Invite friends by email or accept pending requests on the right.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {sortedFriends.map((friend, idx) => {
                  const fTier = getRatingTier(friend.rating);

                  return (
                    <div
                      key={friend.uid}
                      className={`p-4 rounded-2xl flex items-center justify-between border transition-all group card-hover stagger-${Math.min(5, idx + 1)} animate-fade-in border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.02]`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="relative flex-shrink-0">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black overflow-hidden border"
                            style={{ background: `${fTier.color}15`, borderColor: `${fTier.color}35`, color: fTier.color }}
                          >
                            {friend.photoURL
                              ? <img src={friend.photoURL} alt={friend.displayName} className="w-full h-full object-cover" />
                              : (friend.displayName || '??').slice(0, 2).toUpperCase()
                            }
                          </div>
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-black text-white truncate">{friend.displayName}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <p className="text-[0.55rem] text-white/40 font-mono">
                              Rating: <span style={{ color: fTier.color }} className="font-bold">{friend.rating} ELO</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Challenge button — always available */}
                        <button
                          onClick={() => challengeFriend(friend)}
                          disabled={challengingId !== null}
                          title="Challenge friend to a private match"
                          className="px-3 py-2 rounded-xl text-[0.6rem] font-black uppercase tracking-wider text-cyan-400 bg-cyan-500/5 hover:bg-cyan-500/10 border border-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          {challengingId === friend.uid ? <Loader2 size={10} className="animate-spin" /> : <><Sword size={11} /> Challenge</>}
                        </button>
                        <button
                          onClick={() => removeFriend(friend.uid)}
                          title="Remove Friend"
                          className="p-2 rounded-xl text-red-400 hover:text-red-300 border border-red-500/10 hover:border-red-500/30 bg-red-500/5 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: Add Friend & Pending Requests */}
          <div className="flex flex-col gap-6">
            
            {/* Add Friend Box */}
            <div
              className="rounded-2xl p-5 border card-hover stagger-1"
              style={{
                background: 'rgba(255,255,255,0.01)',
                borderColor: 'rgba(0,230,118,0.15)'
              }}
            >
              <div className="flex items-center gap-2.5 mb-4">
                <UserPlus size={15} className="text-green-400" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">Send Request</h3>
              </div>

              <form onSubmit={sendFriendRequest} className="flex flex-col gap-3">
                <div className="relative">
                  <Mail size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={e => { setEmailInput(e.target.value); setRequestMsg({ type: '', text: '' }); }}
                    placeholder="Enter friend's email"
                    disabled={sendingReq}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs text-white placeholder-white/25 outline-none transition-all"
                    style={{ background: 'rgba(0,230,118,0.03)', border: '1px solid rgba(0,230,118,0.15)' }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={sendingReq || !emailInput.trim()}
                  className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-green-400 border border-green-500/30 bg-green-500/5 hover:bg-green-500/10 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {sendingReq ? <Loader2 size={12} className="animate-spin" /> : 'Send Request'}
                </button>
              </form>

              {requestMsg.text && (
                <p
                  className={`text-[0.6rem] font-bold uppercase tracking-wider text-center mt-3 animate-fade-in ${
                    requestMsg.type === 'success' ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {requestMsg.text}
                </p>
              )}
            </div>

            {/* Inbound Requests List */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-yellow-400 animate-pulse" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  Pending Requests ({pendingRequests.length})
                </h3>
              </div>

              {loading ? (
                <div className="flex flex-col gap-2">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Skeleton className="w-7 h-7 rounded-lg" />
                        <Skeleton className="w-16 h-3" />
                      </div>
                      <Skeleton className="w-12 h-6" />
                    </div>
                  ))}
                </div>
              ) : pendingRequests.length === 0 ? (
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-5 text-center">
                  <p className="text-[0.55rem] font-bold text-white/30 uppercase tracking-wide">No inbound requests</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {pendingRequests.map((req, idx) => {
                    const rTier = getRatingTier(req.fromRating);
                    return (
                      <div
                        key={req.fromUid}
                        className={`p-3 rounded-xl flex items-center justify-between border border-white/[0.04] bg-[#222326]/40 card-hover stagger-${Math.min(5, idx + 1)} animate-fade-in`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[0.55rem] font-black overflow-hidden flex-shrink-0 border"
                            style={{ background: `${rTier.color}15`, borderColor: `${rTier.color}35`, color: rTier.color }}
                          >
                            {req.fromPhotoURL
                              ? <img src={req.fromPhotoURL} alt={req.fromName} className="w-full h-full object-cover" />
                              : (req.fromName || '??').slice(0, 2).toUpperCase()
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-white truncate">{req.fromName}</p>
                            <p className="text-[0.5rem] text-white/40 font-mono mt-0.5">{req.fromRating} ELO</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => acceptRequest(req.fromUid)}
                            title="Accept Request"
                            className="p-1.5 rounded-lg text-green-400 hover:text-green-300 border border-green-500/10 hover:border-green-500/35 bg-green-500/5 cursor-pointer"
                          >
                            <Check size={11} />
                          </button>
                          <button
                            onClick={() => declineRequest(req.fromUid)}
                            title="Decline Request"
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-300 border border-red-500/10 hover:border-red-500/35 bg-red-500/5 cursor-pointer"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>

      </main>

      <Footer />
    </div>
  );
}
