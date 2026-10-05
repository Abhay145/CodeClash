import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import codeDuelLogo from '../assets/code_duel_logo.png';
import {
  Sword, ArrowRight, LogOut, History, ChevronDown, User,
  Trophy, Shield, Activity, Lock, Globe, BookOpen, Layers
} from 'lucide-react';

export default function Navbar({ onStartDuel }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const dropdownRef = useRef(null);

  // Fetch profile details for ELO and tallies in navbar
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const loadProfile = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/users/${user.uid}`);
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } catch (err) {
        console.warn('Navbar profile sync failed:', err.message);
      }
    };
    
    loadProfile();
    // Listen to visibility or route changes to refresh stats
    const interval = setInterval(loadProfile, 10000);
    return () => clearInterval(interval);
  }, [user, location.pathname]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      setDropdownOpen(false);
      await logout();
      navigate('/');
    } catch (err) {
      console.error('Logout failed:', err.message);
    }
  };

  const isLandingPage = location.pathname === '/';

  return (
    <nav className="sticky top-0 z-50 glass-nav">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        
        {/* LOGO */}
        <div className="flex items-center gap-2.5 text-lg font-black tracking-tight cursor-pointer flex-shrink-0" onClick={() => navigate('/')}>
          <img src={codeDuelLogo} alt="CodeDuel Logo" className="w-8 h-8 object-contain" />
          <span className="font-extrabold text-white">Code<span className="text-gradient-brand">Duel</span></span>
        </div>

        {/* CENTER NAVIGATION LINKS (Expandable for new features) */}
        <div className="hidden md:flex items-center gap-8">
          {user ? (
            <>
              <button
                onClick={() => navigate('/clash')}
                className={`text-xs font-bold uppercase tracking-wider transition-colors ${
                  location.pathname === '/clash' ? 'text-white border-b-2 border-danger pb-1 mt-1' : 'text-[#c9c7ba]/65 hover:text-white'
                }`}
              >
                Clash Now
              </button>
              <button
                onClick={() => navigate('/friends')}
                className={`text-xs font-bold uppercase tracking-wider transition-colors ${
                  location.pathname === '/friends' ? 'text-white border-b-2 border-danger pb-1 mt-1' : 'text-[#c9c7ba]/65 hover:text-white'
                }`}
              >
                Friends
              </button>
              <button
                onClick={() => navigate('/arena')}
                className={`text-xs font-bold uppercase tracking-wider transition-colors ${
                  location.pathname === '/arena' ? 'text-white border-b-2 border-danger pb-1 mt-1' : 'text-[#c9c7ba]/65 hover:text-white'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate('/practice')}
                className={`text-xs font-bold uppercase tracking-wider transition-colors ${
                  location.pathname === '/practice' ? 'text-white border-b-2 border-danger pb-1 mt-1' : 'text-[#c9c7ba]/65 hover:text-white'
                }`}
              >
                Practice
              </button>
              <button
                onClick={() => navigate('/submissions')}
                className={`text-xs font-bold uppercase tracking-wider transition-colors ${
                  location.pathname === '/submissions' ? 'text-white border-b-2 border-danger pb-1 mt-1' : 'text-[#c9c7ba]/65 hover:text-white'
                }`}
              >
                Submissions
              </button>
            </>
          ) : (
            <>
              {isLandingPage ? (
                <>
                  <a href="#features" className="text-xs font-bold uppercase tracking-wider text-[#c9c7ba]/65 hover:text-white transition-colors">Features</a>
                  <a href="#live-battles" className="text-xs font-bold uppercase tracking-wider text-[#c9c7ba]/65 hover:text-white transition-colors flex items-center gap-1.5">
                    Live Battles
                    <span className="inline-flex w-2 h-2 rounded-full bg-[#fbfb7a] animate-pulse" />
                  </a>
                  <a href="#leaderboard" className="text-xs font-bold uppercase tracking-wider text-[#c9c7ba]/65 hover:text-white transition-colors">Leaderboard</a>
                  <a href="#faq" className="text-xs font-bold uppercase tracking-wider text-[#c9c7ba]/65 hover:text-white transition-colors">FAQ</a>
                </>
              ) : (
                <button
                  onClick={() => navigate('/')}
                  className="text-xs font-bold uppercase tracking-wider text-[#c9c7ba]/65 hover:text-white transition-colors"
                >
                  Home
                </button>
              )}
            </>
          )}
        </div>

        {/* RIGHT SIDE ACTIONS */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative" ref={dropdownRef}>
              
              {/* Profile Menu Trigger */}
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/[0.06] hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer"
              >
                <div className="w-6 h-6 rounded-lg bg-gradient-brand flex items-center justify-center text-[0.65rem] font-black text-white uppercase overflow-hidden">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    user.displayName?.slice(0, 2).toUpperCase() || user.email?.slice(0, 2).toUpperCase() || 'CD'
                  )}
                </div>
                <span className="hidden sm:inline text-xs font-bold text-white max-w-[100px] truncate">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
                <ChevronDown size={12} className={`text-muted transition-transform duration-200 ${dropdownOpen ? 'rotate-180 text-white' : ''}`} />
              </button>

              {/* Profile Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2.5 w-64 rounded-2xl border border-white/[0.08] bg-[#151A22] p-4 shadow-2xl animate-scale-up">
                  
                  {/* Dropdown Header */}
                  <div className="flex items-center gap-3 pb-3 border-b border-white/[0.04] mb-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center text-xs font-black text-white uppercase overflow-hidden">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        user.displayName?.slice(0, 2).toUpperCase() || user.email?.slice(0, 2).toUpperCase() || 'CD'
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-black text-white block truncate leading-none">
                        {profile?.displayName || user.displayName || user.email?.split('@')[0]}
                      </span>
                      {profile?.username && (
                        <span className="text-[0.6rem] text-white/30 font-mono block mt-0.5">@{profile.username}</span>
                      )}
                      <span className="text-[0.6rem] text-muted block truncate mt-0.5">
                        {user.email}
                      </span>
                    </div>
                  </div>

                  {/* Rating / ELO */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-[#fbfb7a]/20 bg-[#fbfb7a]/5 mb-3">
                    <div className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase text-[#fbfb7a]">
                      <Trophy size={12} /> Rated ELO
                    </div>
                    <span className="text-xs font-mono font-black text-[#fbfb7a]">
                      {profile?.rating ?? 1000}
                    </span>
                  </div>

                  {/* Stats Mini Grid */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-2 text-center">
                      <div className="flex items-center justify-center gap-1 text-[0.55rem] font-bold text-muted uppercase tracking-wider">
                        <Globe size={9} /> Public
                      </div>
                      <span className="text-[0.65rem] font-mono font-black text-success mt-1 block">
                        {profile?.matchesWonPublic ?? 0}W - {profile?.matchesLostPublic ?? 0}L
                      </span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-2 text-center">
                      <div className="flex items-center justify-center gap-1 text-[0.55rem] font-bold text-muted uppercase tracking-wider">
                        <Lock size={9} /> Private
                      </div>
                      <span className="text-[0.65rem] font-mono font-black text-success/80 mt-1 block">
                        {profile?.matchesWonPrivate ?? 0}W - {profile?.matchesLostPrivate ?? 0}L
                      </span>
                    </div>
                  </div>

                  {/* Links */}
                  <div className="flex flex-col gap-1 border-t border-white/[0.04] pt-2">
                    <button
                      onClick={() => { setDropdownOpen(false); navigate(`/users/${profile?.username || user.uid}`); }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-muted hover:text-white rounded-xl hover:bg-white/[0.03] transition-all text-left"
                    >
                      <User size={12} /> View My Profile
                    </button>
                    <button
                      onClick={() => { setDropdownOpen(false); navigate('/matches'); }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-muted hover:text-white rounded-xl hover:bg-white/[0.03] transition-all text-left"
                    >
                      <History size={12} /> My Match History
                    </button>
                    <button
                      onClick={() => { setDropdownOpen(false); navigate('/submissions'); }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-muted hover:text-white rounded-xl hover:bg-white/[0.03] transition-all text-left"
                    >
                      <Layers size={12} /> My Submissions
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-danger/80 hover:text-danger rounded-xl hover:bg-danger/5 transition-all text-left mt-1"
                    >
                      <LogOut size={12} /> Sign Out
                    </button>
                  </div>

                </div>
              )}

            </div>
          ) : (
            <>
              <button
                id="nav-signin-btn"
                onClick={() => navigate('/auth')}
                className="btn-outline px-4 py-2 text-xs font-bold"
              >
                Sign In
              </button>

              <button
                id="nav-get-started-btn"
                onClick={() => navigate('/auth')}
                className="btn-primary px-4 py-2 text-xs font-bold shadow-[#9d1f15]/35"
              >
                Enter Arena <ArrowRight size={13} />
              </button>
            </>
          )}
        </div>

      </div>
    </nav>
  );
}
