import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import {
  Sword, Timer, CheckCircle, XCircle, Play, RotateCcw,
  ChevronDown, ChevronUp, Maximize2, Minimize2, AlertTriangle,
  Code2, Loader2, WifiOff, Terminal, LogOut
} from 'lucide-react';
import { useProblem } from '../hooks/useProblem';
import { LANGUAGES, DEFAULT_LANGUAGE } from '../constants/languages';
import { getStarterCode } from '../constants/starterTemplates';
import { useAuth } from '../context/AuthContext';
import codeDuelLogo from '../assets/code_duel_logo.png';
import { doc, onSnapshot, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db } from '../config/firebase';
import IOBlock from '../components/IOBlock';
import { parseProblemDescription } from '../utils/parseDescription';

// eslint-disable-next-line no-unused-vars
const JUDGE0_BASE_URL = import.meta.env.VITE_JUDGE0_URL || '';

function ProblemSkeleton() {
  return (
    <div className="p-5 flex flex-col gap-4 animate-pulse">
      <div className="h-5 w-20 rounded bg-white/5" />
      <div className="h-7 w-3/5 rounded bg-white/5" />
      <div className="h-3.5 w-full rounded bg-white/5" />
      <div className="h-3.5 w-4/5 rounded bg-white/5" />
      <div className="h-24 rounded-xl bg-white/5 mt-2" />
      <div className="h-3.5 w-3/4 rounded bg-white/5" />
    </div>
  );
}
const parseStructuredInput = (input, problemId) => {
  if (!input) return null;
  const normalized = input.replace(/\\n/g, '\n');
  const lines = normalized.trim().split('\n').map(l => l.trim()).filter(Boolean);
  
  if (lines.length === 0) return null;
  
  // Check if first line contains numeric values
  const firstLineNums = lines[0].split(/\s+/).map(Number);
  const hasOnlyNums = firstLineNums.every(n => !isNaN(n));
  
  if (!hasOnlyNums) {
    // Handle inline key-value pairs (e.g. "nums = [2,7,11,15], target = 9")
    const pairs = {};
    const parts = normalized.split(',');
    parts.forEach(part => {
      const kv = part.split('=');
      if (kv.length === 2) {
        const k = kv[0].trim();
        const v = kv[1].trim();
        try {
          pairs[k] = JSON.parse(v);
        } catch {
          pairs[k] = v;
        }
      }
    });
    if (Object.keys(pairs).length > 0) {
      return pairs;
    }
    return null;
  }
  
  // Standard competitive programming formatting heuristics
  
  // Case A: First line has exactly 1 number (usually size N)
  if (firstLineNums.length === 1) {
    const N = firstLineNums[0];
    const remainingLines = lines.slice(1);
    
    if (remainingLines.length === 0) {
      return { N };
    }
    
    if (remainingLines.length === 1) {
      const arr = remainingLines[0].split(/\s+/).map(Number);
      return { N, arr: arr.length === 1 ? arr[0] : arr };
    }
    
    const parsedLines = remainingLines.map(line => line.split(/\s+/).map(Number));
    const allNumeric = parsedLines.every(arr => arr.every(n => !isNaN(n)));
    
    if (allNumeric) {
      // Tree Heuristics: N nodes, N-1 lines, each containing 2 (or 3 for weighted) integers
      if (remainingLines.length === N - 1 && parsedLines.every(row => row.length === 2 || row.length === 3)) {
        return { N, edges: parsedLines };
      }
      
      // Multiple Arrays: each remaining line has exactly N elements
      if (parsedLines.every(arr => arr.length === N)) {
        const result = { N };
        parsedLines.forEach((arr, idx) => {
          result[`arr${idx + 1}`] = arr;
        });
        return result;
      }
      
      // Fallback for multiple lines
      const result = { N };
      parsedLines.forEach((arr, idx) => {
        result[`arr${idx + 1}`] = arr.length === 1 ? arr[0] : arr;
      });
      return result;
    }
  }
  
  // Case B: First line has exactly 2 numbers (usually N M or N K)
  if (firstLineNums.length === 2) {
    const [N, M] = firstLineNums;
    const remainingLines = lines.slice(1);
    const parsedLines = remainingLines.map(line => line.split(/\s+/).map(Number));
    const allNumeric = parsedLines.every(arr => arr.every(n => !isNaN(n)));
    
    if (allNumeric) {
      // Graph Heuristics: M edges, each containing 2 (or 3 for weighted) integers
      if (remainingLines.length === M && parsedLines.every(row => row.length === 2 || row.length === 3)) {
        return { N, M, edges: parsedLines };
      }
      
      const result = { N, M };
      parsedLines.forEach((arr, idx) => {
        result[`arr${idx + 1}`] = arr.length === 1 ? arr[0] : arr;
      });
      return result;
    }
  }
  
  // General Fallback
  const result = {};
  lines.forEach((line, idx) => {
    const arr = line.split(/\s+/).map(Number);
    if (arr.every(n => !isNaN(n))) {
      result[`line${idx + 1}`] = arr.length === 1 ? arr[0] : arr;
    } else {
      result[`line${idx + 1}`] = line;
    }
  });
  return result;
};

const formatValue = (val) => {
  if (Array.isArray(val)) {
    if (Array.isArray(val[0])) {
      return `[${val.map(row => `[${row.join(', ')}]`).join(', ')}]`;
    }
    return `[${val.join(', ')}]`;
  }
  return String(val);
};

export default function DuelPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomId, problemId: paramProblemId } = useParams();
  const { user, logout } = useAuth();

  const formatNewlines = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/\\n/g, '\n');
  };

  const {
    // Use Firebase display name / email as fallback, then nav-state username
    username = user?.displayName || user?.email?.split('@')[0] || 'Anonymous',
    problemId: stateProblemId = null,
    opponent = { name: 'Waiting…' },
    durationSec = 30 * 60,
    // fromMatchmaking = true means this is a ranked public match
    fromMatchmaking = false,
  } = location.state || {};

  // Prefer nav-state username over Firebase (allows lobby to set a handle)
  const displayName = (location.state?.username) || user?.displayName || user?.email?.split('@')[0] || 'Anonymous';

  // 'public' for ranked arena matches, 'private' for room-code duels
  const matchType = fromMatchmaking ? 'public' : 'private';

  // Track how many times the current user has submitted in this match
  const submitCountRef = useRef(0);

  const [room, setRoom] = useState(null);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [roomError, setRoomError] = useState(null);
  const [profiles, setProfiles] = useState({});

  // Helper to determine if current player is the creator
  const isCreator = user && room && user.uid === room.creatorId;

  // URL param takes priority, then Firestore room, then navigation state
  const problemId = paramProblemId || room?.problemId || stateProblemId;
  const shouldSkipProblemFetch = !!roomId && !room?.problemId;

  console.log('[DuelPage] paramProblemId (from URL):', paramProblemId);
  console.log('[DuelPage] stateProblemId (from nav state):', stateProblemId);
  console.log('[DuelPage] room?.problemId (from Firestore):', room?.problemId);
  console.log('[DuelPage] resolved problemId (passed to hook):', problemId);

  const { problem, loading: problemLoading, error: problemError } = useProblem(problemId, shouldSkipProblemFetch);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  // Subscribe to room updates in Firestore
  useEffect(() => {
    if (!roomId) return;
    const roomRef = doc(db, 'rooms', roomId);
    const unsubscribe = onSnapshot(
      roomRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          // Room was deleted or never existed — show error instead of loading forever
          setRoomNotFound(true);
          return;
        }
        const data = snapshot.data();
        setRoom(data);
        
        // Match completed -> navigate to match results using matchId stored in room
        if (data.status === 'completed' && data.matchId) {
          navigate(`/match/${data.matchId}/results`);
        }
      },
      (err) => {
        console.error('[DuelPage] Room listener error:', err);
        setRoomError(err.message || 'Failed to connect to room.');
      }
    );
    return unsubscribe;
  }, [roomId, navigate]);

  // Fetch user profiles for all participants
  useEffect(() => {
    const uids = Object.keys(room?.participants || {});
    if (uids.length === 0) return;

    async function fetchProfiles() {
      const fetched = { ...profiles };
      let changed = false;
      await Promise.all(
        uids.map(async (uid) => {
          if (fetched[uid]) return;
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
            console.warn('Failed to resolve profile:', err);
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

  // Editor states
  const [lang, setLang] = useState(DEFAULT_LANGUAGE);
  const [code, setCode] = useState(getStarterCode(DEFAULT_LANGUAGE, null));
  const editorRef = useRef(null);

  useEffect(() => {
    setCode(getStarterCode(lang, problem));
  }, [problem, lang]);

  // 10 minutes (600 seconds) match duration based on Firestore startedAt
  const [timeLeft, setTimeLeft] = useState(600);

  useEffect(() => {
    if (!room?.startedAt) return;

    const interval = setInterval(async () => {
      const startedAtMs = room.startedAt.toMillis ? room.startedAt.toMillis() : Date.now();
      const elapsedMs = Date.now() - startedAtMs;
      const secLeft = Math.max(0, 600 - Math.floor(elapsedMs / 1000));
      
      setTimeLeft(secLeft);

      if (secLeft <= 0) {
        clearInterval(interval);
        
        // Only the creator writes the match result on timeout to avoid duplicate writes
        if (user && user.uid === room.creatorId && room.status !== 'completed') {
          try {
            const participantsList = Object.values(room.participants || {});
            let maxScore = -1;
            let bestPlayers = [];

            participantsList.forEach((p) => {
              const pScore = p.score ?? 0;
              if (pScore > maxScore) {
                maxScore = pScore;
                bestPlayers = [p];
              } else if (pScore === maxScore) {
                bestPlayers.push(p);
              }
            });

            let winnerId = 'tie';
            if (bestPlayers.length === 1) {
              winnerId = bestPlayers[0].userId;
            } else {
              // Tie break on testCasesPassed
              let maxPassed = -1;
              let bestPassedPlayers = [];
              bestPlayers.forEach((p) => {
                const passed = p.testCasesPassed ?? p.score ?? 0;
                if (passed > maxPassed) {
                  maxPassed = passed;
                  bestPassedPlayers = [p];
                } else if (passed === maxPassed) {
                  bestPassedPlayers.push(p);
                }
              });
              if (bestPassedPlayers.length === 1) {
                winnerId = bestPassedPlayers[0].userId;
              }
            }

            const isDraw = winnerId === 'tie';
            const durationSeconds = Math.round(elapsedMs / 1000);
            const completedAt = serverTimestamp();
            const allPlayerIds = Object.keys(room.participants);

            // Build participants list with code + language + submitCount
            const finalParticipants = participantsList.map((p) => {
              const isCurrent = p.userId === user.uid;
              return {
                userId: p.userId,
                score: p.score ?? 0,
                testCasesPassed: p.testCasesPassed ?? p.score ?? 0,
                progress: p.progress ?? 0,
                bestCode: p.bestCode ?? p.lastCode ?? '',
                code: p.lastCode ?? p.bestCode ?? (isCurrent ? code : ''),
                language: p.language ?? (isCurrent ? lang : ''),
                solved: p.solved ?? false,
                surrendered: p.surrendered ?? false,
                submitCount: p.submitCount ?? (isCurrent ? submitCountRef.current : 0),
              };
            });

            // Write match document to matches collection
            const matchRef = await addDoc(collection(db, 'matches'), {
              roomCode: room.roomCode,
              problemId: room.problemId,
              matchType,
              winnerId,
              participantIds: allPlayerIds,
              completionReason: 'timeout',
              startedAt: room.startedAt,
              completedAt,
              durationSeconds,
              participants: finalParticipants,
            });

            // Update room with matchId and mark completed
            await updateDoc(doc(db, 'rooms', roomId), {
              status: 'completed',
              winnerId,
              matchId: matchRef.id,
              completedAt,
            });

            // Trigger ELO update (fire-and-forget)
            const idToken = await user.getIdToken();
            fetch(`${API_BASE}/api/matches/complete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
              body: JSON.stringify({
                matchId: matchRef.id,
                roomId,
                matchType,
                isDraw,
                player1Id: allPlayerIds[0],
                player2Id: allPlayerIds[1] ?? allPlayerIds[0],
                ...(isDraw ? {} : { winnerId, loserId: allPlayerIds.find(id => id !== winnerId) }),
              }),
            }).catch((e) => console.warn('[DuelPage] ELO trigger failed (non-fatal):', e.message));

          } catch (err) {
            console.error('Failed to end match on timeout:', err);
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [room?.startedAt, room?.creatorId, room?.participants, room?.status, room?.roomCode, room?.problemId, user, roomId, matchType, code, lang, API_BASE]);

  // UI States
  const [editorFull, setEditorFull] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  
  // Custom input states
  const [useCustomInput, setUseCustomInput] = useState(false);
  const [customInputText, setCustomInputText] = useState('');
  const [customInputError, setCustomInputError] = useState(null);
  const [isCustomRun, setIsCustomRun] = useState(false);
  const [compileError, setCompileError] = useState(null);
  const [runVerdict, setRunVerdict] = useState(null);

  // Initialize customInputText with first sample testcase
  useEffect(() => {
    if (problem && problem.sampleTestCases && problem.sampleTestCases.length > 0) {
      setCustomInputText(problem.sampleTestCases[0].input || '');
      setCustomInputError(null);
    } else {
      setCustomInputText('');
      setCustomInputError(null);
    }
  }, [problem]);

  const handleCustomInputChange = (value) => {
    setCustomInputText(value);
    if (!value.trim()) {
      setCustomInputError("Input cannot be empty");
    } else {
      setCustomInputError(null);
    }
  };

  // Console panel states
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleTab, setConsoleTab] = useState('tests'); // tests | output

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const urgency = timeLeft < 300 ? 'urgent' : timeLeft < 600 ? 'warning' : 'normal';

  const handleLangChange = (newLang) => {
    setLang(newLang);
    setCode(getStarterCode(newLang, problem));
    setTestResults(null);
    setCompileError(null);
    setRunVerdict(null);
  };

  const handleReset = () => {
    setCode(getStarterCode(lang, problem));
    setTestResults(null);
    setSubmitError(null);
    setCompileError(null);
    setRunVerdict(null);
  };

  const handleRun = useCallback(async () => {
    if (!problem || isRunning) return;

    if (useCustomInput && !customInputText.trim()) {
      setCustomInputError("Input cannot be empty");
      setConsoleOpen(true);
      setConsoleTab('tests');
      return;
    }

    setIsRunning(true);
    setConsoleOpen(true);
    setConsoleTab('tests');
    setTestResults(null);
    setSubmitError(null);
    setCompileError(null);
    setRunVerdict(null);
    setIsCustomRun(useCustomInput);

    try {
      const compilerUrl = import.meta.env.VITE_COMPILER_URL || 'http://localhost:3005';
      const idToken = user ? await user.getIdToken() : '';
      
      const requestBody = { problemId: problem.id, code, language: lang };
      if (useCustomInput) {
        requestBody.customInput = customInputText;
      }

      const res = await fetch(`${compilerUrl}/run`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `Server error ${res.status}`);
      }

      if (data.verdict === 'Compile Error' || data.compileError) {
        setCompileError(data.compileError || 'Compilation failed.');
        setRunVerdict('Compile Error');
        setTestResults([]);
      } else {
        const mappedResults = (data.results ?? []).map((r) => ({
          label: r.isCustom ? 'Custom Test Case' : `Case ${r.index}`,
          input: r.input,
          expected: r.expected,
          got: r.got,
          passed: r.passed,
          time: r.time,
          executionTime: r.executionTime,
          verdict: r.verdict,
          isCustom: r.isCustom,
        }));
        setTestResults(mappedResults);
        setRunVerdict(data.verdict);
      }
    } catch (err) {
      setSubmitError(err.message || 'Could not reach the compiler server.');
      setRunVerdict('Error');
    } finally {
      setIsRunning(false);
    }
  }, [problem, code, user, useCustomInput, customInputText, isRunning, lang]);

  // Warn on tab reload / close during match
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'A match is in progress. Leaving this page will forfeit the match!';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleLeaveMatch = async () => {
    if (!room || !user) return;
    const confirmLeave = window.confirm("Are you sure you want to leave the match? Leaving will count as a surrender.");
    if (!confirmLeave) return;

    try {
      const roomRef = doc(db, 'rooms', roomId);
      const participantsList = Object.values(room.participants || {});
      const otherActivePlayers = participantsList.filter(p => p.userId !== user.uid && !p.surrendered);

      const startedAtMs = room.startedAt?.toMillis ? room.startedAt.toMillis() : Date.now();
      const durationSeconds = Math.round((Date.now() - startedAtMs) / 1000);
      const completedAt = serverTimestamp();

      const isMatchOver = otherActivePlayers.length <= 1;

      if (isMatchOver) {
        const winnerId = otherActivePlayers.length === 1 ? otherActivePlayers[0].userId : 'tie';
        const isDraw = winnerId === 'tie';

        const finalParticipants = participantsList.map((p) => {
          const isCurrent = p.userId === user.uid;
          return {
            userId: p.userId,
            score: isCurrent ? 0 : (p.score ?? 0),
            testCasesPassed: isCurrent ? 0 : (p.testCasesPassed ?? p.score ?? 0),
            progress: isCurrent ? 0 : (p.progress ?? 0),
            bestCode: isCurrent ? code : (p.bestCode ?? p.lastCode ?? ''),
            code: isCurrent ? code : (p.lastCode ?? p.bestCode ?? ''),
            language: isCurrent ? lang : (p.language ?? ''),
            solved: isCurrent ? false : (p.solved ?? false),
            surrendered: isCurrent ? true : (p.surrendered ?? false),
            submitCount: isCurrent ? submitCountRef.current : (p.submitCount ?? 0),
          };
        });

        const allPlayerIds = Object.keys(room.participants);

        const matchRef = await addDoc(collection(db, 'matches'), {
          roomCode: room.roomCode,
          problemId: room.problemId,
          matchType,
          winnerId,
          participantIds: allPlayerIds,
          completionReason: 'surrender',
          startedAt: room.startedAt,
          completedAt,
          durationSeconds,
          participants: finalParticipants,
        });

        await updateDoc(roomRef, {
          [`participants.${user.uid}.score`]: 0,
          [`participants.${user.uid}.testCasesPassed`]: 0,
          [`participants.${user.uid}.progress`]: 0,
          [`participants.${user.uid}.solved`]: false,
          [`participants.${user.uid}.surrendered`]: true,
          [`participants.${user.uid}.code`]: code,
          [`participants.${user.uid}.language`]: lang,
          [`participants.${user.uid}.submitCount`]: submitCountRef.current,
          status: 'completed',
          winnerId,
          matchId: matchRef.id,
          completedAt,
        });

        // Trigger ELO update (fire-and-forget)
        const survivorId = isDraw ? null : winnerId;
        const defeatedId = isDraw ? null : user.uid;
        if (survivorId && defeatedId) {
          const idToken = await user.getIdToken();
          fetch(`${API_BASE}/api/matches/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({
              matchId: matchRef.id,
              roomId,
              matchType,
              isDraw: false,
              player1Id: survivorId,
              player2Id: defeatedId,
              winnerId: survivorId,
              loserId: defeatedId,
            }),
          }).catch((e) => console.warn('[DuelPage] ELO trigger failed (non-fatal):', e.message));
        } else if (isDraw) {
          const idToken = await user.getIdToken();
          fetch(`${API_BASE}/api/matches/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({
              matchId: matchRef.id,
              roomId,
              matchType,
              isDraw: true,
              player1Id: allPlayerIds[0],
              player2Id: allPlayerIds[1] ?? allPlayerIds[0],
            }),
          }).catch((e) => console.warn('[DuelPage] ELO trigger failed (non-fatal):', e.message));
        }
      } else {
        await updateDoc(roomRef, {
          [`participants.${user.uid}.score`]: 0,
          [`participants.${user.uid}.testCasesPassed`]: 0,
          [`participants.${user.uid}.progress`]: 0,
          [`participants.${user.uid}.solved`]: false,
          [`participants.${user.uid}.surrendered`]: true,
          [`participants.${user.uid}.code`]: code,
          [`participants.${user.uid}.language`]: lang,
          [`participants.${user.uid}.submitCount`]: submitCountRef.current,
        });
        navigate('/');
      }
    } catch (err) {
      console.error('Failed to leave match:', err);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!problem) return;
    setIsRunning(true);
    setConsoleOpen(true);
    setConsoleTab('tests');
    setSubmitError(null);
    setCompileError(null);
    setRunVerdict(null);
    setIsCustomRun(false);

    // Increment submit count for this player
    submitCountRef.current += 1;
    const currentSubmitCount = submitCountRef.current;

    try {
      const compilerUrl = import.meta.env.VITE_COMPILER_URL || 'http://localhost:3005';
      const idToken = user ? await user.getIdToken() : '';
      const res = await fetch(`${compilerUrl}/submit`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ problemId: problem.id, code, language: lang }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `Server error ${res.status}`);
      }

      if (data.verdict === 'Compile Error' || data.compileError) {
        setCompileError(data.compileError || 'Compilation failed.');
        setRunVerdict('Compile Error');
        setTestResults([]);
        setIsRunning(false);
        return;
      }

      // Map compiler verdict to UI results
      const total = data.total ?? 0;
      const passed = data.passed ?? 0;

      // Build a summary result card per test case
      const results = Array.from({ length: total }, (_, i) => ({
        label: `Hidden Test ${i + 1}`,
        input: '(hidden)',
        expected: '(hidden)',
        got: i < passed ? '✓ Passed' : '✗ Failed',
        passed: i < passed,
        time: '—',
        verdict: i < passed ? 'Accepted' : (data.verdict || 'Wrong Answer'),
      }));

      setTestResults(results.length ? results : null);
      setRunVerdict(data.verdict);

      const solved = (passed === total && total > 0);

      // Update room document in Firestore
      if (room && roomId) {
        const roomRef = doc(db, 'rooms', roomId);
        const userRef = `participants.${user.uid}`;
        const progressVal = Math.round((passed / total) * 100);
        const updateData = {
          [`${userRef}.score`]: passed,
          [`${userRef}.testCasesPassed`]: passed,
          [`${userRef}.progress`]: progressVal,
          [`${userRef}.submitCount`]: currentSubmitCount,
          [`${userRef}.lastCode`]: code,
          [`${userRef}.language`]: lang,
        };
        
        if (solved) {
          updateData[`${userRef}.solved`] = true;
          updateData[`${userRef}.bestCode`] = code;
        }

        // If this player solved it, create match doc and mark room completed
        if (solved) {
          const startedAtMs = room.startedAt?.toMillis ? room.startedAt.toMillis() : Date.now();
          const durationSeconds = Math.round((Date.now() - startedAtMs) / 1000);
          const completedAt = serverTimestamp();

          const participantsList = Object.values(room.participants || {});
          const finalParticipants = participantsList.map((p) => {
            const isCurrent = p.userId === user.uid;
            return {
              userId: p.userId,
              score: isCurrent ? passed : (p.score ?? 0),
              testCasesPassed: isCurrent ? passed : (p.testCasesPassed ?? p.score ?? 0),
              progress: isCurrent ? progressVal : (p.progress ?? 0),
              bestCode: isCurrent ? code : (p.bestCode ?? p.lastCode ?? ''),
              code: isCurrent ? code : (p.lastCode ?? p.bestCode ?? ''),
              language: isCurrent ? lang : (p.language ?? ''),
              solved: isCurrent ? true : (p.solved ?? false),
              surrendered: p.surrendered ?? false,
              submitCount: isCurrent ? currentSubmitCount : (p.submitCount ?? 0),
            };
          });

          const allPlayerIds = Object.keys(room.participants);
          const loserIds = allPlayerIds.filter((id) => id !== user.uid);
          const loserId = loserIds[0] ?? null;

          // Write match document to matches collection
          const matchRef = await addDoc(collection(db, 'matches'), {
            roomCode: room.roomCode,
            problemId: room.problemId,
            matchType,
            winnerId: user.uid,
            participantIds: allPlayerIds,
            completionReason: 'solved',
            startedAt: room.startedAt,
            completedAt,
            durationSeconds,
            participants: finalParticipants,
          });

          updateData.status = 'completed';
          updateData.winnerId = user.uid;
          updateData.matchId = matchRef.id;
          updateData.completedAt = completedAt;

          // Trigger ELO update via backend (fire-and-forget, non-blocking)
          if (loserId) {
            const idToken2 = await user.getIdToken();
            fetch(`${API_BASE}/api/matches/complete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken2}` },
              body: JSON.stringify({
                matchId: matchRef.id,
                roomId,
                matchType,
                isDraw: false,
                player1Id: user.uid,
                player2Id: loserId,
                winnerId: user.uid,
                loserId,
              }),
            }).catch((e) => console.warn('[DuelPage] ELO trigger failed (non-fatal):', e.message));
          }
        }

        await updateDoc(roomRef, updateData);
        // Navigation on solve is handled by onSnapshot listener detecting status=completed + matchId
      }

      if (data.success) {
        setSubmitted(true);
      } else {
        setSubmitError(`Verdict: ${data.verdict} (${passed}/${total} passed)`);
      }

      // Save submission record (fire-and-forget — never blocks match flow)
      if (user) {
        user.getIdToken().then((tok) => {
          fetch(`${API_BASE}/api/submissions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
            body: JSON.stringify({
              problemId: problem.id,
              matchId:   room?.matchId || null,
              matchType,
              code,
              language:    lang,
              verdict:     data.verdict || 'Wrong Answer',
              passed,
              total,
              submitCount: currentSubmitCount,
            }),
          }).catch((e) => console.warn('[DuelPage] submission save failed (non-fatal):', e.message));
        });
      }
    } catch (err) {
      const targetPort = ' on port 3005';
      setSubmitError(err.message || `Compiler server unreachable. Is it running${targetPort}?`);
    } finally {
      setIsRunning(false);
    }
  }, [problem, code, room, roomId, user, lang, matchType, submitCountRef, API_BASE]);

  const DIFF_COLOR = { 
    Easy: 'text-brand-green bg-brand-green/10 border-brand-green/20', 
    Medium: 'text-brand-amber bg-brand-amber/10 border-brand-amber/20', 
    Hard: 'text-brand-red bg-brand-red/10 border-brand-red/20' 
  };

  // ── Room not found / error guard (MUST be after all hooks) ──
  if (roomNotFound || roomError) {
    return (
      <div className="min-h-screen bg-bg-space flex flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
          <div className="orb w-[500px] h-[500px] bg-brand-red opacity-[0.05] -top-32 -left-32 animate-float" />
          <div className="grid-bg" />
        </div>
        <div className="glass-card max-w-md w-full p-8 rounded-2xl border border-brand-red/20 relative z-10 flex flex-col items-center gap-4">
          <WifiOff size={32} className="text-brand-red/70" />
          <div>
            <h2 className="text-lg font-black tracking-wider text-white mb-2 uppercase">
              {roomNotFound ? 'Room Not Found' : 'Connection Error'}
            </h2>
            <p className="text-sm text-white/50">
              {roomNotFound
                ? 'This match room no longer exists or was never created.'
                : roomError}
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="btn-primary w-full mt-2"
          >
            ← Back to Arena Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={"h-screen overflow-hidden flex flex-col bg-bg-space text-white"}>
      
      {/* ── IDE Header ── */}
      <header className="glass-nav flex items-center justify-between px-5 py-2.5 flex-shrink-0 z-20">
        
        {/* Logo and problem status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-black text-white select-none">
            <img src={codeDuelLogo} alt="CodeDuel Logo" className="w-5 h-5 object-contain" />
            <span className="hidden sm:inline">CodeDuel</span>
          </div>

          <div className="h-4 w-px bg-white/10 hidden sm:block" />

          {/* Problem Badge */}
          <div className="flex items-center gap-2 bg-bg-panel border border-white/[0.05] rounded-xl px-3 py-1">
            {problemLoading ? (
              <span className="flex items-center gap-1.5 text-xs text-white/30 font-semibold">
                <Loader2 size={12} className="animate-spin text-brand-purple" /> Loading...
              </span>
            ) : problem ? (
              <>
                <span className={`text-[0.6rem] font-bold px-2 py-0.5 border rounded-full ${DIFF_COLOR[problem.difficulty] || ''}`}>
                  {problem.difficulty}
                </span>
                <span className="text-xs font-bold text-white/80">{problem.title}</span>
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-brand-red font-semibold">
                <WifiOff size={12} /> No Assigned Problem
              </span>
            )}
          </div>
        </div>

        {/* Players Progress Area */}
        <div className="flex items-center gap-3 flex-1 overflow-x-auto mx-4 scrollbar-none py-1">
          {Object.values(room?.participants || {}).map((participant) => {
            const uid = participant.userId;
            const profile = profiles[uid] || {};
            const isCurrent = uid === user?.uid;
            const pName = profile.displayName || (isCurrent ? displayName : `Player (${uid.slice(0, 6)})`);
            const progressVal = participant.progress ?? 0;
            const solved = participant.solved ?? false;
            
            return (
              <div key={uid} className={`flex-1 min-w-[100px] max-w-[160px] p-1.5 rounded-lg border bg-white/[0.01] transition-all ${
                isCurrent ? 'border-brand-purple/20 bg-brand-purple/[0.02]' : 'border-white/[0.03]'
              }`}>
                <div className="flex justify-between items-center text-[0.55rem] font-bold text-white/45 mb-1.5 px-0.5 truncate">
                  <span className="truncate pr-1 select-none">{pName}</span>
                  <span className={solved ? 'text-brand-green font-extrabold' : 'text-brand-violet font-semibold'}>
                    {solved ? '✓ Solved' : `${participant.score ?? 0} Passed`}
                  </span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      solved ? 'bg-brand-green' : isCurrent ? 'bg-gradient-brand' : 'bg-brand-pink'
                    }`}
                    style={{ width: `${progressVal}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons and Timer */}
        <div className="flex items-center gap-3">
          {/* Circular/Pill timer */}
          <div className={`flex items-center gap-1.5 font-mono-code text-xs font-bold px-3 py-1.5 rounded-xl border ${
            urgency === 'urgent' ? 'border-brand-red/40 text-brand-red bg-brand-red/5 animate-pulse' :
            urgency === 'warning' ? 'border-brand-amber/40 text-brand-amber bg-brand-amber/5' :
            'border-white/[0.05] text-white/80 bg-bg-panel'
          }`}>
            <Timer size={13} />
            <span>{formatTime(timeLeft)}</span>
          </div>

          <div className="h-4 w-px bg-white/10 hidden md:block" />

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <button 
              id="reset-btn" 
              onClick={handleReset} 
              title="Reset starter code"
              className="p-2 rounded-xl border border-white/[0.05] bg-bg-panel text-white/40 hover:text-white hover:border-white/15 transition-colors"
            >
              <RotateCcw size={13} />
            </button>
            <button 
              id="fullscreen-btn" 
              onClick={() => setEditorFull(!editorFull)} 
              title="Toggle Fullscreen"
              className="p-2 rounded-xl border border-white/[0.05] bg-bg-panel text-white/40 hover:text-white hover:border-white/15 transition-colors"
            >
              {editorFull ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
            <button 
              id="run-btn" 
              onClick={handleRun} 
              disabled={isRunning || !problem}
              className="btn-secondary py-1.5 px-3.5 text-xs"
            >
              <Play size={12} /> Run
            </button>
            <button 
              id="submit-btn" 
              onClick={handleSubmit} 
              disabled={isRunning || !problem}
              className="btn-primary py-1.5 px-3.5 text-xs shadow-none"
            >
              Submit ⚡
            </button>
            <div className="h-4 w-px bg-white/10 ml-1" />
            <button 
              id="leave-match-btn" 
              onClick={handleLeaveMatch} 
              className="btn-danger py-1.5 px-3.5 text-xs flex items-center gap-1.5 shadow-none"
            >
              Leave Match 🏳️
            </button>
          </div>
        </div>
      </header>

      {/* ── IDE Workspace ── */}
      <div className={`flex-1 overflow-hidden ${editorFull ? 'grid grid-cols-1' : 'grid grid-cols-[42%_58%]'}`}>
        
        {/* Left Side Panel: Problem Statement (Always visible, decluttered) */}
        {!editorFull && (
          <aside className="border-r border-white/[0.04] bg-[#06060c] flex flex-col overflow-y-auto">
            {problemLoading && <ProblemSkeleton />}

            {problemError && !problemLoading && (
              <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
                <WifiOff size={28} className="text-brand-red/60" />
                <div>
                  <p className="text-sm font-bold text-white/70 mb-1">Problem not found</p>
                  <code className="font-mono-code text-[0.65rem] text-brand-red bg-brand-red/5 px-2 py-1 rounded border border-brand-red/15 break-all">{problemError}</code>
                </div>
                <button
                  onClick={() => navigate('/lobby')}
                  className="btn-secondary text-xs py-1.5 px-4 mt-1"
                >
                  ← Return to Lobby
                </button>
              </div>
            )}

            {!problemLoading && !problemError && !problem && (
              <div className="flex flex-col items-center justify-center gap-3 p-12 text-center text-white/30">
                <Loader2 size={24} className="animate-spin text-brand-purple" />
                <p className="text-xs font-semibold">Loading problem...</p>
              </div>
            )}

            {problem && (
              <div className="p-5 flex flex-col gap-5">
                {/* Title row */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className={`text-[0.55rem] font-bold px-2 py-0.5 border rounded-full ${DIFF_COLOR[problem.difficulty] || ''}`}>
                      {problem.difficulty}
                    </span>
                    {problem.topic && (
                      <span className="text-[0.55rem] font-bold px-2 py-0.5 bg-brand-purple/10 border border-brand-purple/20 text-brand-violet rounded-full">
                        {problem.topic}
                      </span>
                    )}
                    {problem.rating > 0 && (
                      <span className="text-[0.55rem] font-bold px-2 py-0.5 bg-brand-amber/10 border border-brand-amber/20 text-brand-amber rounded-full">
                        ★ {problem.rating}
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-white/95 leading-tight">{problem.title}</h2>
                </div>

                {/* Description */}
                <div className="text-[0.82rem] text-slate-200/90 leading-relaxed font-sans select-text">
                  {parseProblemDescription(problem.description)}
                </div>

                {/* Input Format */}
                {problem.inputFormat && problem.inputFormat.length > 0 && (
                  <div>
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-white/35 mb-2.5">Input Format</p>
                    <ul className="space-y-1.5">
                      {problem.inputFormat.map((line, i) => (
                        <li key={i} className="text-[0.8rem] text-slate-300 flex items-start gap-2.5 bg-white/[0.015] border border-white/[0.03] rounded-lg px-3 py-2">
                          <span className="text-brand-purple font-bold font-mono text-[0.75rem] bg-brand-purple/10 px-1.5 py-0.5 rounded border border-brand-purple/20 select-none">{i + 1}</span> 
                          <span className="flex-1 leading-relaxed">{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Output Format */}
                {problem.outputFormat && problem.outputFormat.length > 0 && (
                  <div>
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-white/35 mb-2.5">Output Format</p>
                    <ul className="space-y-1.5">
                      {problem.outputFormat.map((line, i) => (
                        <li key={i} className="text-[0.8rem] text-slate-300 flex items-start gap-2.5 bg-white/[0.015] border border-white/[0.03] rounded-lg px-3 py-2">
                          <span className="text-brand-purple font-bold font-mono text-[0.75rem] bg-brand-purple/10 px-1.5 py-0.5 rounded border border-brand-purple/20 select-none">{i + 1}</span> 
                          <span className="flex-1 leading-relaxed">{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Sample Test Cases */}
                {problem.sampleTestCases && problem.sampleTestCases.length > 0 && (
                  <div>
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-white/35 mb-3">Sample Test Cases</p>
                    <div className="flex flex-col gap-3">
                      {problem.sampleTestCases.map((tc, i) => (
                        <div key={i} className="bg-bg-panel border border-white/[0.04] rounded-xl overflow-hidden">
                          <div className="px-3.5 py-2.5 bg-white/[0.01] border-b border-white/[0.04] text-[0.65rem] font-bold text-white/35 uppercase tracking-widest">
                            Example {i + 1}
                          </div>
                          <div className="p-3.5 flex flex-col gap-3.5">
                            <div>
                              <p className="text-[0.62rem] font-black uppercase tracking-wider text-slate-400/80 mb-1.5 flex items-center gap-1.5">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-cyan" /> Input
                              </p>
                              <IOBlock value={tc.input} structuredInput={tc.structuredInput ?? tc.structured_input} color="text-brand-cyan" />
                            </div>
                            <div>
                              <p className="text-[0.62rem] font-black uppercase tracking-wider text-slate-400/80 mb-1.5 flex items-center gap-1.5">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-green" /> Output
                              </p>
                              <IOBlock value={tc.output} color="text-brand-green" />
                            </div>
                            {tc.explanation && (
                              <div className="bg-brand-purple/5 border border-brand-purple/15 rounded-lg p-2.5">
                                <p className="text-[0.6rem] font-extrabold text-brand-violet mb-1">💡 Explanation</p>
                                <p className="text-[0.65rem] text-white/50 italic leading-relaxed">{tc.explanation}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Constraints */}
                {problem.constraints && (
                  <div>
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-white/35 mb-2.5">Constraints</p>
                    {Array.isArray(problem.constraints) ? (
                      <ul className="space-y-1.5">
                        {problem.constraints.map((c, i) => (
                          <li key={i} className="font-mono text-[0.78rem] text-slate-300 bg-white/[0.015] border border-white/[0.03] rounded-lg px-3.5 py-2.5 flex items-center gap-2.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan/80 shrink-0" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.entries(problem.constraints).map(([key, val]) => (
                          <li key={key} className="font-mono text-[0.78rem] text-slate-300 bg-white/[0.015] border border-white/[0.03] px-3.5 py-2.5 rounded-lg flex flex-col gap-1 justify-center">
                            <span className="text-brand-cyan/80 font-bold uppercase text-[0.6rem] tracking-wider">{key}</span>
                            <span className="font-semibold text-white/90">{val}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </aside>
        )}

        {/* Right Workspace Panel (Editor + Bottom console drawer) */}
        <main className="flex flex-col overflow-hidden bg-bg-panel relative">
          
          {/* Language Selector Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-bg-panel border-b border-white/[0.04] flex-shrink-0">
            <div className="flex items-center gap-2">
              <Code2 size={13} className="text-brand-purple" />
              <span className="text-[0.65rem] font-mono-code text-white/40">solution.code</span>
            </div>
            
            <div className="relative flex items-center">
              <select
                id="language-select"
                value={lang}
                onChange={e => handleLangChange(e.target.value)}
                className="appearance-none bg-bg-panel border border-white/[0.05] rounded-lg text-white/70 font-mono-code text-[0.65rem] py-1 pl-3 pr-8 cursor-pointer outline-none hover:border-white/15 focus:border-brand-purple/40"
              >
                <optgroup label="Scripting">
                  {LANGUAGES.filter(l => ['python'].includes(l.id)).map(l => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Systems">
                  {LANGUAGES.filter(l => ['c','cpp','java'].includes(l.id)).map(l => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </optgroup>
              </select>
              <ChevronDown size={10} className="absolute right-2.5 text-white/30 pointer-events-none" />
            </div>
          </div>

          {/* Java public class warning notice */}
          {lang === 'java' && (
            <div className="bg-brand-amber/10 border-b border-brand-amber/20 px-4 py-1.5 flex items-center gap-2 text-[0.7rem] text-brand-amber font-sans select-none flex-shrink-0">
              <span className="font-extrabold bg-brand-amber/20 px-1.5 py-0.5 rounded border border-brand-amber/30 uppercase text-[0.55rem] shrink-0">Main Class Notice</span>
              <span>Your entrypoint class must be named <strong>Main</strong> (e.g. <code>public class Main {'{ ... }'}</code>).</span>
            </div>
          )}

          {/* Monaco Editor Container */}
          <div className="flex-1 overflow-hidden min-h-0">
            <Editor
              height="100%"
              language={LANGUAGES.find(l => l.id === lang)?.monacoLang ?? 'javascript'}
              value={code}
              onChange={(val) => setCode(val ?? '')}
              onMount={(editor) => { editorRef.current = editor; }}
              theme="vs-dark"
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontLigatures: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                tabSize: 2,
                wordWrap: 'on',
                padding: { top: 12, bottom: 12 },
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true },
                readOnly: submitted,
                backgroundColor: '#08080f',
              }}
            />
          </div>

          {/* ── COLLAPSIBLE BOTTOM CONSOLE DRAWER ── */}
          <div className={`absolute bottom-0 left-0 right-0 z-20 flex flex-col
              bg-[#08080f]/95 backdrop-blur-md
              border-t border-white/[0.07]
              shadow-[0_-12px_40px_rgba(0,0,0,0.55)]
              transition-[height] duration-300 ease-in-out
              ${consoleOpen ? 'h-[300px]' : 'h-9'}
            `}>
            {/* Console header / Toggle trigger */}
            <button 
              onClick={() => setConsoleOpen(!consoleOpen)}
              className="flex items-center justify-between px-4 h-9 w-full flex-shrink-0 group hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
            >
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 text-[0.6rem] font-bold text-white/40 uppercase tracking-widest">
                  <Terminal size={11} /> Console Drawer
                </span>
                
                {consoleOpen && (
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => setConsoleTab('tests')}
                      className={`text-[0.6rem] font-extrabold uppercase px-2 py-0.5 rounded transition-all cursor-pointer ${
                        consoleTab === 'tests' ? 'text-brand-violet bg-brand-purple/10' : 'text-white/35 hover:text-white/60'
                      }`}
                    >
                      Run Results
                    </button>
                    <button 
                      onClick={() => setConsoleTab('output')}
                      className={`text-[0.6rem] font-extrabold uppercase px-2 py-0.5 rounded transition-all cursor-pointer ${
                        consoleTab === 'output' ? 'text-brand-violet bg-brand-purple/10' : 'text-white/35 hover:text-white/60'
                      }`}
                    >
                      Logs / Stdout
                    </button>
                  </div>
                )}
              </div>

              {/* Right side: verdict badge + chevron */}
              <div className="flex items-center gap-3">
                {runVerdict && (
                  <span className={`text-[0.6rem] font-bold px-2 py-0.5 rounded border transition-all ${
                    runVerdict === 'Success' || runVerdict === 'All Samples Passed' || runVerdict === 'Accepted'
                      ? 'text-brand-green bg-brand-green/10 border-brand-green/30'
                      : runVerdict === 'Compile Error'
                        ? 'text-brand-pink bg-brand-pink/10 border-brand-pink/30'
                        : 'text-brand-red bg-brand-red/10 border-brand-red/30'
                  }`}>
                    {runVerdict}
                  </span>
                )}
                {isRunning && (
                  <Loader2 size={11} className="animate-spin text-brand-purple" />
                )}
                <div className={`transition-transform duration-300 ${consoleOpen ? 'rotate-0' : 'rotate-180'}`}>
                  <ChevronDown size={12} className="text-white/30" />
                </div>
              </div>
            </button>

            {/* Console body content */}
            {consoleOpen && (
              <div className="flex-1 overflow-y-auto p-4 text-xs font-mono-code">
                {submitError && (
                  <div className="flex items-start gap-2 bg-brand-red/5 border border-brand-red/25 rounded-xl p-3 text-brand-red mb-3">
                    <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                    <span>{submitError}</span>
                  </div>
                )}

                {compileError && (
                  <div className="flex flex-col gap-1.5 mb-4">
                    <p className="text-[0.6rem] font-bold uppercase tracking-wider text-brand-pink">Compile Error</p>
                    <pre className="text-[0.7rem] text-brand-pink/90 bg-brand-pink/5 border border-brand-pink/20 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap select-text leading-relaxed">
                      {compileError}
                    </pre>
                  </div>
                )}

                {!submitError && isRunning && (
                  <div className="flex flex-col items-center justify-center gap-2 h-full py-8 text-white/30">
                    <Loader2 size={20} className="animate-spin text-brand-purple" />
                    <span className="text-[0.65rem] uppercase tracking-wider font-bold">Compiling &amp; Judging Code...</span>
                  </div>
                )}

                {!submitError && !isRunning && consoleTab === 'tests' && (
                  <div>
                    {/* Mode Toggle row */}
                    <div className="flex items-center gap-2 mb-3 border-b border-white/[0.04] pb-2">
                      <button
                        type="button"
                        onClick={() => {
                          setUseCustomInput(false);
                          setSubmitError(null);
                        }}
                        className={`px-3 py-1 rounded-lg text-[0.65rem] font-bold transition-all cursor-pointer ${
                          !useCustomInput
                            ? 'bg-white/10 text-white'
                            : 'text-white/40 hover:text-white/60'
                        }`}
                      >
                        Sample Test Cases
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUseCustomInput(true);
                          setSubmitError(null);
                        }}
                        className={`px-3 py-1 rounded-lg text-[0.65rem] font-bold transition-all cursor-pointer ${
                          useCustomInput
                            ? 'bg-white/10 text-white'
                            : 'text-white/40 hover:text-white/60'
                        }`}
                      >
                        Custom Input
                      </button>
                    </div>

                    {!useCustomInput ? (
                      /* Mode A: Standard sample cases */
                      <div>
                        {submitted && (
                          <div className="flex items-center gap-2 bg-brand-green/10 border border-brand-green/20 rounded-xl p-3.5 mb-4 text-brand-green animate-fade-in">
                            <CheckCircle size={16} className="flex-shrink-0" />
                            <div className="text-xs font-sans">
                              <strong className="font-extrabold block">Submission Successful!</strong>
                              All test cases passed. You solved this problem in {formatTime(durationSec - timeLeft)}.
                            </div>
                          </div>
                        )}
                        {!testResults || isCustomRun ? (
                          <div className="text-center py-8 text-white/20">
                            <span>Execute code run to check sample test assertions.</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {testResults.map((r, i) => {
                              const isSkipped = r.verdict === 'Skipped';
                              const isFailed = !r.passed;

                              const accentBorder = r.passed ? 'border-l-[3px] border-l-[#22c55e]'
                                : isSkipped ? 'border-l-[3px] border-l-white/20'
                                : ['Time Limit Exceeded','Runtime Error','Compile Error'].includes(r.verdict)
                                  ? 'border-l-[3px] border-l-[#f0729f]'
                                  : 'border-l-[3px] border-l-[#ef4444]';

                              const verdictColor = r.passed ? 'text-brand-green'
                                : isSkipped ? 'text-white/30'
                                : ['Time Limit Exceeded','Runtime Error','Compile Error'].includes(r.verdict)
                                  ? 'text-brand-pink'
                                  : 'text-brand-red';

                              const verdictBg = r.passed ? 'bg-brand-green/[0.12] border-brand-green/50'
                                : isSkipped ? 'bg-white/5 border-white/10'
                                : 'bg-brand-red/[0.12] border-brand-red/50';

                              return (
                                <div key={i} className={`rounded-xl border-y border-r overflow-hidden ${verdictBg} ${accentBorder}`}>
                                  <div className={`flex items-center justify-between px-3 py-2 border-b border-white/[0.05] ${verdictBg}`}>
                                    <span className="flex items-center gap-1.5">
                                      {r.passed ? (
                                        <CheckCircle size={12} className="text-brand-green" />
                                      ) : (
                                        <XCircle size={12} className={verdictColor} />
                                      )}
                                      <span className={`text-[0.65rem] font-extrabold ${verdictColor}`}>{r.label}</span>
                                    </span>
                                    <span className={`text-[0.6rem] font-bold px-2 py-0.5 rounded-full border ${verdictBg} ${verdictColor}`}>
                                      {r.verdict}{r.time && <span className="opacity-60 ml-1">{r.time}</span>}
                                    </span>
                                  </div>
                                  <div className="p-3 flex flex-col gap-2.5">
                                    <div>
                                      <p className="text-[0.55rem] font-bold uppercase tracking-wider text-white/25 mb-1.5 flex items-center gap-1.5">
                                        <span className="inline-block w-1 h-1 rounded-full bg-brand-cyan" /> Input
                                      </p>
                                      <IOBlock value={r.input} structuredInput={r.structuredInput ?? r.structured_input} color="text-brand-cyan" />
                                    </div>
                                    {r.expected !== '(hidden)' && (
                                      <div>
                                        <p className="text-[0.55rem] font-bold uppercase tracking-wider text-white/25 mb-1.5 flex items-center gap-1.5">
                                          <span className="inline-block w-1 h-1 rounded-full bg-brand-green" /> Expected Output
                                        </p>
                                        <IOBlock value={r.expected} color="text-brand-green" />
                                      </div>
                                    )}
                                    <div>
                                      <p className={`text-[0.55rem] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5 ${
                                        r.passed ? 'text-brand-green' : 'text-white/25'
                                      }`}>
                                        <span className={`inline-block w-1 h-1 rounded-full ${r.passed ? 'bg-brand-green' : 'bg-brand-red'}`} /> Your Output
                                      </p>
                                      {isSkipped ? (
                                        <p className="text-[0.7rem] text-white/25 italic">Skipped due to earlier failure</p>
                                      ) : (
                                        <IOBlock value={r.got} color={r.passed ? 'text-brand-green' : 'text-brand-red'} />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Mode B: Custom Input Mode */
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[0.6rem] font-bold text-white/40 uppercase tracking-widest">Custom Stdin</span>
                          <textarea
                            value={customInputText}
                            onChange={(e) => handleCustomInputChange(e.target.value)}
                            placeholder="Enter stdin input to pass to the compiler..."
                            rows={3}
                            className="w-full bg-[#05050a]/60 border border-white/[0.08] rounded-xl p-3 font-mono text-[0.7rem] text-white outline-none focus:border-brand-purple/40 resize-none leading-relaxed"
                          />
                          <div className="flex items-center justify-between mt-1 px-1">
                            <span className={`text-[0.62rem] font-medium ${customInputError ? 'text-brand-amber' : 'text-white/30'}`}>
                              {customInputError ? `⚠️ ${customInputError}` : '✓ Input loaded'}
                            </span>
                            <button
                              type="button"
                              onClick={handleRun}
                              disabled={isRunning || !!customInputError}
                              className="btn-secondary px-3 py-1 text-[0.65rem] flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none"
                            >
                              {isRunning ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                              Run Custom Code
                            </button>
                          </div>
                        </div>

                        {testResults && isCustomRun && testResults.length > 0 && (
                          <div className={`rounded-xl border-y border-r overflow-hidden mt-1 ${
                            testResults[0].verdict === 'Finished'
                              ? 'bg-brand-purple/[0.03] border-white/10 border-l-[3px] border-l-brand-purple'
                              : 'bg-brand-red/[0.07]   border-brand-red/40   border-l-[3px] border-l-[#ef4444]'
                          }`}>
                            <div className={`flex items-center justify-between px-3 py-2 border-b border-white/[0.05] ${
                              testResults[0].verdict === 'Finished' ? 'bg-brand-purple/[0.03]' : 'bg-brand-red/[0.07]'
                            }`}>
                              <span className="text-[0.65rem] font-extrabold uppercase tracking-wider text-white/70">
                                Output
                              </span>
                              <div className="flex items-center gap-1.5">
                                {testResults[0].executionTime !== undefined && (
                                  <span className="text-[0.6rem] text-white/30 font-mono bg-white/5 px-1.5 py-0.5 rounded">
                                    Time: {testResults[0].executionTime} ms
                                  </span>
                                )}
                                <span className={`text-[0.6rem] font-bold px-2 py-0.5 rounded border ${
                                  testResults[0].verdict === 'Finished'
                                    ? 'text-brand-purple bg-brand-purple/10 border-brand-purple/30'
                                    : 'text-brand-red bg-brand-red/10 border-brand-red/30'
                                }`}>
                                  {testResults[0].verdict}
                                </span>
                              </div>
                            </div>
                            <div className="p-3">
                              {testResults[0].got ? (
                                <IOBlock 
                                  value={testResults[0].got} 
                                  color={testResults[0].verdict === 'Finished' ? 'text-white' : 'text-brand-red'} 
                                />
                              ) : (
                                <span className="text-[0.7rem] text-white/20 italic">(no output)</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!submitError && !isRunning && consoleTab === 'output' && (
                  <div className="text-white/40 p-2 text-[0.65rem] bg-[#05050a]/40 border border-white/[0.03] rounded-lg min-h-24 font-mono leading-relaxed">
                    {compileError ? (
                      <span className="text-brand-pink">
                        Compilation failed. Check the Compile Error panel above.
                      </span>
                    ) : (
                      <code>
                        Stdout logs empty.<br />
                        --- Compilation Succeeded ---<br />
                        All symbols compiled successfully under standard settings.
                      </code>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

    </div>
  );
}
