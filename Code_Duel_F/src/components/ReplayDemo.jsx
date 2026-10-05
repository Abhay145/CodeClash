import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

export default function ReplayDemo() {
  // Replay tab mock states
  const [replayPlaying, setReplayPlaying] = useState(true);
  const [replayProgress, setReplayProgress] = useState(40);

  // Replay progress bar simulator
  useEffect(() => {
    if (!replayPlaying) return;
    const interval = setInterval(() => {
      setReplayProgress(prev => {
        if (prev >= 100) return 0;
        return prev + 1;
      });
    }, 150);
    return () => clearInterval(interval);
  }, [replayPlaying]);

  return (
    <div className="flex flex-col gap-3.5 animate-fade-in">
      <div className="p-4 rounded-xl bg-[#29292B] border border-[#c9c7ba]/5">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <RotateCcw size={13} className="text-[#9d1f15] animate-spin" />
            Replay Playback
          </span>
          <span className="text-[0.6rem] font-mono text-[#c9c7ba]/40">match_id_6942a</span>
        </div>

        {/* Timeline Scrub */}
        <div className="h-1 bg-[#1e1e20] rounded-full overflow-hidden mb-2">
          <div className="h-full bg-[#9d1f15]" style={{ width: `${replayProgress}%` }} />
        </div>
        <div className="flex justify-between text-[0.55rem] font-mono text-[#c9c7ba]/30">
          <span>01:14</span>
          <span>04:12</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between text-[0.65rem]">
        <div className="flex gap-2">
          <button
            onClick={() => setReplayPlaying(!replayPlaying)}
            className="px-3 py-1.5 rounded-lg bg-[#c9c7ba]/5 text-white hover:bg-[#c9c7ba]/10 border border-[#c9c7ba]/5 flex items-center gap-1 font-bold"
          >
            {replayPlaying ? <Pause size={10} /> : <Play size={10} />}
            <span>{replayPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button className="px-3 py-1.5 rounded-lg bg-[#c9c7ba]/5 text-white/50 border border-[#c9c7ba]/5 font-bold">2x Speed</button>
        </div>
        <span className="text-[#c9c7ba]/45 font-bold uppercase tracking-wider text-[0.55rem]">Keystroke recording active</span>
      </div>
    </div>
  );
}
