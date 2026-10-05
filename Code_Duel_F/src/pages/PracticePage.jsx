import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import {
  BookOpen, Shuffle, Play, Send, RotateCcw,
  ChevronDown, ChevronUp, Maximize2, Minimize2,
  Loader2, WifiOff, CheckCircle, XCircle, Terminal,
  Code2, AlertTriangle, Clock, ArrowLeft,
  SkipForward, Trophy, Zap, Home,
} from 'lucide-react';
import { useProblem } from '../hooks/useProblem';
import { LANGUAGES, DEFAULT_LANGUAGE } from '../constants/languages';
import { getStarterCode } from '../constants/starterTemplates';
import { useAuth } from '../context/AuthContext';
import IOBlock from '../components/IOBlock';
import { parseProblemDescription } from '../utils/parseDescription';


/* ─── helpers ──────────────────────────────────────────────────── */

const DIFF_COLOR = {
  Easy:   'text-brand-green bg-brand-green/10 border-brand-green/20',
  Medium: 'text-brand-amber bg-brand-amber/10 border-brand-amber/20',
  Hard:   'text-brand-red   bg-brand-red/10   border-brand-red/20',
};

const VERDICT_META = {
  'Accepted':           { color: 'text-brand-green',  bg: 'bg-brand-green/[0.12] border-brand-green/50',  icon: <CheckCircle size={13} /> },
  'Wrong Answer':       { color: 'text-brand-red',    bg: 'bg-brand-red/[0.12]   border-brand-red/50',    icon: <XCircle     size={13} /> },
  'Time Limit Exceeded':{ color: 'text-brand-amber',  bg: 'bg-brand-amber/[0.12] border-brand-amber/50',  icon: <Clock       size={13} /> },
  'Runtime Error':      { color: 'text-brand-pink',   bg: 'bg-brand-pink/[0.12]  border-brand-pink/50',   icon: <AlertTriangle size={13} /> },
  'Compile Error':      { color: 'text-brand-pink',   bg: 'bg-brand-pink/10   border-brand-pink/25',   icon: <AlertTriangle size={13} /> },
  'Skipped':            { color: 'text-white/30',     bg: 'bg-white/5         border-white/10',         icon: <SkipForward size={13} /> },
  'All Samples Passed': { color: 'text-brand-green',  bg: 'bg-brand-green/10  border-brand-green/25',  icon: <CheckCircle size={13} /> },
};

const verdictMeta = (v) =>
  VERDICT_META[v] ?? { color: 'text-white/50', bg: 'bg-white/5 border-white/10', icon: <Terminal size={13} /> };





function ProblemSkeleton() {
  return (
    <div className="p-5 flex flex-col gap-4 animate-pulse">
      <div className="h-4 w-16 rounded bg-white/5" />
      <div className="h-7 w-3/5 rounded bg-white/5" />
      <div className="h-3 w-full rounded bg-white/5" />
      <div className="h-3 w-4/5 rounded bg-white/5" />
      <div className="h-28 rounded-xl bg-white/5 mt-2" />
      <div className="h-3 w-3/4 rounded bg-white/5" />
      <div className="h-3 w-2/3 rounded bg-white/5" />
    </div>
  );
}

/* ─── main component ────────────────────────────────────────────── */

export default function PracticePage() {
  const navigate  = useNavigate();
  const { user }  = useAuth();

  const [shuffleCount, setShuffleCount] = useState(0);
  // Pass undefined → useProblem calls /api/problems/random (same as DuelPage logic).
  // refetchKey=shuffleCount forces a fresh random fetch each time Shuffle is pressed.
  const { problem, loading: problemLoading, error: problemError } = useProblem(undefined, false, shuffleCount);

  // Editor
  const [lang, setLang]     = useState(DEFAULT_LANGUAGE);
  const [code, setCode]     = useState(getStarterCode(DEFAULT_LANGUAGE, null));
  const editorRef           = useRef(null);
  const [editorFull, setEditorFull] = useState(false);

  // Console panel
  const [consoleOpen, setConsoleOpen]   = useState(false);
  const [consoleTab,  setConsoleTab]    = useState('tests'); // 'tests' | 'submit'

  // Run state
  const [isRunning,    setIsRunning]    = useState(false);
  const [runResults,   setRunResults]   = useState(null);   // array of per-test results
  const [runVerdict,   setRunVerdict]   = useState(null);   // overall run verdict string
  const [runError,     setRunError]     = useState(null);   // compile error / network error
  const [compileError, setCompileError] = useState(null);

  // Submit state
  const [isSubmitting,    setIsSubmitting]    = useState(false);
  const [submitResult,    setSubmitResult]    = useState(null);
  const [submitError,     setSubmitError]     = useState(null);

  const COMPILER_URL = import.meta.env.VITE_COMPILER_URL || 'http://localhost:3005';

  // When problem or language changes, reset editor to starter code
  useEffect(() => {
    setCode(getStarterCode(lang, problem));
    setRunResults(null);
    setRunVerdict(null);
    setRunError(null);
    setCompileError(null);
    setSubmitResult(null);
    setSubmitError(null);
    setConsoleOpen(false);
  }, [problem, lang]);

  const handleLangChange = (newLang) => {
    setLang(newLang);
    setCode(getStarterCode(newLang, problem));
    setRunResults(null);
    setRunVerdict(null);
    setRunError(null);
    setCompileError(null);
  };

  const handleReset = () => {
    setCode(getStarterCode(lang, problem));
    setRunResults(null);
    setRunVerdict(null);
    setRunError(null);
    setCompileError(null);
    setSubmitResult(null);
    setSubmitError(null);
  };

  const handleShuffle = () => {
    setShuffleCount(c => c + 1);
  };

  // ── Real Run: calls /run on Compiler Server ──────────────────────
  const handleRun = useCallback(async () => {
    if (!problem || isRunning) return;

    setIsRunning(true);
    setConsoleOpen(true);
    setConsoleTab('tests');
    setRunResults(null);
    setRunVerdict(null);
    setRunError(null);
    setCompileError(null);

    try {
      const idToken = user ? await user.getIdToken() : '';
      const res = await fetch(`${COMPILER_URL}/run`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${idToken}`,
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
        setRunResults([]);
      } else {
        setRunResults(data.results ?? []);
        setRunVerdict(data.verdict);
      }
    } catch (err) {
      setRunError(err.message || 'Could not reach the compiler server.');
      setRunVerdict('Error');
    } finally {
      setIsRunning(false);
    }
  }, [problem, code, user, COMPILER_URL, isRunning, lang]);

  // ── Submit: calls /submit on Compiler Server ──────────────────────
  const handleSubmit = useCallback(async () => {
    if (!problem || isSubmitting || isRunning) return;

    setIsSubmitting(true);
    setConsoleOpen(true);
    setConsoleTab('submit');
    setSubmitResult(null);
    setSubmitError(null);

    try {
      const idToken = user ? await user.getIdToken() : '';
      const res = await fetch(`${COMPILER_URL}/submit`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ problemId: problem.id, code, language: lang }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `Server error ${res.status}`);
      }

      setSubmitResult(data);
    } catch (err) {
      setSubmitError(err.message || 'Could not reach the compiler server.');
    } finally {
      setIsSubmitting(false);
    }
  }, [problem, code, user, COMPILER_URL, isSubmitting, isRunning, lang]);

  const busy = isRunning || isSubmitting;

  /* ── render ───────────────────────────────────────────────────── */
  return (
    <div className="h-screen overflow-hidden flex flex-col bg-bg-space text-white">

      {/* ── Top Nav Bar ── */}
      <header className="glass-nav flex items-center justify-between px-5 py-2.5 flex-shrink-0 z-20">

        {/* Left: logo + breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            title="Go back"
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft size={15} />
          </button>
          <button
            onClick={() => navigate('/')}
            title="Go home"
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <Home size={15} />
          </button>

          <div className="flex items-center gap-2 text-sm font-black text-white select-none">
            <BookOpen size={15} className="text-brand-purple" />
            <span className="hidden sm:inline">Practice</span>
          </div>

          <div className="h-4 w-px bg-white/10 hidden sm:block" />

          {/* Problem badge */}
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
                <span className="text-xs font-bold text-white/80 max-w-[220px] truncate">{problem.title}</span>
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-brand-red font-semibold">
                <WifiOff size={12} /> No Problem
              </span>
            )}
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            id="shuffle-btn"
            onClick={handleShuffle}
            disabled={problemLoading}
            title="Load a random problem"
            className="flex items-center gap-1.5 p-2 rounded-xl border border-white/[0.05] bg-bg-panel text-white/40 hover:text-white hover:border-white/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Shuffle size={13} />
            <span className="text-xs hidden sm:inline">Random</span>
          </button>

          <button
            id="reset-btn"
            onClick={handleReset}
            title="Reset to starter code"
            className="p-2 rounded-xl border border-white/[0.05] bg-bg-panel text-white/40 hover:text-white hover:border-white/15 transition-colors"
          >
            <RotateCcw size={13} />
          </button>

          <button
            id="fullscreen-btn"
            onClick={() => setEditorFull(f => !f)}
            title="Toggle fullscreen editor"
            className="p-2 rounded-xl border border-white/[0.05] bg-bg-panel text-white/40 hover:text-white hover:border-white/15 transition-colors"
          >
            {editorFull ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          <div className="h-4 w-px bg-white/10" />

          <button
            id="run-btn"
            onClick={handleRun}
            disabled={busy || !problem}
            className="btn-secondary py-1.5 px-3.5 text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Run
          </button>

          <button
            id="submit-btn"
            onClick={handleSubmit}
            disabled={busy || !problem}
            className="btn-primary py-1.5 px-3.5 text-xs flex items-center gap-1.5 shadow-none disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Submit
          </button>
        </div>
      </header>

      {/* ── IDE Workspace ── */}
      <div className={`flex-1 overflow-hidden ${editorFull ? 'grid grid-cols-1' : 'grid grid-cols-[42%_58%]'}`}>

        {/* ── Left Panel: Problem Statement ── */}
        {!editorFull && (
          <aside className="border-r border-white/[0.04] bg-[#06060c] flex flex-col overflow-y-auto">
            {problemLoading && <ProblemSkeleton />}

            {problemError && !problemLoading && (
              <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
                <WifiOff size={28} className="text-brand-red/60" />
                <div>
                  <p className="text-sm font-bold text-white/70 mb-1">Failed to load problem</p>
                  <code className="font-mono text-[0.65rem] text-brand-red bg-brand-red/5 px-2 py-1 rounded border border-brand-red/15 break-all">
                    {problemError}
                  </code>
                </div>
                <button onClick={handleShuffle} className="btn-secondary text-xs py-1.5 px-4 mt-1">
                  <Shuffle size={12} /> Try another
                </button>
              </div>
            )}

            {!problemLoading && !problemError && !problem && (
              <div className="flex flex-col items-center justify-center gap-3 p-12 text-center text-white/30">
                <Loader2 size={24} className="animate-spin text-brand-purple" />
                <p className="text-xs font-semibold">Fetching problem…</p>
              </div>
            )}

            {problem && (
              <div className="p-5 flex flex-col gap-5">
                {/* Title row */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
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
                {problem.inputFormat?.length > 0 && (
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
                {problem.outputFormat?.length > 0 && (
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
                {problem.sampleTestCases?.length > 0 && (
                  <div>
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-white/35 mb-3">Sample Test Cases</p>
                    <div className="flex flex-col gap-3">
                      {problem.sampleTestCases.map((tc, i) => (
                        <div key={i} className="bg-bg-panel border border-white/[0.04] rounded-xl overflow-hidden">
                          {/* Header */}
                          <div className="px-3.5 py-2.5 bg-white/[0.01] border-b border-white/[0.04] flex items-center justify-between">
                            <span className="text-[0.65rem] font-bold text-white/35 uppercase tracking-widest">
                              Example {i + 1}
                            </span>
                            {tc.explanation && (
                              <span className="text-[0.55rem] text-brand-violet bg-brand-purple/10 border border-brand-purple/20 px-2 py-0.5 rounded-full font-bold">
                                has explanation
                              </span>
                            )}
                          </div>

                          <div className="p-3.5 flex flex-col gap-3.5">
                            {/* Input */}
                            <div>
                              <p className="text-[0.62rem] font-black uppercase tracking-wider text-slate-400/80 mb-1.5 flex items-center gap-1.5">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-cyan" />
                                Input
                              </p>
                              <IOBlock value={tc.input} structuredInput={tc.structuredInput ?? tc.structured_input} color="text-brand-cyan" />
                            </div>

                            {/* Output */}
                            <div>
                              <p className="text-[0.62rem] font-black uppercase tracking-wider text-slate-400/80 mb-1.5 flex items-center gap-1.5">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-green" />
                                Output
                              </p>
                              <IOBlock value={tc.output} color="text-brand-green" />
                            </div>

                            {/* Explanation */}
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

        {/* ── Right Panel: Editor + Console ── */}
        <main className="flex flex-col overflow-hidden bg-bg-panel relative">

          {/* Language selector bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-bg-panel border-b border-white/[0.04] flex-shrink-0">
            <div className="flex items-center gap-2">
              <Code2 size={13} className="text-brand-purple" />
              <span className="text-[0.65rem] font-mono text-white/40">solution.code</span>
            </div>

            <div className="relative flex items-center">
              <select
                id="language-select"
                value={lang}
                onChange={e => handleLangChange(e.target.value)}
                className="appearance-none bg-bg-panel border border-white/[0.05] rounded-lg text-white/70 font-mono text-[0.65rem] py-1 pl-3 pr-8 cursor-pointer outline-none hover:border-white/15 focus:border-brand-purple/40"
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

          {/* Monaco Editor — always fills remaining height; console floats over it */}
          <div className="flex-1 overflow-hidden min-h-0">
            <Editor
              height="100%"
              language={LANGUAGES.find(l => l.id === lang)?.monacoLang ?? 'javascript'}
              value={code}
              onChange={v => setCode(v ?? '')}
              onMount={editor => { editorRef.current = editor; }}
              theme="vs-dark"
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                renderLineHighlight: 'all',
                padding: { top: 16, bottom: 16 },
                lineNumbers: 'on',
                glyphMargin: false,
                folding: true,
                wordWrap: 'off',
                automaticLayout: true,
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                bracketPairColorization: { enabled: true },
              }}
            />
          </div>

          {/* ── Console — overlays editor from the bottom, slides up/down ── */}
          <div
            className={`absolute bottom-0 left-0 right-0 z-20 flex flex-col
              bg-[#08080f]/95 backdrop-blur-md
              border-t border-white/[0.07]
              shadow-[0_-12px_40px_rgba(0,0,0,0.55)]
              transition-[height] duration-300 ease-in-out
              ${consoleOpen ? 'h-[300px]' : 'h-9'}
            `}
          >
            {/* ── Handle bar (always visible) ── */}
            <button
              id="console-toggle"
              className="flex items-center justify-between px-4 h-9 w-full flex-shrink-0 group hover:bg-white/[0.02] transition-colors"
              onClick={() => setConsoleOpen(o => !o)}
            >
              <div className="flex items-center gap-2">
                {/* Drag handle visual */}
                <div className="flex flex-col gap-[3px] mr-1 opacity-30 group-hover:opacity-60 transition-opacity">
                  <div className="w-3 h-px bg-white rounded" />
                  <div className="w-3 h-px bg-white rounded" />
                </div>

                <Terminal size={12} className="text-brand-purple" />
                <span className="text-[0.6rem] font-bold text-white/50 uppercase tracking-widest group-hover:text-white/70 transition-colors">
                  Console
                </span>

                {/* Tab pills — visible only when open */}
                {consoleOpen && (
                  <div className="flex items-center gap-1 ml-3" onClick={e => e.stopPropagation()}>
                    <button
                      className={`text-[0.6rem] font-bold px-2.5 py-0.5 rounded-full border transition-colors ${
                        consoleTab === 'tests'
                          ? 'bg-brand-purple/20 border-brand-purple/30 text-brand-violet'
                          : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
                      }`}
                      onClick={() => setConsoleTab('tests')}
                    >
                      Test Cases
                    </button>
                    <button
                      className={`text-[0.6rem] font-bold px-2.5 py-0.5 rounded-full border transition-colors ${
                        consoleTab === 'submit'
                          ? 'bg-brand-purple/20 border-brand-purple/30 text-brand-violet'
                          : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
                      }`}
                      onClick={() => setConsoleTab('submit')}
                    >
                      Submit Result
                    </button>
                  </div>
                )}
              </div>

              {/* Right side: verdict badge + chevron */}
              <div className="flex items-center gap-2">
                {consoleTab === 'tests' && runVerdict && (
                  <span className={`flex items-center gap-1 text-[0.6rem] font-bold px-2 py-0.5 rounded border ${verdictMeta(runVerdict).bg} ${verdictMeta(runVerdict).color}`}>
                    {verdictMeta(runVerdict).icon} {runVerdict}
                  </span>
                )}
                {consoleTab === 'submit' && submitResult && (
                  <span className={`flex items-center gap-1 text-[0.6rem] font-bold px-2 py-0.5 rounded border ${verdictMeta(submitResult.verdict).bg} ${verdictMeta(submitResult.verdict).color}`}>
                    {verdictMeta(submitResult.verdict).icon} {submitResult.verdict}
                  </span>
                )}
                {/* Running indicator */}
                {(isRunning || isSubmitting) && (
                  <Loader2 size={11} className="animate-spin text-brand-purple" />
                )}
                <div className={`transition-transform duration-300 ${consoleOpen ? 'rotate-0' : 'rotate-180'}`}>
                  <ChevronDown size={12} className="text-white/30" />
                </div>
              </div>
            </button>

            {/* ── Console body (scrollable content area) ── */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">

              {/* ── TEST CASES TAB ── */}
              {consoleTab === 'tests' && (
                <>
                  {isRunning && (
                    <div className="flex items-center gap-2 text-white/40 text-xs py-4">
                      <Loader2 size={14} className="animate-spin text-brand-purple" />
                      Compiling and running sample test cases…
                    </div>
                  )}

                  {!isRunning && runError && (
                    <div className="mt-2 text-xs text-brand-red bg-brand-red/5 border border-brand-red/20 rounded-xl p-3 font-mono whitespace-pre-wrap">
                      ⚠️ {runError}
                    </div>
                  )}

                  {!isRunning && compileError && (
                    <div className="mt-2">
                      <p className="text-[0.6rem] font-bold uppercase tracking-wider text-brand-pink mb-1.5">Compile Error</p>
                      <pre className="text-[0.7rem] text-brand-pink/80 bg-brand-pink/5 border border-brand-pink/20 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap">
                        {compileError}
                      </pre>
                    </div>
                  )}

                  {!isRunning && !runError && !compileError && !runResults && (
                    <div className="flex flex-col items-center justify-center gap-2 py-6 text-white/20 text-xs text-center">
                      <Play size={20} className="text-white/10" />
                      <p>Press <span className="text-white/40 font-bold">Run</span> to test your code against sample test cases</p>
                    </div>
                  )}

                  {!isRunning && runResults && runResults.length > 0 && (
                    <div className="flex flex-col gap-3 pt-1">
                      {runResults.map((r) => (
                        <TestCaseCard key={r.index} result={r} />
                      ))}
                    </div>
                  )}

                  {!isRunning && runResults && runResults.length === 0 && !compileError && (
                    <p className="text-xs text-white/30 py-4">No sample test cases available for this problem.</p>
                  )}
                </>
              )}

              {/* ── SUBMIT TAB ── */}
              {consoleTab === 'submit' && (
                <>
                  {isSubmitting && (
                    <div className="flex items-center gap-2 text-white/40 text-xs py-4">
                      <Loader2 size={14} className="animate-spin text-brand-purple" />
                      Running against all hidden test cases…
                    </div>
                  )}

                  {!isSubmitting && submitError && (
                    <div className="mt-2 text-xs text-brand-red bg-brand-red/5 border border-brand-red/20 rounded-xl p-3 font-mono">
                      ⚠️ {submitError}
                    </div>
                  )}

                  {!isSubmitting && !submitResult && !submitError && (
                    <div className="flex flex-col items-center justify-center gap-2 py-6 text-white/20 text-xs text-center">
                      <Send size={20} className="text-white/10" />
                      <p>Press <span className="text-white/40 font-bold">Submit</span> to judge against all hidden test cases</p>
                    </div>
                  )}

                  {!isSubmitting && submitResult && (
                    <SubmitResultPanel result={submitResult} />
                  )}
                </>
              )}

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ─── TestCaseCard ─────────────────────────────────────────────── */

function TestCaseCard({ result }) {
  const [open, setOpen] = useState(true);
  const meta = verdictMeta(result.verdict);
  const accentBorder = result.passed ? 'border-l-[3px] border-l-[#22c55e]'
    : result.verdict === 'Skipped'   ? 'border-l-[3px] border-l-white/20'
    : result.verdict === 'Accepted'  ? 'border-l-[3px] border-l-[#22c55e]'
    : ['Time Limit Exceeded','Runtime Error','Compile Error'].includes(result.verdict)
      ? 'border-l-[3px] border-l-[#f0729f]'
      : 'border-l-[3px] border-l-[#ef4444]';

  return (
    <div className={`rounded-xl border-y border-r overflow-hidden ${meta.bg} ${accentBorder}`}>
      {/* Card header */}
      <button
        className={`flex items-center justify-between w-full px-3.5 py-2.5 text-left ${meta.bg} transition-all hover:brightness-110`}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className={`${meta.color} flex items-center`}>{meta.icon}</span>
          <span className={`text-[0.7rem] font-extrabold ${meta.color}`}>
            Test Case {result.index}
          </span>
          {result.time && (
            <span className="text-[0.6rem] text-white/30 font-mono bg-white/5 px-1.5 py-0.5 rounded">
              {result.time}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-[0.6rem] font-bold px-2.5 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
            {meta.icon} {result.verdict}
          </span>
          <span className="text-white/30 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Card body */}
      {open && (
        <div className="px-3.5 pb-3.5 flex flex-col gap-2.5 border-t border-white/[0.06]">
          {/* Input */}
          <div>
            <p className="text-[0.55rem] font-bold uppercase tracking-wider text-white/25 mb-1.5 flex items-center gap-1.5">
              <span className="inline-block w-1 h-1 rounded-full bg-brand-cyan" /> Input
            </p>
            {result.input ? (
              <IOBlock value={result.input} structuredInput={result.structuredInput ?? result.structured_input} color="text-brand-cyan" />
            ) : (
              <span className="text-[0.7rem] text-white/20 italic">(empty)</span>
            )}
          </div>

          {/* Expected */}
          <div>
            <p className="text-[0.55rem] font-bold uppercase tracking-wider text-white/25 mb-1.5 flex items-center gap-1.5">
              <span className="inline-block w-1 h-1 rounded-full bg-brand-green" /> Expected Output
            </p>
            {result.expected ? (
              <IOBlock value={result.expected} color="text-brand-green" />
            ) : (
              <span className="text-[0.7rem] text-white/20 italic">(empty)</span>
            )}
          </div>

          {/* Got */}
          <div>
            <p className="text-[0.55rem] font-bold uppercase tracking-wider text-white/25 mb-1.5 flex items-center gap-1.5">
              <span className={`inline-block w-1 h-1 rounded-full ${result.passed ? 'bg-brand-green' : 'bg-brand-red'}`} /> Your Output
            </p>
            {result.verdict === 'Skipped' ? (
              <p className="text-[0.7rem] text-white/25 italic">Skipped due to earlier failure</p>
            ) : result.got ? (
              <IOBlock value={result.got} color={result.passed ? 'text-brand-green' : 'text-brand-red'} />
            ) : (
              <span className="text-[0.7rem] text-white/20 italic">(no output)</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── SubmitResultPanel ────────────────────────────────────────── */

function SubmitResultPanel({ result }) {
  const meta    = verdictMeta(result.verdict);
  const passed  = result.passed ?? 0;
  const total   = result.total  ?? 0;
  const pct     = total > 0 ? Math.round((passed / total) * 100) : 0;
  const isAC    = result.success;

  return (
    <div className="flex flex-col gap-4 pt-1">
      {/* Verdict banner */}
      <div className={`rounded-xl border p-4 flex items-center gap-3 ${meta.bg}`}>
        <span className={`${meta.color} flex-shrink-0`} style={{ transform: 'scale(1.5)' }}>
          {isAC ? <Trophy size={18} /> : meta.icon}
        </span>
        <div>
          <p className={`text-sm font-black ${meta.color}`}>{result.verdict}</p>
          {total > 0 && (
            <p className="text-[0.7rem] text-white/40 mt-0.5">
              {passed} / {total} test cases passed
            </p>
          )}
        </div>
        {total > 0 && (
          <div className="ml-auto text-right">
            <p className={`text-xl font-black font-mono ${meta.color}`}>{pct}%</p>
            <p className="text-[0.6rem] text-white/25">score</p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div>
          <div className="flex justify-between text-[0.6rem] text-white/30 mb-1.5">
            <span>Test cases</span>
            <span>{passed}/{total}</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${isAC ? 'bg-brand-green' : 'bg-brand-red'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Compile error if any */}
      {result.compileError && (
        <div>
          <p className="text-[0.6rem] font-bold uppercase tracking-wider text-brand-pink mb-1.5">Compile Error</p>
          <pre className="text-[0.7rem] text-brand-pink/80 bg-brand-pink/5 border border-brand-pink/20 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap">
            {result.compileError}
          </pre>
        </div>
      )}

      {/* Encouragement */}
      {isAC && (
        <div className="flex items-center gap-2 text-brand-green text-xs font-bold px-3 py-2 bg-brand-green/5 border border-brand-green/20 rounded-xl">
          <Zap size={13} className="flex-shrink-0" /> All hidden test cases passed! Great work.
        </div>
      )}
    </div>
  );
}
