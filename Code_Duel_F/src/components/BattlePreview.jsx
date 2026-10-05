import { useState, useEffect } from 'react';
import { CheckCircle2, Award } from 'lucide-react';
import TypingTerminal from './TypingTerminal';

const MOCK_CODES = {
  javascript: `function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const comp = target - nums[i];
    if (map.has(comp)) {
      return [map.get(comp), i];
    }
    map.set(nums[i], i);
  }
  return [];
}`,
  python: `def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []`,
  cpp: `vector<int> twoSum(vector<int>& nums, int target) {
    unordered_map<int, int> seen;
    for (int i = 0; i < nums.size(); ++i) {
        int complement = target - nums[i];
        if (seen.count(complement)) {
            return {seen[complement], i};
        }
        seen[nums[i]] = i;
    }
    return {};
}`
};

export default function BattlePreview() {
  const [activeLang, setActiveLang] = useState('javascript');

  // Hero Demo Match states
  const [demoP1Progress, setDemoP1Progress] = useState(25);
  const [demoP2Progress, setDemoP2Progress] = useState(10);
  const [demoStatus, setDemoStatus] = useState('Compiling...');
  const [testCasesPassed, setTestCasesPassed] = useState(0);

  // Simulated live arena progress loop
  useEffect(() => {
    const timer = setInterval(() => {
      setDemoP1Progress(prev => {
        if (prev >= 100) {
          // Reset after a while
          setTimeout(() => {
            setDemoP1Progress(10);
            setDemoP2Progress(5);
            setDemoStatus('Compiling...');
            setTestCasesPassed(0);
          }, 4000);
          return 100;
        }
        const next = prev + Math.floor(Math.random() * 8) + 2;
        return Math.min(next, 100);
      });

      setDemoP2Progress(prev => {
        if (prev >= 100) return 100;
        const next = prev + Math.floor(Math.random() * 5) + 1;
        return Math.min(next, 100);
      });
    }, 800);

    return () => clearInterval(timer);
  }, []);

  // Sync test case execution state based on progress
  useEffect(() => {
    if (demoP1Progress < 40) {
      setDemoStatus('Writing code...');
      setTestCasesPassed(0);
    } else if (demoP1Progress < 65) {
      setDemoStatus('Compiling...');
      setTestCasesPassed(0);
    } else if (demoP1Progress < 85) {
      setDemoStatus('Running tests...');
      setTestCasesPassed(2);
    } else if (demoP1Progress < 100) {
      setDemoStatus('Executing hard test cases...');
      setTestCasesPassed(4);
    } else {
      setDemoStatus('All tests passed!');
      setTestCasesPassed(5);
    }
  }, [demoP1Progress]);

  return (
    <div className="relative animate-scale-up" style={{ animationDelay: '0.1s' }}>
      <div className="absolute inset-0 bg-gradient-to-tr from-[#9d1f15]/20 to-[#fbfb7a]/20 blur-3xl opacity-20 scale-90 -z-10 animate-pulse" />

      <div className="terminal-window terminal-scanline">
        {/* Terminal Title Bar */}
        <div className="terminal-header justify-between bg-[#1e1e20]">
          <div className="flex gap-1.5">
            <div className="terminal-dot bg-[#9d1f15] animate-pulse" />
            <div className="terminal-dot bg-[#fbfb7a]" />
            <div className="terminal-dot bg-[#c9c7ba]" />
          </div>
          <div className="text-[0.65rem] font-mono-code text-[#c9c7ba]/30">codeduel.io/live-battle/1v1-sim</div>
          <div className="flex items-center gap-1.5 text-[0.65rem] font-bold text-[#fbfb7a] font-mono-code bg-[#fbfb7a]/5 border border-[#fbfb7a]/15 px-2 py-0.5 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-[#fbfb7a] animate-ping" />
            <span>⏱ 12:45</span>
          </div>
        </div>

        {/* Player Sync Status bar */}
        <div className="flex justify-between items-center bg-[#29292B] border-b border-[#c9c7ba]/5 px-5 py-4">
          <div className="flex-1 max-w-[42%]">
            <div className="flex justify-between text-[0.65rem] font-bold text-[#c9c7ba]/60 mb-2">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-[#9d1f15] rounded-full" />
                you (dev_ace)
              </span>
              <span className="text-[#9d1f15] font-mono font-black">{demoP1Progress}%</span>
            </div>
            <div className="h-1.5 bg-[#1e1e20] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#9d1f15] to-[#fbfb7a] rounded-full transition-all duration-300" style={{ width: `${demoP1Progress}%` }} />
            </div>
          </div>
          <div className="text-xs font-bold text-[#c9c7ba]/25 flex-shrink-0 px-2 select-none">VS</div>
          <div className="flex-1 max-w-[42%] text-right">
            <div className="flex justify-between text-[0.65rem] font-bold text-[#c9c7ba]/60 mb-2">
              <span className="text-[#fbfb7a] font-mono font-black">{demoP2Progress}%</span>
              <span className="flex items-center gap-1 ml-auto">
                ai_overlord
                <span className="w-1.5 h-1.5 bg-[#fbfb7a] rounded-full" />
              </span>
            </div>
            <div className="h-1.5 bg-[#1e1e20] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-l from-[#fbfb7a] to-[#9d1f15] rounded-full ml-auto transition-all duration-300" style={{ width: `${demoP2Progress}%` }} />
            </div>
          </div>
        </div>

        {/* Split editor / problem preview */}
        <div className="grid grid-cols-[42%_58%] min-h-[280px] bg-[#1e1e20]">
          {/* Left Mini problem description */}
          <div className="p-5 border-r border-[#c9c7ba]/5 text-[0.7rem] text-[#c9c7ba]/50 leading-relaxed">
            <div className="flex gap-1.5 mb-3">
              <span className="px-2 py-0.5 rounded-full bg-[#fbfb7a]/5 text-[#fbfb7a] border border-[#fbfb7a]/15 font-bold text-[0.55rem]">Easy</span>
              <span className="px-2 py-0.5 rounded-full bg-[#9d1f15]/10 text-white border border-[#9d1f15]/20 font-bold text-[0.55rem]">Arrays</span>
            </div>
            <h3 className="font-extrabold text-white text-xs mb-2">Two Sum</h3>
            <p className="mb-3 text-[#c9c7ba]/60">
              Given an array of integers <code className="font-mono-code text-[#fbfb7a] bg-[#fbfb7a]/5 px-1 rounded border border-[#fbfb7a]/10">nums</code> and an integer <code className="font-mono-code text-[#fbfb7a] bg-[#fbfb7a]/5 px-1 rounded border border-[#fbfb7a]/10">target</code>, return indices of the two numbers such that they add up to target.
            </p>
            <div className="p-2.5 rounded-lg bg-[#29292B] border border-[#c9c7ba]/5 font-mono-code">
              <div className="text-[0.55rem] font-bold text-[#c9c7ba]/30 uppercase tracking-wider mb-1">Example Case</div>
              <div className="text-[#fbfb7a] text-[0.6rem]">Input: [2, 7, 11, 15], 9</div>
              <div className="text-[#c9c7ba]/40 text-[0.6rem]">Output: [0, 1]</div>
            </div>
          </div>

          {/* Right Typing screen */}
          <div className="bg-[#29292B] font-mono-code text-[0.65rem] leading-relaxed text-[#c9c7ba]/85 relative flex flex-col">
            {/* Lang Tab Header */}
            <div className="flex border-b border-[#c9c7ba]/5 bg-[#1e1e20]">
              {Object.keys(MOCK_CODES).map(lang => (
                <button
                  key={lang}
                  onClick={() => setActiveLang(lang)}
                  className={`px-3 py-1.5 border-r border-[#c9c7ba]/5 transition-colors uppercase font-bold text-[0.55rem] ${activeLang === lang ? 'bg-[#29292B] text-[#fbfb7a] border-t border-t-[#9d1f15]' : 'text-[#c9c7ba]/30 hover:text-[#c9c7ba]/60'}`}
                >
                  {lang}
                </button>
              ))}
            </div>

            {/* Editor Code Area */}
            <div className="p-4 flex-1 overflow-y-auto max-h-[220px]">
              <TypingTerminal activeLang={activeLang} MOCK_CODES={MOCK_CODES} />
            </div>
          </div>
        </div>

        {/* Bottom execution logs bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#29292B] border-t border-[#c9c7ba]/5">
          <div className="flex items-center gap-2">
            <span className={`inline-flex w-2 h-2 rounded-full ${demoStatus.includes('passed') ? 'bg-[#fbfb7a]' : 'bg-[#9d1f15] animate-pulse'}`} />
            <span className={`text-[0.6rem] font-bold uppercase tracking-wider ${demoStatus.includes('passed') ? 'text-[#fbfb7a]' : 'text-[#c9c7ba]/45'}`}>
              Status: {demoStatus}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[0.6rem] font-bold text-[#c9c7ba]/30">
            <span className="font-mono">Tests: {testCasesPassed}/5</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((tc) => (
                <span
                  key={tc}
                  className={`w-2 h-2 rounded-full border border-[#c9c7ba]/5 ${tc <= testCasesPassed ? 'bg-[#fbfb7a] border-[#fbfb7a]/20' : 'bg-[#1e1e20]'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating UI Elements */}
      <div className="absolute -top-4 -right-4 animate-float px-3.5 py-2.5 rounded-xl glass-card text-xs font-bold text-[#fbfb7a] shadow-xl shadow-[#9d1f15]/5 border-[#fbfb7a]/20 flex items-center gap-2">
        <CheckCircle2 size={14} className="text-[#fbfb7a] animate-bounce" />
        <span>All Test Cases Passed!</span>
      </div>
      <div className="absolute -bottom-4 -left-4 animate-float px-3.5 py-2.5 rounded-xl glass-card text-xs font-bold text-[#c9c7ba] shadow-xl shadow-[#9d1f15]/5 border-[#c9c7ba]/20 flex items-center gap-2" style={{ animationDelay: '-2s' }}>
        <Award size={14} className="text-[#9d1f15] animate-pulse" />
        <span>+25 Rating (1640)</span>
      </div>
    </div>
  );
}
