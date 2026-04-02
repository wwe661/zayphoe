import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Register from './pages/Register';
import UserDashboard from './pages/UserDashboard';
import MainAdminDashboard from './pages/MainAdminDashboard';
import AdminLogin from './pages/AdminLogin';
import GroupUI from './pages/GroupUI';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/admin" element={
            <ProtectedRoute roles={['admin']}>
              <MainAdminDashboard />
            </ProtectedRoute>
          } />

          <Route path="/dashboard" element={
            <ProtectedRoute roles={['user', 'admin']}>
              <UserDashboard />
            </ProtectedRoute>
          } />

          <Route path="/groups/:id" element={
            <ProtectedRoute roles={['user', 'admin']}>
              <GroupUI />
            </ProtectedRoute>
          } />

          <Route path="/admin-login" element={<AdminLogin />} />

          <Route path="/unauthorized" element={
            <div className="container mt-4 text-center">
              <h1>403 - Unauthorized</h1>
              <p className="text-muted">You don't have permission to view this page.</p>
            </div>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
