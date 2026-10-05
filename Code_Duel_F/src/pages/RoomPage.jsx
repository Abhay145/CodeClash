import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import codeDuelLogo from '../assets/code_duel_logo.png';
import { 
  Sword, Copy, Check, Users, ArrowLeft, Loader2, Crown, UserPlus, Play, CheckCircle2, XCircle
} from 'lucide-react';

export default function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Anonymous';
  
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // User profile states keyed by userId
  const [profiles, setProfiles] = useState({});

  // Lobby 5-minute expiration countdown timer state
  const [timeLeft, setTimeLeft] = useState(300);

  // API URL
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  // Subscribe to Firestore room document
  useEffect(() => {
    if (!roomId) return;

    setLoading(true);
    const roomRef = doc(db, 'rooms', roomId);
    
    const unsubscribe = onSnapshot(
      roomRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setError('Room not found or has been deleted.');
          setLoading(false);
          return;
        }

        const data = snapshot.data();
        setRoom(data);
        setLoading(false);

        // Auto-navigate to duel arena if match starts
        if (data.status === 'active') {
          navigate(`/duel/${roomId}`);
        }
      },
      (err) => {
        console.error('[RoomPage] Firestore listener error:', err);
        setError('Failed to connect to room channel.');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [roomId, navigate]);

  // Handle 5-minute lobby expiration countdown
  useEffect(() => {
    const participantsCount = Object.keys(room?.participants || {}).length;
    if (!room?.createdAt || participantsCount > 1) {
      if (participantsCount > 1) {
        setTimeLeft(0); // Stop countdown once another player joins
      }
      return;
    }

    const interval = setInterval(async () => {
      const createdAtMs = room.createdAt.toMillis ? room.createdAt.toMillis() : Date.now();
      const expiresAtMs = createdAtMs + 5 * 60 * 1000; // 5 minutes expiration
      const secLeft = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));

      setTimeLeft(secLeft);

      if (secLeft <= 0) {
        clearInterval(interval);
        
        // Creator cleans up the expired room in Firestore
        if (user && user.uid === room.creatorId && participantsCount === 1) {
          try {
            await deleteDoc(doc(db, 'rooms', roomId));
            console.log(`[RoomPage] Room ${roomId} deleted due to expiration.`);
          } catch (err) {
            console.error('Failed to auto-delete expired room:', err);
          }
        }
        alert('Lobby expired. No opponent joined within 5 minutes.');
        navigate('/');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [room?.createdAt, room?.participants, room?.creatorId, user, roomId, navigate]);

  // Fetch profiles for all participants
  useEffect(() => {
    const uids = Object.keys(room?.participants || {});
    if (uids.length === 0) return;

    async function fetchProfiles() {
      const fetched = { ...profiles };
      let changed = false;
      await Promise.all(
        uids.map(async (uid) => {
          if (fetched[uid]) return; // already fetched
          changed = true;
          try {
            const res = await fetch(`${API_BASE}/api/users/${uid}`);
            if (res.ok) {
              const data = await res.json();
              fetched[uid] = data;
            } else {
              fetched[uid] = { displayName: `Player (${uid.slice(0, 6)})` };
            }
          } catch (err) {
            console.warn(`Failed to resolve profile for ${uid}:`, err);
            fetched[uid] = { displayName: 'Player' };
          }
        })
      );
      if (changed) {
        setProfiles(fetched);
      }
    }

    fetchProfiles();
  }, [room?.participants, API_BASE]);

  // Copy roomCode to clipboard
  const handleCopyCode = () => {
    if (!room?.roomCode) return;
    navigator.clipboard.writeText(room.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Leave Lobby / Return to Lobby functionality
  const handleLeaveLobby = async () => {
    if (!room) {
      navigate('/');
      return;
    }

    // Creator can leave and delete room when status is waiting
    if (user && user.uid === room.creatorId && room.status === 'waiting') {
      try {
        await deleteDoc(doc(db, 'rooms', roomId));
        console.log(`[RoomPage] Creator left. Room ${roomId} deleted.`);
      } catch (err) {
        console.error('Failed to delete room on creator exit:', err);
      }
      navigate('/');
    }
  };

  // Participant leaves before match starts — deletes their participant field
  const handleGuestLeave = async () => {
    if (!room || !user || user.uid === room.creatorId) return;
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        [`participants.${user.uid}`]: deleteField(),
      });
      console.log(`[RoomPage] Participant left. Room ${roomId} entry removed.`);
    } catch (err) {
      console.error('Failed to leave lobby:', err);
    }
    navigate('/');
  };

  // Toggle ready status in Firestore
  const handleToggleReady = async () => {
    if (!room || !user) return;
    const roomRef = doc(db, 'rooms', roomId);
    const currentReady = room.participants[user.uid]?.ready || false;

    try {
      await updateDoc(roomRef, {
        [`participants.${user.uid}.ready`]: !currentReady
      });
    } catch (err) {
      console.error('Failed to update ready state:', err);
      alert('Error updating ready status: ' + err.message);
    }
  };

  // Creator starts the match
  const handleStartMatch = async () => {
    if (!room || !user || user.uid !== room.creatorId) return;
    const participantsList = Object.values(room.participants || {});
    const allReady = participantsList.length > 1 && participantsList.every(p => p.ready);
    if (!allReady) return;

    const roomRef = doc(db, 'rooms', roomId);
    try {
      await updateDoc(roomRef, {
        status: 'active',
        startedAt: serverTimestamp()
      });
      console.log(`[RoomPage] Creator started duel.`);
    } catch (err) {
      console.error('Failed to start duel:', err);
      alert('Error starting duel: ' + err.message);
    }
  };

  const formatCountdown = (s) => {
    const mins = Math.floor(s / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0C10] flex flex-col items-center justify-center gap-4 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
          <div className="orb w-[500px] h-[500px] bg-[#9d1f15] opacity-[0.05] -top-32 -left-32 animate-float" />
          <div className="grid-bg" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-3">
          <Loader2 size={36} className="animate-spin text-[#9d1f15]" />
          <p className="text-xs font-bold font-mono tracking-widest text-[#c9c7ba]/40 uppercase">
            Loading Battle Lobby…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0B0C10] flex flex-col items-center justify-center gap-6 relative overflow-hidden px-6 text-center">
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
          <div className="orb w-[500px] h-[500px] bg-[#9d1f15] opacity-[0.05] -top-32 -left-32 animate-float" />
          <div className="grid-bg" />
        </div>
        <div className="glass-card max-w-md w-full p-8 rounded-2xl border border-danger/20 relative z-10 flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-danger/10 border border-danger/30 flex items-center justify-center text-danger mb-4">
            <Sword size={24} className="rotate-45" />
          </div>
          <h2 className="text-lg font-black tracking-wider text-white mb-2 uppercase">Lobby Error</h2>
          <p className="text-sm text-[#c9c7ba]/65 mb-6">{error}</p>
          <button onClick={() => navigate('/')} className="btn-primary w-full">
            <ArrowLeft size={14} /> Back to Arena
          </button>
        </div>
      </div>
    );
  }

  // Determine current user's membership and ready status
  const isCreator = user && user.uid === room?.creatorId;
  const isParticipant = user && !!room?.participants?.[user.uid];
  const participantsCount = Object.keys(room?.participants || {}).length;
  const bothJoined = participantsCount > 1;
  const allReady = bothJoined && Object.values(room?.participants || {}).every(p => p.ready);

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#c9c7ba] flex flex-col relative overflow-hidden select-none">
      {/* ── BACKGROUND ORBS & GRID ── */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="orb w-[600px] h-[600px] bg-[#9d1f15] opacity-[0.06] -top-32 -left-32 animate-float" />
        <div className="orb w-[500px] h-[500px] bg-[#fbfb7a] opacity-[0.02] bottom-0 right-0" style={{ animationDelay: '-2s' }} />
        <div className="grid-bg" />
      </div>

      {/* ── NAVBAR ── */}
      <nav className="relative z-10 glass-nav">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5 text-lg font-black tracking-tight cursor-default text-white">
            <img src={codeDuelLogo} alt="CodeDuel Logo" className="w-8 h-8 object-contain" />
            <span className="font-extrabold">Code<span className="text-gradient-brand">Duel</span></span>
          </div>
          
          {/* Show leave options based on role and room status */}
          {/* Creator: can leave if room not yet active */}
          {isCreator && room?.status === 'waiting' ? (
            <button
              onClick={handleLeaveLobby}
              className="btn-outline px-4 py-2 text-xs font-bold flex items-center gap-1.5"
            >
              <ArrowLeft size={13} /> Leave Lobby
            </button>
          ) : isParticipant && !isCreator && room?.status === 'waiting' ? (
            <button
              onClick={handleGuestLeave}
              className="btn-outline px-4 py-2 text-xs font-bold flex items-center gap-1.5"
            >
              <ArrowLeft size={13} /> Leave Lobby
            </button>
          ) : (
            <span className="text-[0.65rem] font-bold uppercase tracking-widest text-[#c9c7ba]/30">
              Lobby Locked
            </span>
          )}
        </div>
      </nav>

      {/* ── MAIN WAITING LOBBY CONTENT ── */}
      <main className="relative z-10 flex-1 max-w-3xl mx-auto w-full px-6 py-12 flex flex-col justify-center items-center">
        
        {/* Lobby Status Header */}
        <div className="text-center mb-8 animate-fade-up">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.65rem] font-extrabold uppercase tracking-widest bg-[#fbfb7a]/5 border border-[#fbfb7a]/15 text-[#fbfb7a] mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#fbfb7a] animate-ping" />
            Status: {room?.status?.toUpperCase() || 'WAITING'}
          </span>
          <h1 className="text-2xl md:text-3xl font-black tracking-wide text-white uppercase">Waiting Lobby</h1>
          <p className="text-xs text-[#c9c7ba]/40 uppercase tracking-widest mt-1">Match starts once players are ready</p>
        </div>

        {/* Room Code & Expiration Timer */}
        <div className="w-full max-w-md glass-card rounded-2xl p-6 border border-[#c9c7ba]/5 flex flex-col items-center mb-8 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#c9c7ba]/30 mb-2">Room Code</span>
          <div className="flex items-center gap-3">
            <span className="text-3xl md:text-4xl font-extrabold tracking-widest font-mono text-white select-text">
              {room?.roomCode}
            </span>
            <button
              onClick={handleCopyCode}
              title="Copy room code"
              className="p-2.5 rounded-xl border border-white/[0.05] bg-[#29292B] text-white/50 hover:text-white hover:border-[#9d1f15]/40 transition-all active:scale-95"
            >
              {copied ? <Check size={16} className="text-[#fbfb7a]" /> : <Copy size={16} />}
            </button>
          </div>
          
          {copied && (
            <span className="text-[0.6rem] font-bold text-[#fbfb7a] uppercase tracking-wider mt-2.5 animate-fade-in">
              Copied to Clipboard!
            </span>
          )}

          {/* Expiration Timer display if waiting for guest */}
          {!bothJoined && (
            <div className="mt-4 flex items-center gap-1.5 text-xs text-warning font-mono bg-warning/5 border border-warning/20 px-3 py-1 rounded-lg">
              <span>Lobby expires in: {formatCountdown(timeLeft)}</span>
            </div>
          )}
        </div>

        {/* Players Grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-6 animate-fade-up animate-scale-up mb-8" style={{ animationDelay: '0.2s' }}>
          {Object.values(room?.participants || {}).map((participant) => {
            const uid = participant.userId;
            const profile = profiles[uid] || {};
            const isUserCreator = uid === room.creatorId;
            const isCurrent = uid === user?.uid;

            return (
              <div
                key={uid}
                className={`glass-card rounded-2xl p-6 border flex flex-col items-center justify-between text-center relative overflow-hidden min-h-[240px] ${
                  isCurrent ? 'border-[#9d1f15]/30 bg-[#9d1f15]/[0.02]' : 'border-[#c9c7ba]/5'
                }`}
              >
                {/* Crown decoration */}
                {isUserCreator && (
                  <div className="absolute top-4 left-4 text-[#fbfb7a]" title="Room Creator">
                    <Crown size={18} />
                  </div>
                )}

                {/* Ready Badge */}
                <div className="absolute top-4 right-4">
                  {participant.ready ? (
                    <span className="inline-flex items-center gap-1 text-[0.55rem] font-black uppercase bg-[#00E676]/10 text-[#00E676] px-2 py-0.5 rounded border border-[#00E676]/20">
                      Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[0.55rem] font-black uppercase bg-[#FFB000]/10 text-[#FFB000] px-2 py-0.5 rounded border border-[#FFB000]/20">
                      Not Ready
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-center mt-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-brand flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-[#9d1f15]/20 border border-white/10 mb-4 uppercase overflow-hidden">
                    {profile?.photoURL ? (
                      <img src={profile.photoURL} alt={profile?.displayName} className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      profile?.displayName?.slice(0, 2) || uid.slice(0, 2)
                    )}
                  </div>

                  <h3 className="text-sm font-extrabold text-white tracking-wide uppercase mb-1">
                    {profile?.displayName || (isCurrent ? displayName : `Player (${uid.slice(0, 6)})`)}
                  </h3>
                  <p className="text-[0.6rem] font-mono text-[#c9c7ba]/35 uppercase tracking-wider">
                    Rating: {profile?.rating ?? '—'}
                  </p>
                </div>

                <div className="w-full border-t border-white/[0.04] pt-4 mt-4">
                  <span className="text-[0.65rem] font-bold uppercase tracking-wider text-[#fbfb7a]">
                    {isUserCreator ? 'Host / Creator' : 'Competitor'}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Waiting slot placeholder if single player */}
          {participantsCount < 2 && (
            <div className="glass-card rounded-2xl p-6 border border-dashed border-[#c9c7ba]/15 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[240px]">
              {/* Radar pulsing rings */}
              <div className="relative w-14 h-14 flex items-center justify-center mb-4">
                <div className="absolute inset-0 rounded-full bg-[#fbfb7a]/5 border border-[#fbfb7a]/20 animate-radar-pulse" />
                <div className="absolute inset-0 rounded-full bg-[#fbfb7a]/5 border border-[#fbfb7a]/25 animate-radar-pulse" style={{ animationDelay: '0.7s' }} />

                <div className="relative w-9 h-9 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center text-[#c9c7ba]/30">
                  <UserPlus size={15} className="animate-pulse" />
                </div>
              </div>

              <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-1">
                Waiting for Competitors
              </h3>
              <p className="text-[0.55rem] text-[#c9c7ba]/30 max-w-[170px] leading-relaxed">
                Share the code to invite others to the duel.
              </p>
            </div>
          )}
        </div>

        {/* Readiness and Start Match Actions */}
        {bothJoined && (
          <div className="w-full max-w-md flex flex-col gap-4 animate-scale-up">
            {/* Ready/Not Ready Toggle button for current player */}
            {isParticipant && (
              <button
                onClick={handleToggleReady}
                className={`w-full py-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all border ${
                  room.participants[user.uid]?.ready
                    ? 'bg-danger/10 border-danger/30 text-[#FF2E2E] hover:bg-danger/15'
                    : 'bg-success/10 border-success/30 text-[#00E676] hover:bg-success/15'
                }`}
              >
                {room.participants[user.uid]?.ready
                  ? 'Set to Not Ready ❌'
                  : 'I am Ready! 🚀'}
              </button>
            )}

            {/* Start Duel button for Owner/Creator when all are ready */}
            {isCreator && (
              <button
                onClick={handleStartMatch}
                disabled={!allReady}
                className={`w-full py-3.5 text-sm font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${
                  allReady
                    ? 'btn-primary shadow-lg shadow-[#9d1f15]/30 cursor-pointer border border-[#bd2e24]'
                    : 'bg-[#1e1e20] text-[#c9c7ba]/25 border border-white/[0.03] cursor-not-allowed'
                }`}
              >
                <Play size={14} className={allReady ? 'animate-pulse' : ''} />
                Start Match ⚡
              </button>
            )}

            {!allReady && (
              <p className="text-[0.6rem] text-center text-[#c9c7ba]/30 uppercase tracking-wider">
                Waiting for all players to declare ready...
              </p>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
