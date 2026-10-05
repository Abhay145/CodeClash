import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import DuelPage from './pages/DuelPage';
import SubmissionsPage from './pages/SubmissionsPage';
import RoomPage from './pages/RoomPage';
import ResultsPage from './pages/ResultsPage';
import PracticePage from './pages/PracticePage';
import MatchmakingPage from './pages/MatchmakingPage';
import MatchHistoryPage from './pages/MatchHistoryPage';
import ArenaPage from './pages/ArenaPage';
import ProfilePage from './pages/ProfilePage';
import ClashNowPage from './pages/ClashNowPage';
import FriendsPage from './pages/FriendsPage';
import NotFoundPage from './pages/NotFoundPage';


export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/"                        element={<LandingPage />} />
          <Route path="/auth"                    element={<AuthPage />} />
          <Route path="/practice"               element={<PracticePage />} />
          <Route path="/profile/:uid"           element={<ProfilePage />} />
          <Route path="/users/:uid"             element={<ProfilePage />} />
          <Route path="/cod3duel/profile/:uid"  element={<ProfilePage />} />

          {/* Protected routes — must be signed in */}
          {/* Match results — reads from matches/{matchId} collection */}
          <Route
            path="/match/:matchId/results"
            element={
              <ProtectedRoute>
                <ResultsPage />
              </ProtectedRoute>
            }
          />
          {/* Legacy results route — rooms no longer hold result data; redirect home */}
          <Route path="/room/:roomId/results" element={<Navigate to="/" replace />} />
          <Route
            path="/room/:roomId"
            element={
              <ProtectedRoute>
                <RoomPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/duel/:roomId"
            element={
              <ProtectedRoute>
                <DuelPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/duel"
            element={
              <ProtectedRoute>
                <DuelPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/submissions"
            element={
              <ProtectedRoute>
                <SubmissionsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/matchmaking"
            element={
              <ProtectedRoute>
                <MatchmakingPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/arena"
            element={
              <ProtectedRoute>
                <ArenaPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/matches"
            element={
              <ProtectedRoute>
                <MatchHistoryPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/clash"
            element={
              <ProtectedRoute>
                <ClashNowPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/friends"
            element={
              <ProtectedRoute>
                <FriendsPage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all — themed 404 */}
          <Route path="*" element={<NotFoundPage />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
