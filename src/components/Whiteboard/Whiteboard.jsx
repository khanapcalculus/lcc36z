import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Canvas from '../Canvas/Canvas.jsx';
import LoadingSpinner from '../Common/LoadingSpinner';
import Logo from '../Logo/Logo.jsx';
import PageNavigation from '../PageNavigation/PageNavigation.jsx';
import Toolbar from '../Toolbar/Toolbar.jsx';
import './Whiteboard.css';

const Whiteboard = () => {
  const { shareLink } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [joinStatus, setJoinStatus] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [showJoinPrompt, setShowJoinPrompt] = useState(false);
  const [password, setPassword] = useState('');
  const [hasJoined, setHasJoined] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

  // API call helper
  const apiCall = useCallback(async (endpoint, options = {}) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }
    return data;
  }, [API_BASE_URL]);

  // Handle session joining via share link
  const handleJoinSession = useCallback(async () => {
    try {
      setLoading(true);
      setJoinStatus('Loading session information...');
      
      // Debug: Log authentication status
      const token = localStorage.getItem('authToken');
      console.log('🔍 Debug - Token exists:', !!token);
      console.log('🔍 Debug - Token value:', token ? token.substring(0, 20) + '...' : 'null');
      console.log('🔍 Debug - Share link:', shareLink);
      console.log('🔍 Debug - API Base URL:', API_BASE_URL);
      
      // First, get session info without joining
      const sessionInfo = await apiCall(`/sessions/join/${shareLink}`);
      setSessionData(sessionInfo.session);
      
      console.log('🔍 Debug - Session info:', {
        title: sessionInfo.session.title,
        isPublic: sessionInfo.session.isPublic,
        requiresPassword: sessionInfo.session.requiresPassword,
        teacher: sessionInfo.session.teacher,
        currentParticipants: sessionInfo.session.currentParticipants,
        maxParticipants: sessionInfo.session.maxParticipants,
        status: sessionInfo.session.status
      });
      
      // Check if password is required
      if (sessionInfo.session.requiresPassword && !password) {
        setShowPasswordPrompt(true);
        setLoading(false);
        return;
      }
      
      // Show join prompt if not already joined
      if (!hasJoined) {
        setShowJoinPrompt(true);
        setLoading(false);
        return;
      }
      
      // Attempt to join the session
      setJoinStatus('Joining session...');
      console.log('🔍 Debug - Attempting to join with password:', password ? '[PASSWORD SET]' : '[NO PASSWORD]');
      
      const joinResponse = await apiCall(`/sessions/join/${shareLink}`, {
        method: 'POST',
        body: JSON.stringify({ password })
      });
      
      console.log('🔍 Debug - Join successful:', joinResponse);
      
      setJoinStatus('Successfully joined! Loading whiteboard...');
      setSessionData(joinResponse.session);
      setHasJoined(true);
      setError('');
      
      // Small delay to show success message
      setTimeout(() => {
        setLoading(false);
        setJoinStatus('');
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error joining session:', error);
      console.log('🔍 Debug - Full error details:', {
        message: error.message,
        status: error.status,
        shareLink: shareLink,
        hasToken: !!localStorage.getItem('authToken'),
        apiBaseUrl: API_BASE_URL
      });
      
      // Provide more helpful error messages
      let errorMessage = error.message;
      if (error.message.includes('not authorized') || error.message.includes('access')) {
        errorMessage = `Access Denied: ${error.message}
        
This could happen if:
• The session is private and you're not assigned as a student
• You're not logged in as the session teacher
• The session link has expired
• You're not logged in at all

Try logging in with the correct account or contact the teacher for access.`;
      } else if (error.message.includes('authentication') || error.message.includes('token')) {
        errorMessage = 'Please log in to join this session.';
      }
      
      setError(errorMessage);
      setLoading(false);
      setJoinStatus('');
      
      // If it's an authentication error, redirect to login
      if (error.message.includes('authentication') || error.message.includes('token')) {
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    }
  }, [shareLink, password, hasJoined, apiCall, navigate, API_BASE_URL]);

  const handleDirectSessionAccess = useCallback(async (sessionId) => {
    try {
      setLoading(true);
      setJoinStatus('Loading session...');
      
      const sessionInfo = await apiCall(`/sessions/${sessionId}`);
      setSessionData(sessionInfo.session);
      setHasJoined(true); // Assume direct access means already joined
      setLoading(false);
      setJoinStatus('');
      
    } catch (error) {
      console.error('Error accessing session:', error);
      setError(error.message);
      setLoading(false);
      setJoinStatus('');
    }
  }, [apiCall]);

  // Handle session joining via share link
  useEffect(() => {
    if (shareLink) {
      handleJoinSession();
    } else {
      // Check if there's a session parameter in the URL
      const sessionId = searchParams.get('session');
      if (sessionId) {
        handleDirectSessionAccess(sessionId);
      }
    }
  }, [shareLink, searchParams, handleJoinSession, handleDirectSessionAccess]);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    setShowPasswordPrompt(false);
    setShowJoinPrompt(true);
  };

  const handleJoinConfirm = async () => {
    setShowJoinPrompt(false);
    setHasJoined(true);
    await handleJoinSession();
  };

  const handleRetry = () => {
    setError('');
    setPassword('');
    setShowPasswordPrompt(false);
    setShowJoinPrompt(false);
    setHasJoined(false);
    if (shareLink) {
      handleJoinSession();
    }
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  // Show loading state
  if (loading) {
    return (
      <div className="whiteboard-container">
        <div className="session-join-overlay">
          <LoadingSpinner />
          <div className="join-status">
            <h3>{joinStatus}</h3>
            {sessionData && (
              <div className="session-info">
                <h4>{sessionData.title}</h4>
                <p>{sessionData.subject} - Grade {sessionData.grade}</p>
                <p>Teacher: {sessionData.teacher?.firstName} {sessionData.teacher?.lastName}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show password prompt
  if (showPasswordPrompt) {
    return (
      <div className="whiteboard-container">
        <div className="session-join-overlay">
          <div className="password-prompt">
            <h3>Password Required</h3>
            <p>This session requires a password to join:</p>
            <div className="session-info">
              <h4>{sessionData?.title}</h4>
              <p>{sessionData?.subject} - Grade {sessionData?.grade}</p>
              <p>Teacher: {sessionData?.teacher?.firstName} {sessionData?.teacher?.lastName}</p>
            </div>
            <form onSubmit={handlePasswordSubmit}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter session password"
                required
                autoFocus
              />
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  Continue
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={handleGoToDashboard}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Show join prompt - THIS IS THE MISSING JOIN BUTTON!
  if (showJoinPrompt) {
    return (
      <div className="whiteboard-container">
        <div className="session-join-overlay">
          <div className="join-prompt">
            <h3>Join Session</h3>
            <p>You're about to join this collaborative whiteboard session:</p>
            <div className="session-info">
              <h4>{sessionData?.title}</h4>
              <p>{sessionData?.subject} - Grade {sessionData?.grade}</p>
              <p>Teacher: {sessionData?.teacher?.firstName} {sessionData?.teacher?.lastName}</p>
              <p>Duration: {sessionData?.formattedDuration}</p>
              <p>Participants: {sessionData?.currentParticipants}/{sessionData?.maxParticipants}</p>
              {sessionData?.description && (
                <p className="session-description">{sessionData.description}</p>
              )}
            </div>
            
            {/* Debug info for troubleshooting */}
            <details className="debug-info">
              <summary>🔧 Debug Info (Click to expand)</summary>
              <div className="debug-content">
                <p><strong>Share Link:</strong> {shareLink}</p>
                <p><strong>Session Public:</strong> {sessionData?.isPublic ? 'Yes' : 'No'}</p>
                <p><strong>Requires Password:</strong> {sessionData?.requiresPassword ? 'Yes' : 'No'}</p>
                <p><strong>Auth Token:</strong> {localStorage.getItem('authToken') ? 'Present' : 'Missing'}</p>
                <p><strong>Session Status:</strong> {sessionData?.status}</p>
                <p><strong>Max Participants:</strong> {sessionData?.maxParticipants}</p>
                <p><strong>Current Participants:</strong> {sessionData?.currentParticipants}</p>
              </div>
            </details>
            
            <div className="form-actions">
              <button 
                className="btn btn-primary btn-large"
                onClick={handleJoinConfirm}
              >
                Join Session
              </button>
              <button 
                className="btn btn-secondary"
                onClick={handleGoToDashboard}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="whiteboard-container">
        <div className="session-join-overlay">
          <div className="error-state">
            <h3>Unable to Join Session</h3>
            <p className="error-message">{error}</p>
            {sessionData && (
              <div className="session-info">
                <h4>{sessionData.title}</h4>
                <p>{sessionData.subject} - Grade {sessionData.grade}</p>
              </div>
            )}
            <div className="form-actions">
              <button 
                className="btn btn-primary"
                onClick={handleRetry}
              >
                Try Again
              </button>
              <button 
                className="btn btn-secondary"
                onClick={handleGoToDashboard}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show normal whiteboard (only after successful join)
  return (
    <div className="whiteboard-container">
      <Toolbar />
      <Canvas />
      <PageNavigation />
      <Logo />
    </div>
  );
};

export default Whiteboard; 