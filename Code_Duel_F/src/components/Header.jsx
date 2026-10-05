import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles, Sword, ArrowRight, Zap, Lock,
  Plus, Hash, Loader2, Globe, ChevronRight
} from 'lucide-react';
import BattlePreview from './BattlePreview';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';



// ─── Header ───────────────────────────────────────────────────────────────────
export default function Header({ onStartDuel }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-6 pt-12 pb-20 md:pt-20 md:pb-28">
      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-center">

        {/* ── Left: Copy + Match Panel ── */}
        <div className="flex flex-col items-start text-left gap-8 animate-fade-up">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#9d1f15]/10 border border-[#9d1f15]/20">
            <Sparkles size={12} className="text-[#fbfb7a] animate-pulse" />
            <span className="text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-[#fbfb7a]">
              Real-Time Multiplayer Coding Arena
            </span>
          </div>

          {/* Headline */}
          <div>
            <h1 className="text-[clamp(2.5rem,5.5vw,4.5rem)] font-black leading-[1.08] tracking-[-2.5px] mb-4 text-white">
              Code. Clash.<br />
              <span className="text-gradient-hero">Conquer.</span>
            </h1>
            <p className="text-base md:text-lg text-[#c9c7ba]/60 leading-relaxed max-w-lg">
              Challenge developers worldwide in instant, 1v1 timed coding battles. Write clean code, run test cases in isolated sandboxes, and climb the global ladder.
            </p>
          </div>

          {/* CTA Button */}
          <button
            onClick={() => {
              if (!user) {
                navigate('/auth', { state: { from: { pathname: '/clash' } } });
              } else {
                navigate('/clash');
              }
            }}
            className="px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest text-white flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #9d1f15, #bd2e24)',
              boxShadow: '0 6px 24px rgba(157,31,21,0.4)',
              border: '1px solid rgba(251,251,122,0.2)'
            }}
          >
            <Sword size={16} className="text-[#fbfb7a]" />
            CLASH NOW
            <ChevronRight size={15} />
          </button>

          {/* Live indicator */}
          <div className="flex gap-3 items-center">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#fbfb7a] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#fbfb7a]" />
            </span>
            <span className="text-xs text-[#c9c7ba]/40 font-bold uppercase tracking-widest">
              1,420 coders active in matchmaking right now
            </span>
          </div>
        </div>

        {/* ── Right: Battle Preview Terminal ── */}
        <BattlePreview />

      </div>
    </main>
  );
}
