import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Home, ArrowLeft, Search } from 'lucide-react';

/**
 * NotFoundPage
 *
 * Used both as the catch-all route (*) and by ProfilePage when the user
 * doesn't exist. Pass a `message` prop to customise the subtitle.
 */
export default function NotFoundPage({ message }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0B0C10] text-white flex flex-col relative overflow-hidden">

      {/* ── Background glows ── */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full opacity-[0.04] blur-[120px]"
          style={{ background: '#9d1f15' }} />
        <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full opacity-[0.03] blur-3xl"
          style={{ background: '#fbfb7a' }} />
        {/* Grid lines */}
        <div className="grid-bg opacity-30" />
      </div>

      {/* ── Navbar ── */}
      <div className="relative z-20">
        <Navbar />
      </div>

      {/* ── Content ── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">

        {/* Glitchy 404 number */}
        <div className="relative mb-6 select-none">
          <span
            className="text-[9rem] md:text-[13rem] font-black font-mono leading-none"
            style={{
              color: 'transparent',
              WebkitTextStroke: '2px rgba(157,31,21,0.5)',
              textShadow: '0 0 80px rgba(157,31,21,0.25), 4px 4px 0 rgba(157,31,21,0.12)',
            }}
          >
            404
          </span>
          {/* Red glow overlay */}
          <span
            className="absolute inset-0 text-[9rem] md:text-[13rem] font-black font-mono leading-none"
            style={{
              color: 'rgba(157,31,21,0.08)',
              filter: 'blur(2px)',
              userSelect: 'none',
            }}
            aria-hidden="true"
          >
            404
          </span>
        </div>

        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto"
          style={{ background: 'rgba(157,31,21,0.12)', border: '1px solid rgba(157,31,21,0.3)' }}
        >
          <Search size={28} className="text-[#9d1f15]" />
        </div>

        {/* Text */}
        <h1 className="text-2xl md:text-3xl font-black text-white mb-3">
          {message ? 'Player Not Found' : 'Page Not Found'}
        </h1>
        <p className="text-sm text-white/35 max-w-sm leading-relaxed mb-10">
          {message
            ? message
            : "The page you're looking for doesn't exist or was moved. Head back to the arena."}
        </p>

        {/* Divider */}
        <div className="w-24 h-px mb-10" style={{ background: 'linear-gradient(90deg, transparent, rgba(157,31,21,0.5), transparent)' }} />

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white/60 hover:text-white border border-white/[0.08] hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer"
          >
            <ArrowLeft size={15} /> Go Back
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white bg-[#9d1f15] hover:bg-[#b02218] transition-all cursor-pointer"
            style={{ boxShadow: '0 0 20px rgba(157,31,21,0.35)' }}
          >
            <Home size={15} /> Back to Arena
          </button>
        </div>

        {/* Tiny flavour text */}
        <p className="text-[0.6rem] text-white/15 font-mono mt-12 uppercase tracking-widest">
          cod3duel · error 404 · player not found
        </p>

      </main>
    </div>
  );
}
