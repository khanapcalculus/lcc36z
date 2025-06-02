import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import './Dashboard.css';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { user, logout, apiCall } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({});
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joinLink, setJoinLink] = useState('');
  const [joiningSession, setJoiningSession] = useState(false);

  // Session filters
  const [sessionFilters, setSessionFilters] = useState({
    status: '',
    upcoming: false,
    page: 1
  });

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiCall('/sessions/dashboard/stats');
      if (response.success) {
        setStats(response.stats);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setError('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  // Fetch student sessions
  const fetchSessions = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams();
      if (sessionFilters.status) queryParams.append('status', sessionFilters.status);
      if (sessionFilters.upcoming) queryParams.append('upcoming', 'true');
      queryParams.append('page', sessionFilters.page);
      queryParams.append('limit', '20');

      const response = await apiCall(`/sessions?${queryParams.toString()}`);
      if (response.success) {
        setSessions(response.sessions || []);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      setError('Failed to load sessions');
    }
  }, [apiCall, sessionFilters]);

  // Join session by link
  const handleJoinSession = async (sessionLink) => {
    try {
      setJoiningSession(true);
      setError('');

      // Extract share link from full URL
      let shareLink = sessionLink;
      if (sessionLink.includes('/session/')) {
        shareLink = sessionLink.split('/session/')[1];
      }

      // Navigate directly to whiteboard - let the Whiteboard component handle the joining process
      navigate(`/session/${shareLink}`);
      
    } catch (error) {
      console.error('Error joining session:', error);
      setError(error.message || 'Failed to join session');
    } finally {
      setJoiningSession(false);
    }
  };

  // Handle join from input
  const handleJoinFromInput = () => {
    if (!joinLink.trim()) {
      setError('Please enter a session link');
      return;
    }
    handleJoinSession(joinLink);
  };

  // Handle logout
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Format date for display
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status badge class
  const getStatusBadge = (status) => {
    const badges = {
      scheduled: 'status-badge scheduled',
      active: 'status-badge active',
      completed: 'status-badge completed',
      cancelled: 'status-badge cancelled'
    };
    return badges[status] || 'status-badge';
  };

  // Load data on component mount
  useEffect(() => {
    fetchDashboardData();
    fetchSessions(); // Always fetch sessions on mount
  }, [fetchDashboardData, fetchSessions]);

  useEffect(() => {
    if (activeTab === 'sessions') {
      fetchSessions();
    }
  }, [activeTab, fetchSessions]);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="dashboard-title">
          <h1>Student Dashboard</h1>
          <p>Welcome back, {user?.firstName} {user?.lastName}</p>
        </div>
        <div className="dashboard-actions">
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/whiteboard')}
          >
            <i className="fas fa-chalkboard"></i>
            Open Whiteboard
          </button>
          <button 
            className="btn btn-secondary"
            onClick={handleLogout}
          >
            <i className="fas fa-sign-out-alt"></i>
            Logout
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="dashboard-tabs">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <i className="fas fa-home"></i>
          Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          <i className="fas fa-calendar-check"></i>
          My Sessions ({sessions.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'join' ? 'active' : ''}`}
          onClick={() => setActiveTab('join')}
        >
          <i className="fas fa-link"></i>
          Join with Link
        </button>
      </nav>

      <main className="dashboard-content">
        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError('')} className="error-close">×</button>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="dashboard-grid">
            {/* Assigned Sessions - Most Important */}
            <div className="dashboard-card" style={{ gridColumn: '1 / -1' }}>
              <div className="card-header">
                <h3><i className="fas fa-calendar-check"></i> My Assigned Sessions</h3>
              </div>
              <div className="card-content">
                {loading ? (
                  <div className="loading-spinner">Loading sessions...</div>
                ) : sessions.length === 0 ? (
                  <div className="empty-state">
                    <i className="fas fa-calendar-times"></i>
                    <h4>No Sessions Assigned</h4>
                    <p>Your teacher hasn't assigned you to any sessions yet. Check back later or contact your teacher.</p>
                  </div>
                ) : (
                  <div className="sessions-grid">
                    {sessions.slice(0, 6).map(session => (
                      <div key={session._id} className="session-card">
                        <div className="session-header">
                          <h4>{session.title}</h4>
                          <span className={getStatusBadge(session.status)}>
                            {session.status}
                          </span>
                        </div>
                        <div className="session-details">
                          <p><i className="fas fa-book"></i> {session.subject} - Grade {session.grade}</p>
                          <p><i className="fas fa-clock"></i> {formatDate(session.scheduledDate)}</p>
                          <p><i className="fas fa-user"></i> {session.teacher?.firstName} {session.teacher?.lastName}</p>
                        </div>
                        <div className="session-actions">
                          {session.status === 'active' && (
                            <button 
                              className="btn btn-primary btn-sm"
                              onClick={() => handleJoinSession(session.shareLink)}
                              disabled={joiningSession}
                            >
                              <i className="fas fa-sign-in-alt"></i>
                              {joiningSession ? 'Joining...' : 'Join Now'}
                            </button>
                          )}
                          {session.status === 'scheduled' && (
                            <button 
                              className="btn btn-outline btn-sm"
                              onClick={() => handleJoinSession(session.shareLink)}
                              disabled={joiningSession}
                            >
                              <i className="fas fa-eye"></i>
                              View Session
                            </button>
                          )}
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/session/${session.shareLink}`);
                              alert('Session link copied to clipboard!');
                            }}
                          >
                            <i className="fas fa-copy"></i>
                            Copy Link
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {sessions.length > 6 && (
                  <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <button 
                      className="btn btn-outline"
                      onClick={() => setActiveTab('sessions')}
                    >
                      View All Sessions ({sessions.length})
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="dashboard-card">
              <div className="card-header">
                <h3><i className="fas fa-chart-line"></i> My Statistics</h3>
              </div>
              <div className="card-content">
                {loading ? (
                  <div className="loading-spinner">Loading...</div>
                ) : (
                  <div className="stats-grid">
                    <div className="stat-item">
                      <span className="stat-value">{stats.totalSessions || 0}</span>
                      <span className="stat-label">Total Sessions</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">{stats.scheduledSessions || 0}</span>
                      <span className="stat-label">Upcoming</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">{stats.activeSessions || 0}</span>
                      <span className="stat-label">Active Now</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">{stats.completedSessions || 0}</span>
                      <span className="stat-label">Completed</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="dashboard-card">
              <div className="card-header">
                <h3><i className="fas fa-clock"></i> Quick Actions</h3>
              </div>
              <div className="card-content">
                <div className="quick-actions">
                  <button 
                    className="btn btn-primary btn-large"
                    onClick={() => setActiveTab('sessions')}
                  >
                    <i className="fas fa-calendar"></i>
                    View All My Sessions
                  </button>
                  <button 
                    className="btn btn-secondary btn-large"
                    onClick={() => setActiveTab('join')}
                  >
                    <i className="fas fa-link"></i>
                    Join with Link (Optional)
                  </button>
                  <button 
                    className="btn btn-outline btn-large"
                    onClick={() => navigate('/whiteboard')}
                  >
                    <i className="fas fa-chalkboard"></i>
                    Practice Whiteboard
                  </button>
                </div>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="card-header">
                <h3><i className="fas fa-info-circle"></i> How It Works</h3>
              </div>
              <div className="card-content">
                <ul className="feature-list">
                  <li>✅ Your teacher assigns you to sessions automatically</li>
                  <li>✅ Sessions appear in "My Assigned Sessions" above</li>
                  <li>✅ Click "Join Now" when sessions are active</li>
                  <li>✅ No need to copy/paste links manually</li>
                  <li>✅ Real-time collaboration with classmates</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="sessions-section">
            <div className="section-header">
              <h2>My Sessions</h2>
              <div className="session-filters">
                <select 
                  value={sessionFilters.status}
                  onChange={(e) => setSessionFilters({...sessionFilters, status: e.target.value})}
                  className="filter-select"
                >
                  <option value="">All Status</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <label className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={sessionFilters.upcoming}
                    onChange={(e) => setSessionFilters({...sessionFilters, upcoming: e.target.checked})}
                  />
                  Upcoming Only
                </label>
              </div>
            </div>

            <div className="sessions-grid">
              {sessions.length === 0 ? (
                <div className="empty-state">
                  <i className="fas fa-calendar-times"></i>
                  <h3>No Sessions Found</h3>
                  <p>You don't have any sessions yet. Ask your teacher to add you to a session or join using a session link.</p>
                  <button 
                    className="btn btn-primary"
                    onClick={() => setActiveTab('join')}
                  >
                    Join Session with Link
                  </button>
                </div>
              ) : (
                sessions.map(session => (
                  <div key={session._id} className="session-card">
                    <div className="session-header">
                      <h4>{session.title}</h4>
                      <span className={getStatusBadge(session.status)}>
                        {session.status}
                      </span>
                    </div>
                    <div className="session-details">
                      <p><i className="fas fa-book"></i> {session.subject} - Grade {session.grade}</p>
                      <p><i className="fas fa-clock"></i> {formatDate(session.scheduledDate)}</p>
                      <p><i className="fas fa-user"></i> {session.teacher?.firstName} {session.teacher?.lastName}</p>
                      {session.description && (
                        <p><i className="fas fa-info"></i> {session.description}</p>
                      )}
                    </div>
                    <div className="session-actions">
                      {session.status === 'active' && (
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => handleJoinSession(session.shareLink)}
                        >
                          <i className="fas fa-sign-in-alt"></i>
                          Join Now
                        </button>
                      )}
                      {session.status === 'scheduled' && (
                        <button 
                          className="btn btn-outline btn-sm"
                          onClick={() => handleJoinSession(session.shareLink)}
                        >
                          <i className="fas fa-eye"></i>
                          View Details
                        </button>
                      )}
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/session/${session.shareLink}`);
                          alert('Session link copied to clipboard!');
                        }}
                      >
                        <i className="fas fa-copy"></i>
                        Copy Link
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Join Session Tab */}
        {activeTab === 'join' && (
          <div className="join-section">
            <div className="join-card">
              <div className="card-header">
                <h3><i className="fas fa-link"></i> Join Session with Link (Optional)</h3>
              </div>
              <div className="card-content">
                <div className="info-banner" style={{ 
                  background: '#e3f2fd', 
                  border: '1px solid #2196f3', 
                  borderRadius: '8px', 
                  padding: '16px', 
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <i className="fas fa-info-circle" style={{ color: '#2196f3', fontSize: '20px' }}></i>
                  <div>
                    <strong>Note:</strong> Most sessions are automatically assigned by your teacher and appear in the "Overview" tab. 
                    Only use this if your teacher specifically gave you a session link to paste.
                  </div>
                </div>
                
                <p>Enter a session link from your teacher to join a live session:</p>
                <div className="join-form">
                  <input 
                    type="text" 
                    placeholder="Paste session link here... (e.g., http://192.168.31.158:3000/session/abc123)"
                    className="form-input"
                    value={joinLink}
                    onChange={(e) => setJoinLink(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleJoinFromInput()}
                  />
                  <button 
                    className="btn btn-primary"
                    onClick={handleJoinFromInput}
                    disabled={joiningSession}
                  >
                    <i className="fas fa-sign-in-alt"></i>
                    {joiningSession ? 'Joining...' : 'Join Session'}
                  </button>
                </div>
                <div className="join-help">
                  <h4>When to use this:</h4>
                  <ol>
                    <li>Your teacher sends you a specific session link via email or message</li>
                    <li>You need to join a session that's not in your assigned sessions</li>
                    <li>You're joining as a guest to someone else's session</li>
                  </ol>
                  <p><strong>Example link:</strong> http://192.168.31.158:3000/session/abc123</p>
                  
                  <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <button 
                      className="btn btn-outline"
                      onClick={() => setActiveTab('overview')}
                    >
                      <i className="fas fa-arrow-left"></i>
                      Back to My Assigned Sessions
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentDashboard; 