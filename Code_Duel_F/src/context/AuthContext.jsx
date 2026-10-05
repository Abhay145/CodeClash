import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../config/firebase';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const AuthContext = createContext(null);

/**
 * Calls the backend to create a users/{uid} document on first login.
 * No-ops silently on repeat logins. Fire-and-forget — never throws.
 */
async function initUserDocument(firebaseUser, username = '') {
  try {
    const idToken = await firebaseUser.getIdToken();
    await fetch(`${API_BASE}/api/users/init`, {
      method:  'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        displayName: firebaseUser.displayName || '',
        photoURL:    firebaseUser.photoURL    || '',
        username:    username || '',
      }),
    });
  } catch (err) {
    console.warn('[AuthContext] initUserDocument failed:', err.message);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);
  const pendingUsernameRef = useRef('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
        initUserDocument(firebaseUser, pendingUsernameRef.current);
        pendingUsernameRef.current = '';
      }
    });
    return unsubscribe;
  }, []);

  const logout = () => signOut(auth);

  // Expose a way for AuthPage to set username before sign-up
  const setPendingUsername = (u) => { pendingUsernameRef.current = u; };

  return (
    <AuthContext.Provider value={{ user, loading, logout, setPendingUsername }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
}
