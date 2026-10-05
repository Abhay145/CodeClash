import { ExternalLink } from 'lucide-react';
import codeDuelLogo from '../assets/code_duel_logo.png';

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-[#c9c7ba]/5 py-12 mt-auto bg-black/[0.15]">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5 text-sm font-black tracking-tight text-[#c9c7ba]/60 select-none">
          <img src={codeDuelLogo} alt="CodeDuel Logo" className="w-7 h-7 object-contain" />
          <span className="font-extrabold text-white">CodeDuel</span>
        </div>

        <div className="flex flex-wrap justify-center gap-8 text-[0.7rem] font-bold uppercase tracking-wider text-[#c9c7ba]/40">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#live-battles" className="hover:text-white transition-colors">Live Battles</a>
          <a href="#leaderboard" className="hover:text-white transition-colors">Leaderboard</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
            Github <ExternalLink size={10} />
          </a>
        </div>

        <p className="text-[0.65rem] text-[#c9c7ba]/30 font-medium">
          © 2026 CodeDuel. Engineered for competitive excellence.
        </p>
      </div>
    </footer>
  );
}
