import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import './Dashboard.css';

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({});
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [studentsLoading, setStudentsLoading] = useState(false);

  // Session management state
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [sessionForm, setSessionForm] = useState({
    title: '',
    description: '',
    subject: user?.subjects?.[0] || '',
    grade: '',
    scheduledDate: '',
    scheduledTime: '',
    timezone: 'America/Los_Angeles', // Default to LA timezone
    duration: 60,
    maxParticipants: 30,
    students: [],
    isPublic: true,
    emailNotifications: true
  });

  // Filters
  const [sessionFilters, setSessionFilters] = useState({
    status: '',
    upcoming: false,
    subject: '',
    grade: '',
    page: 1
  });

  const [studentFilters, setStudentFilters] = useState({
    grade: '',
    search: '',
    page: 1
  });

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

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [sessionStats, studentStats] = await Promise.all([
        apiCall('/sessions/teacher/stats'),
        apiCall('/users/teacher/students/stats')
      ]);

      setStats({
        ...sessionStats.stats,
        ...studentStats.stats
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  const fetchSessions = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        ...sessionFilters,
        limit: 20
      });
      
      const response = await apiCall(`/sessions/teacher?${params}`);
      setSessions(response.sessions || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      setError('Failed to load sessions');
    }
  }, [sessionFilters, apiCall]);

  const fetchStudents = useCallback(async () => {
    try {
      setStudentsLoading(true);
      const params = new URLSearchParams({
        ...studentFilters,
        limit: 20
      });
      
      const response = await apiCall(`/users/teacher/students?${params}`);
      setStudents(response.students || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      setError('Failed to load students');
    } finally {
      setStudentsLoading(false);
    }
  }, [studentFilters, apiCall]);

  // Fetch dashboard data
  useEffect(() => {
    fetchDashboardData();
    // Also load students initially for session creation
    fetchStudents();
  }, [fetchDashboardData, fetchStudents]);

  useEffect(() => {
    if (activeTab === 'sessions') {
      fetchSessions();
    } else if (activeTab === 'students') {
      fetchStudents();
    }
  }, [activeTab, sessionFilters, studentFilters, fetchSessions, fetchStudents]);

  // Load students when session creation modal opens
  useEffect(() => {
    if (showCreateSession) {
      // Always fetch students when modal opens, regardless of current tab
      fetchStudents();
    }
  }, [showCreateSession, fetchStudents]);

  const handleCreateSession = async (e) => {
    e.preventDefault();
    try {
      // Debug: Log the user object and form data
      console.log('🔧 Debug - Creating session');
      console.log('🔧 Debug - User object:', user);
      console.log('🔧 Debug - Session form data:', sessionForm);
      console.log('🔧 Debug - Selected students:', sessionForm.students);
      
      // Create date with timezone consideration
      const sessionDateTime = new Date(`${sessionForm.scheduledDate}T${sessionForm.scheduledTime}`);
      
      const sessionData = {
        ...sessionForm,
        scheduledDate: sessionDateTime.toISOString(),
        // Use the correct user ID field - could be user.id, user._id, or user.userId
        teacher: user._id || user.id || user.userId
      };

      console.log('🔧 Debug - Sending session data:', sessionData);

      const response = await apiCall('/sessions', {
        method: 'POST',
        body: JSON.stringify(sessionData)
      });

      console.log('✅ Session created successfully:', response);

      setShowCreateSession(false);
      resetSessionForm();
      fetchSessions();
      fetchDashboardData();
      setError(''); // Clear any previous errors
    } catch (error) {
      console.error('❌ Error creating session:', error);
      setError(`Failed to create session: ${error.message}`);
    }
  };

  const handleEditSession = async (e) => {
    e.preventDefault();
    try {
      // Create date with timezone consideration
      const sessionDateTime = new Date(`${sessionForm.scheduledDate}T${sessionForm.scheduledTime}`);
      
      const sessionData = {
        ...sessionForm,
        scheduledDate: sessionDateTime.toISOString()
      };

      await apiCall(`/sessions/${editingSession._id}`, {
        method: 'PUT',
        body: JSON.stringify(sessionData)
      });

      setEditingSession(null);
      resetSessionForm();
      fetchSessions();
    } catch (error) {
      console.error('Error updating session:', error);
      setError(error.message);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to delete this session?')) return;

    try {
      await apiCall(`/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      fetchSessions();
      fetchDashboardData();
    } catch (error) {
      console.error('Error deleting session:', error);
      setError(error.message);
    }
  };

  const handleStartSession = async (sessionId) => {
    try {
      console.log('🔧 DEBUG - Starting session:', sessionId);
      console.log('🔧 DEBUG - Current user:', user);
      console.log('🔧 DEBUG - Auth token:', localStorage.getItem('authToken'));
      
      await apiCall(`/sessions/${sessionId}/start`, {
        method: 'POST'
      });
      
      // Navigate to whiteboard with session context
      navigate(`/whiteboard?session=${sessionId}`);
    } catch (error) {
      console.error('Error starting session:', error);
      setError(error.message);
    }
  };

  const resetSessionForm = () => {
    setSessionForm({
      title: '',
      description: '',
      subject: user?.subjects?.[0] || '',
      grade: '',
      scheduledDate: '',
      scheduledTime: '',
      timezone: 'America/Los_Angeles', // Default to LA timezone
      duration: 60,
      maxParticipants: 30,
      students: [],
      isPublic: true,
      emailNotifications: true
    });
  };

  const startEditSession = (session) => {
    const scheduledDate = new Date(session.scheduledDate);
    setSessionForm({
      title: session.title,
      description: session.description || '',
      subject: session.subject,
      grade: session.grade,
      scheduledDate: scheduledDate.toISOString().split('T')[0],
      scheduledTime: scheduledDate.toTimeString().slice(0, 5),
      timezone: session.timezone || 'America/Los_Angeles', // Default if not set
      duration: session.duration,
      maxParticipants: session.maxParticipants,
      students: session.students?.map(s => s._id || s) || [],
      isPublic: session.isPublic !== false, // Default to true if not set
      emailNotifications: session.emailNotifications !== false
    });
    setEditingSession(session);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // New function to send email invitations
  const sendEmailInvitation = (session) => {
    const shareUrl = `${window.location.origin}/join/${session.shareLink}`;
    const sessionDate = new Date(session.scheduledDate).toLocaleDateString();
    const sessionTime = new Date(session.scheduledDate).toLocaleTimeString();
    
    const subject = `Invitation: ${session.title} - ${sessionDate}`;
    const body = `Hi there!

You're invited to join my online whiteboard session:

📚 Session: ${session.title}
📅 Date: ${sessionDate}
🕐 Time: ${sessionTime}
📖 Subject: ${session.subject}
🎓 Grade: ${session.grade}
⏱️ Duration: ${session.formattedDuration || `${session.duration} minutes`}

${session.description ? `📝 Description: ${session.description}` : ''}

🔗 Join the session using this link:
${shareUrl}

${session.password ? '🔒 This session is password protected. I\'ll share the password separately.' : ''}

Looking forward to seeing you in the session!

Best regards,
${user?.firstName} ${user?.lastName}`;

    // Create mailto link
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Open default email client
    window.location.href = mailtoLink;
  };

  // New function to send invitation to specific students
  const sendStudentInvitations = (session) => {
    if (!session.students || session.students.length === 0) {
      setError('No students assigned to this session');
      return;
    }

    const shareUrl = `${window.location.origin}/join/${session.shareLink}`;
    const sessionDate = new Date(session.scheduledDate).toLocaleDateString();
    const sessionTime = new Date(session.scheduledDate).toLocaleTimeString();
    
    // Get student emails
    const studentEmails = session.students.map(student => student.email).join(',');
    
    const subject = `Class Invitation: ${session.title} - ${sessionDate}`;
    const body = `Dear Students,

You're invited to join our online whiteboard session:

📚 Session: ${session.title}
📅 Date: ${sessionDate}
🕐 Time: ${sessionTime}
📖 Subject: ${session.subject}
🎓 Grade: ${session.grade}
⏱️ Duration: ${session.formattedDuration || `${session.duration} minutes`}

${session.description ? `📝 Description: ${session.description}` : ''}

🔗 Join the session using this link:
${shareUrl}

${session.password ? '🔒 This session is password protected. The password will be shared during class.' : ''}

Please make sure to:
✅ Join a few minutes early
✅ Have a stable internet connection
✅ Bring your questions and be ready to participate!

See you in the session!

Best regards,
${user?.firstName} ${user?.lastName}
${user?.subjects ? `${user.subjects.join(', ')} Teacher` : 'Teacher'}`;

    // Create mailto link with student emails
    const mailtoLink = `mailto:${studentEmails}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Open default email client
    window.location.href = mailtoLink;
  };

  // Improved copy to clipboard function for mobile devices
  const copyToClipboard = async (text, successMessage = 'Link copied to clipboard!') => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        setError(''); // Clear any errors
        // Show success message (you could add a toast notification here)
        console.log(successMessage);
        alert(successMessage); // Temporary alert for feedback
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
          console.log(successMessage);
          alert(successMessage);
        } catch (err) {
          console.error('Fallback copy failed:', err);
          // Show the link in a prompt so user can copy manually
          prompt('Copy this link manually:', text);
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch (error) {
      console.error('Copy to clipboard failed:', error);
      // Show the link in a prompt so user can copy manually
      prompt('Copy this link manually:', text);
    }
  };

  // Improved share link function for mobile devices
  const shareSessionLink = async (session) => {
    const shareUrl = `${window.location.origin}/join/${session.shareLink}`;
    
    // Try native sharing API first (available on mobile devices)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join Session: ${session.title}`,
          text: `You're invited to join "${session.title}" - ${session.subject} session`,
          url: shareUrl
        });
        return;
      } catch (error) {
        console.log('Native sharing cancelled or failed:', error);
        // Fall back to clipboard
      }
    }
    
    // Fallback to clipboard copy
    await copyToClipboard(shareUrl, 'Session link copied! Share it with your students.');
  };

  // Function to open session creation modal
  const openSessionCreationModal = () => {
    try {
      alert('🔧 DEBUG: Schedule Session button clicked!'); // Test if button works
      console.log('🔧 Debug - Opening session creation modal');
      console.log('🔧 Debug - Current tab:', activeTab);
      console.log('🔧 Debug - Students count:', students.length);
      console.log('🔧 Debug - Students loading:', studentsLoading);
      
      setShowCreateSession(true);
      // Ensure students are loaded
      if (students.length === 0) {
        console.log('🔧 Debug - Fetching students because count is 0');
        fetchStudents();
      }
    } catch (error) {
      console.error('❌ Error in openSessionCreationModal:', error);
      alert('Error: ' + error.message);
    }
  };

  // Create a test session for debugging
  const createTestSession = async () => {
    try {
      console.log('🔧 Debug - Creating test session');
      const now = new Date();
      const futureDate = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      
      const sessionData = {
        title: 'Test Session - ' + now.toLocaleTimeString(),
        description: 'This is a test session for debugging tablet access',
        subject: user?.subjects?.[0] || 'Mathematics',
        grade: '5',
        scheduledDate: futureDate.toISOString(),
        duration: 60,
        maxParticipants: 30,
        students: [],
        isPublic: true, // Make it public so anyone can join
        emailNotifications: false,
        teacher: user._id || user.id || user.userId
      };

      console.log('🔧 Debug - Test session data:', sessionData);

      const response = await apiCall('/sessions', {
        method: 'POST',
        body: JSON.stringify(sessionData)
      });

      console.log('✅ Test session created successfully:', response);
      alert(`✅ Test session created! Share link: ${window.location.origin}/join/${response.session.shareLink}`);

      fetchSessions();
      fetchDashboardData();
      setError('');
    } catch (error) {
      console.error('❌ Error creating test session:', error);
      alert(`❌ Error creating test session: ${error.message}`);
      setError(`Failed to create test session: ${error.message}`);
    }
  };

  // Generate time options with 5-minute increments
  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 5) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayTime = new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        times.push({ value: timeString, display: displayTime });
      }
    }
    return times;
  };

  // Common timezone options
  const timezoneOptions = [
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Phoenix', label: 'Arizona Time (MST)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' }
  ];

  const timeOptions = generateTimeOptions();

  const renderOverview = () => (
    <div className="dashboard-overview">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>{stats.totalSessions || 0}</h3>
            <p>Total Sessions</p>
            <small>{stats.activeSessions || 0} active</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👨‍🎓</div>
          <div className="stat-content">
            <h3>{stats.totalStudents || 0}</h3>
            <p>My Students</p>
            <small>{stats.activeStudents || 0} active</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-content">
            <h3>{stats.upcomingSessions || 0}</h3>
            <p>Upcoming</p>
            <small>Next 7 days</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>{stats.completedSessions || 0}</h3>
            <p>Completed</p>
            <small>This month</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-content">
            <h3>{stats.totalTeachingHours || 0}h</h3>
            <p>Teaching Hours</p>
            <small>Total time</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>{stats.averageAttendance || 0}%</h3>
            <p>Attendance</p>
            <small>Average rate</small>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-buttons">
          <button 
            className="btn btn-primary"
            onClick={openSessionCreationModal}
          >
            <i className="fas fa-plus"></i>
            Schedule New Session
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => navigate('/whiteboard')}
          >
            <i className="fas fa-chalkboard"></i>
            Open Whiteboard
          </button>
          <button 
            className="btn btn-info"
            onClick={() => setActiveTab('students')}
          >
            <i className="fas fa-users"></i>
            View My Students
          </button>
          <button 
            className="btn btn-warning"
            onClick={createTestSession}
          >
            <i className="fas fa-flask"></i>
            Create Test Session (Public)
          </button>
          {stats.upcomingSessions > 0 && (
            <button 
              className="btn btn-warning"
              onClick={() => {
                setActiveTab('sessions');
                setSessionFilters({...sessionFilters, upcoming: true});
              }}
            >
              <i className="fas fa-envelope"></i>
              Send Session Invites ({stats.upcomingSessions})
            </button>
          )}
        </div>
      </div>

      <div className="recent-activity">
        <h3>Recent Activity</h3>
        <div className="activity-list">
          {stats.recentSessions?.slice(0, 5).map(session => (
            <div key={session._id} className="activity-item">
              <div className="activity-icon">
                <i className={`fas ${session.status === 'completed' ? 'fa-check-circle' : 'fa-clock'}`}></i>
              </div>
              <div className="activity-content">
                <p><strong>{session.title}</strong></p>
                <small>{new Date(session.scheduledDate).toLocaleDateString()} - {session.status}</small>
              </div>
            </div>
          )) || <p>No recent activity</p>}
        </div>
      </div>
    </div>
  );

  const renderSessions = () => (
    <div className="sessions-management">
      <div className="section-header">
        <h2>My Sessions</h2>
        <button 
          className="btn btn-primary"
          onClick={openSessionCreationModal}
        >
          + Schedule Session
        </button>
      </div>

      <div className="filters">
        <select 
          value={sessionFilters.status} 
          onChange={(e) => setSessionFilters({...sessionFilters, status: e.target.value, page: 1})}
        >
          <option value="">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select 
          value={sessionFilters.grade} 
          onChange={(e) => setSessionFilters({...sessionFilters, grade: e.target.value, page: 1})}
        >
          <option value="">All Grades</option>
          <option value="K">Kindergarten</option>
          {[...Array(12)].map((_, i) => (
            <option key={i+1} value={i+1}>Grade {i+1}</option>
          ))}
        </select>

        <label>
          <input
            type="checkbox"
            checked={sessionFilters.upcoming}
            onChange={(e) => setSessionFilters({...sessionFilters, upcoming: e.target.checked, page: 1})}
          />
          Upcoming only
        </label>
      </div>

      <div className="sessions-table">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Subject</th>
              <th>Grade</th>
              <th>Date & Time</th>
              <th>Duration</th>
              <th>Students</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(session => (
              <tr key={session._id}>
                <td>
                  <strong>{session.title}</strong>
                  {session.description && <br />}
                  <small>{session.description}</small>
                </td>
                <td>{session.subject}</td>
                <td>Grade {session.grade}</td>
                <td>{new Date(session.scheduledDate).toLocaleString()}</td>
                <td>{session.formattedDuration}</td>
                <td>{session.students?.length || 0}/{session.maxParticipants}</td>
                <td>
                  <span className={`status-badge ${session.status}`}>
                    {session.status}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    {session.status === 'scheduled' && (
                      <button 
                        className="btn btn-sm btn-success"
                        onClick={() => handleStartSession(session._id)}
                        title="Start Session"
                      >
                        Start
                      </button>
                    )}
                    <button 
                      className="btn btn-sm btn-secondary"
                      onClick={() => startEditSession(session)}
                      title="Edit Session"
                    >
                      Edit
                    </button>
                    {session.shareLink && (
                      <>
                        <button 
                          className="btn btn-sm btn-info"
                          onClick={() => shareSessionLink(session)}
                          title="Share Session Link"
                        >
                          Share Link
                        </button>
                        <button 
                          className="btn btn-sm btn-primary"
                          onClick={() => sendEmailInvitation(session)}
                          title="Send General Invitation Email"
                        >
                          📧 Email Invite
                        </button>
                        {session.students && session.students.length > 0 && (
                          <button 
                            className="btn btn-sm btn-warning"
                            onClick={() => sendStudentInvitations(session)}
                            title="Send Email to Assigned Students"
                          >
                            📧 Email Students ({session.students.length})
                          </button>
                        )}
                      </>
                    )}
                    <button 
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteSession(session._id)}
                      title="Delete Session"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Session Modal */}
      {(showCreateSession || editingSession) && (
        <div className="modal-overlay">
          <div className="modal large">
            <div className="modal-header">
              <h3>{editingSession ? 'Edit Session' : 'Schedule New Session'}</h3>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowCreateSession(false);
                  setEditingSession(null);
                  resetSessionForm();
                }}
              >
                ×
              </button>
            </div>

            {/* Load students when modal opens */}
            {studentsLoading && (
              <div className="modal-loading">
                <div className="spinner"></div>
                <p>Loading students...</p>
              </div>
            )}

            <form onSubmit={editingSession ? handleEditSession : handleCreateSession}>
              <div className="form-row">
                <div className="form-group">
                  <label>Session Title *</label>
                  <input
                    type="text"
                    required
                    value={sessionForm.title}
                    onChange={(e) => setSessionForm({...sessionForm, title: e.target.value})}
                    placeholder="e.g., Algebra Basics"
                  />
                </div>
                <div className="form-group">
                  <label>Subject *</label>
                  <select
                    required
                    value={sessionForm.subject}
                    onChange={(e) => setSessionForm({...sessionForm, subject: e.target.value})}
                  >
                    <option value="">Select Subject</option>
                    {user?.subjects?.map(subject => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={sessionForm.description}
                  onChange={(e) => setSessionForm({...sessionForm, description: e.target.value})}
                  placeholder="Brief description of the session content..."
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Grade *</label>
                  <select
                    required
                    value={sessionForm.grade}
                    onChange={(e) => setSessionForm({...sessionForm, grade: e.target.value})}
                  >
                    <option value="">Select Grade</option>
                    <option value="K">Kindergarten</option>
                    {[...Array(12)].map((_, i) => (
                      <option key={i+1} value={i+1}>Grade {i+1}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Max Participants</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={sessionForm.maxParticipants}
                    onChange={(e) => setSessionForm({...sessionForm, maxParticipants: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Assign Students (Optional)</label>
                <div className="student-selection">
                  <small className="form-help">
                    Select students to invite to this session. Leave empty for open enrollment.
                  </small>
                  
                  {/* Debug info */}
                  <details className="debug-info" style={{marginBottom: '10px'}}>
                    <summary>🔧 Debug Info (Students Loading)</summary>
                    <div className="debug-content">
                      <p><strong>Students Loading:</strong> {studentsLoading ? 'Yes' : 'No'}</p>
                      <p><strong>Students Count:</strong> {students.length}</p>
                      <p><strong>Selected Grade:</strong> {sessionForm.grade || 'None'}</p>
                      <p><strong>Filtered Students:</strong> {students.filter(student => 
                        !sessionForm.grade || student.grade === sessionForm.grade
                      ).length}</p>
                      <button 
                        type="button" 
                        className="btn btn-sm btn-secondary"
                        onClick={() => fetchStudents()}
                        style={{marginTop: '5px'}}
                      >
                        Reload Students
                      </button>
                    </div>
                  </details>
                  
                  <div className="student-checkboxes">
                    {studentsLoading ? (
                      <div className="loading-students">
                        <div className="spinner"></div>
                        <p>Loading students...</p>
                      </div>
                    ) : (
                      students.filter(student => 
                        !sessionForm.grade || student.grade === sessionForm.grade
                      ).map(student => (
                        <label key={student._id} className="student-checkbox">
                          <input
                            type="checkbox"
                            checked={sessionForm.students.includes(student._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSessionForm({
                                  ...sessionForm, 
                                  students: [...sessionForm.students, student._id]
                                });
                              } else {
                                setSessionForm({
                                  ...sessionForm, 
                                  students: sessionForm.students.filter(id => id !== student._id)
                                });
                              }
                            }}
                          />
                          <span className="student-name">
                            {student.firstName} {student.lastName}
                          </span>
                          <span className="student-grade">Grade {student.grade}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {!studentsLoading && students.filter(student => 
                    !sessionForm.grade || student.grade === sessionForm.grade
                  ).length === 0 && (
                    <p className="no-students">
                      {sessionForm.grade 
                        ? `No students found for Grade ${sessionForm.grade}` 
                        : 'No students available. Students will appear here once assigned to your classes.'}
                    </p>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date *</label>
                  <input
                    type="date"
                    required
                    value={sessionForm.scheduledDate}
                    onChange={(e) => setSessionForm({...sessionForm, scheduledDate: e.target.value})}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="form-group">
                  <label>Time *</label>
                  <select
                    required
                    value={sessionForm.scheduledTime}
                    onChange={(e) => setSessionForm({...sessionForm, scheduledTime: e.target.value})}
                  >
                    {timeOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.display}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Duration (minutes)</label>
                  <select
                    value={sessionForm.duration}
                    onChange={(e) => setSessionForm({...sessionForm, duration: parseInt(e.target.value)})}
                  >
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Timezone *</label>
                  <select
                    required
                    value={sessionForm.timezone}
                    onChange={(e) => setSessionForm({...sessionForm, timezone: e.target.value})}
                  >
                    {timezoneOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={sessionForm.isPublic}
                      onChange={(e) => setSessionForm({...sessionForm, isPublic: e.target.checked})}
                    />
                    Public Session (anyone with the link can join)
                  </label>
                  <small className="form-help">
                    {sessionForm.isPublic 
                      ? "✅ Share links will work for anyone" 
                      : "⚠️ Only assigned students and you can join"}
                  </small>
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={sessionForm.emailNotifications}
                      onChange={(e) => setSessionForm({...sessionForm, emailNotifications: e.target.checked})}
                    />
                    Send email notifications
                  </label>
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  {editingSession ? 'Update Session' : 'Schedule Session'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowCreateSession(false);
                    setEditingSession(null);
                    resetSessionForm();
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  const renderStudents = () => (
    <div className="students-management">
      <div className="section-header">
        <h2>My Students</h2>
      </div>

      <div className="filters">
        <select 
          value={studentFilters.grade} 
          onChange={(e) => setStudentFilters({...studentFilters, grade: e.target.value, page: 1})}
        >
          <option value="">All Grades</option>
          <option value="K">Kindergarten</option>
          {[...Array(12)].map((_, i) => (
            <option key={i+1} value={i+1}>Grade {i+1}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search students..."
          value={studentFilters.search}
          onChange={(e) => setStudentFilters({...studentFilters, search: e.target.value, page: 1})}
        />
      </div>

      <div className="students-grid">
        {students.map(student => (
          <div key={student._id} className="student-card">
            <div className="student-avatar">
              <i className="fas fa-user-graduate"></i>
            </div>
            <div className="student-info">
              <h4>{student.firstName} {student.lastName}</h4>
              <p>Grade {student.grade}</p>
              <p>{student.email}</p>
              <div className="student-stats">
                <span>Sessions: {student.totalSessions || 0}</span>
                <span>Hours: {student.totalHours || 0}h</span>
              </div>
            </div>
            <div className="student-actions">
              <button 
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setSessionForm({...sessionForm, students: [student._id], grade: student.grade});
                  openSessionCreationModal();
                }}
              >
                Schedule Session
              </button>
            </div>
          </div>
        ))}
      </div>

      {students.length === 0 && (
        <div className="empty-state">
          <i className="fas fa-users"></i>
          <h3>No Students Found</h3>
          <p>Students will appear here once they're assigned to your classes.</p>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="dashboard-title">
          <h1>Teacher Dashboard</h1>
          <p>Welcome back, {user?.firstName} {user?.lastName}!</p>
          {user?.subjects && (
            <small>Teaching: {user.subjects.join(', ')}</small>
          )}
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
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      <div className="dashboard-tabs">
        <button 
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          My Sessions
        </button>
        <button 
          className={`tab ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          My Students
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'sessions' && renderSessions()}
        {activeTab === 'students' && renderStudents()}
      </div>
    </div>
  );
};

export default TeacherDashboard; 