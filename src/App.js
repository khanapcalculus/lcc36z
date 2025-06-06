import React from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { AuthContext, AuthProvider } from './context/AuthContext';
import { WhiteboardProvider } from './context/WhiteboardContext';

// Components
import Login from './components/Auth/Login';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import LoadingSpinner from './components/Common/LoadingSpinner';

// Dashboard Components
import AdminDashboard from './components/Dashboard/AdminDashboard';
import StudentDashboard from './components/Dashboard/StudentDashboard';
import TeacherDashboard from './components/Dashboard/TeacherDashboard';

// Whiteboard Components
import Whiteboard from './components/Whiteboard/Whiteboard';

// Simple Whiteboard Components (fallback)
import Canvas from './components/Canvas/Canvas.jsx';
import Logo from './components/Logo/Logo.jsx';
import PageNavigation from './components/PageNavigation/PageNavigation.jsx';
import Toolbar from './components/Toolbar/Toolbar.jsx';

// CSS
import './App.css';

// Simple Whiteboard Component (fallback)
const SimpleWhiteboard = () => {
  return (
    <WhiteboardProvider>
      <div className="App">
        <Toolbar />
        <Canvas />
        <PageNavigation />
        <Logo />
      </div>
    </WhiteboardProvider>
  );
};

// Main App Component
const AppContent = () => {
  const { loading, isAuthenticated } = React.useContext(AuthContext);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public Routes */}
          <Route 
            path="/login" 
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
            } 
          />
          
          {/* Simple Whiteboard Route (no auth required) */}
          <Route 
            path="/simple" 
            element={<SimpleWhiteboard />} 
          />
          
          {/* Protected Dashboard Routes */}
          <Route 
            path="/admin/dashboard" 
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/teacher/dashboard" 
            element={
              <ProtectedRoute requiredRole="teacher">
                <TeacherDashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/student/dashboard" 
            element={
              <ProtectedRoute requiredRole="student">
                <StudentDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Generic Dashboard Route (redirects based on role) */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <RoleBasedRedirect />
              </ProtectedRoute>
            } 
          />
          
          {/* Whiteboard Routes */}
          <Route 
            path="/whiteboard" 
            element={
              <ProtectedRoute>
                <WhiteboardProvider>
                  <Whiteboard />
                </WhiteboardProvider>
              </ProtectedRoute>
            } 
          />
          
          {/* Session Routes */}
          <Route 
            path="/session/:shareLink" 
            element={
              <ProtectedRoute>
                <WhiteboardProvider>
                  <Whiteboard />
                </WhiteboardProvider>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/join/:shareLink" 
            element={
              <ProtectedRoute>
                <WhiteboardProvider>
                  <Whiteboard />
                </WhiteboardProvider>
              </ProtectedRoute>
            } 
          />
          
          {/* Default Routes */}
          <Route 
            path="/" 
            element={<SimpleWhiteboard />}
          />
          
          {/* Catch all route */}
          <Route 
            path="*" 
            element={<Navigate to="/" replace />} 
          />
        </Routes>
      </div>
    </Router>
  );
};

// Role-based redirect component
const RoleBasedRedirect = () => {
  const { user } = React.useContext(AuthContext);
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  switch (user.role) {
    case 'admin':
      return <Navigate to="/admin/dashboard" replace />;
    case 'teacher':
      return <Navigate to="/teacher/dashboard" replace />;
    case 'student':
      return <Navigate to="/student/dashboard" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

// Main App with Providers
const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
