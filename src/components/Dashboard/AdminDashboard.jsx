import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import './Dashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [assignments, setAssignments] = useState({ teachers: [], unassignedStudents: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'student',
    grade: '',
    subject: '',
    isActive: true
  });

  // Filters
  const [userFilters, setUserFilters] = useState({
    role: '',
    search: '',
    page: 1
  });

  const [sessionFilters, setSessionFilters] = useState({
    status: '',
    upcoming: false,
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

  // Define all fetch functions with useCallback
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [userStats, sessionStats] = await Promise.all([
        apiCall('/users/dashboard/stats'),
        apiCall('/sessions/dashboard/stats')
      ]);

      setStats({
        ...userStats.stats,
        ...sessionStats.stats
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        ...userFilters,
        limit: 20
      });
      
      const response = await apiCall(`/users?${params}`);
      setUsers(response.users);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to load users');
    }
  }, [apiCall, userFilters]);

  const fetchSessions = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        ...sessionFilters,
        limit: 20
      });
      
      const response = await apiCall(`/sessions?${params}`);
      setSessions(response.sessions);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      setError('Failed to load sessions');
    }
  }, [apiCall, sessionFilters]);

  const fetchAssignments = useCallback(async () => {
    try {
      const response = await apiCall('/users/teacher-student-assignments');
      if (response.success) {
        setAssignments(response.assignments);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setError('Failed to load teacher-student assignments');
    }
  }, [apiCall]);

  // Load data on component mount
  useEffect(() => {
    fetchDashboardData();
    fetchUsers();
    fetchSessions();
    fetchAssignments();
  }, [fetchDashboardData, fetchUsers, fetchSessions, fetchAssignments]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'sessions') {
      fetchSessions();
    }
  }, [activeTab, fetchUsers, fetchSessions]);

  // Assign student to teacher
  const handleAssignStudent = async (studentId, teacherId) => {
    try {
      await apiCall('/users/assign-student-to-teacher', {
        method: 'POST',
        body: JSON.stringify({ studentId, teacherId })
      });
      fetchAssignments();
      fetchUsers(); // Refresh user list
    } catch (error) {
      console.error('Error assigning student:', error);
      setError(error.message);
    }
  };

  // Unassign student from teacher
  const handleUnassignStudent = async (studentId) => {
    if (!window.confirm('Are you sure you want to unassign this student?')) return;
    
    try {
      await apiCall('/users/unassign-student-from-teacher', {
        method: 'POST',
        body: JSON.stringify({ studentId })
      });
      fetchAssignments();
      fetchUsers(); // Refresh user list
    } catch (error) {
      console.error('Error unassigning student:', error);
      setError(error.message);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await apiCall('/users', {
        method: 'POST',
        body: JSON.stringify(userForm)
      });

      setShowUserModal(false);
      setUserForm({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'student',
        grade: '',
        subject: '',
        isActive: true
      });
      fetchUsers();
      fetchDashboardData();
    } catch (error) {
      console.error('Error creating user:', error);
      setError(error.message);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    try {
      await apiCall(`/users/${editingUser._id}`, {
        method: 'PUT',
        body: JSON.stringify(userForm)
      });

      setEditingUser(null);
      setUserForm({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'student',
        grade: '',
        subject: '',
        isActive: true
      });
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      setError(error.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      await apiCall(`/users/${userId}`, {
        method: 'DELETE'
      });
      fetchUsers();
      fetchDashboardData();
    } catch (error) {
      console.error('Error deleting user:', error);
      setError(error.message);
    }
  };

  const handleResetPassword = async (userId) => {
    const newPassword = prompt('Enter new password (min 6 characters):');
    if (!newPassword || newPassword.length < 6) return;

    try {
      await apiCall(`/users/${userId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword })
      });
      alert('Password reset successfully');
    } catch (error) {
      console.error('Error resetting password:', error);
      setError(error.message);
    }
  };

  const startEditUser = (user) => {
    setEditingUser(user);
    setUserForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: '',
      role: user.role,
      grade: user.grade || '',
      subject: user.subject || '',
      isActive: user.isActive
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const renderOverview = () => (
    <div className="dashboard-overview">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>{stats.totalUsers || 0}</h3>
            <p>Total Users</p>
            <small>{stats.activeUsers || 0} active</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👨‍🏫</div>
          <div className="stat-content">
            <h3>{stats.totalTeachers || 0}</h3>
            <p>Teachers</p>
            <small>{stats.activeTeachers || 0} active</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👨‍🎓</div>
          <div className="stat-content">
            <h3>{stats.totalStudents || 0}</h3>
            <p>Students</p>
            <small>{stats.activeStudents || 0} active</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>{stats.totalSessions || 0}</h3>
            <p>Total Sessions</p>
            <small>{stats.activeSessions || 0} active</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-content">
            <h3>{stats.scheduledSessions || 0}</h3>
            <p>Scheduled</p>
            <small>Upcoming sessions</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>{stats.completedSessions || 0}</h3>
            <p>Completed</p>
            <small>Total completed</small>
          </div>
        </div>
      </div>

      <div className="charts-section">
        <div className="chart-card">
          <h3>Grade Distribution</h3>
          <div className="grade-distribution">
            {stats.gradeDistribution?.map(grade => (
              <div key={grade._id} className="grade-item">
                <span className="grade-label">Grade {grade._id}</span>
                <div className="grade-bar">
                  <div 
                    className="grade-fill" 
                    style={{ width: `${(grade.count / (stats.totalStudents || 1)) * 100}%` }}
                  ></div>
                </div>
                <span className="grade-count">{grade.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <h3>Subject Distribution</h3>
          <div className="subject-distribution">
            {stats.subjectDistribution?.map(subject => (
              <div key={subject._id} className="subject-item">
                <span className="subject-label">{subject._id}</span>
                <div className="subject-bar">
                  <div 
                    className="subject-fill" 
                    style={{ width: `${(subject.count / (stats.totalTeachers || 1)) * 100}%` }}
                  ></div>
                </div>
                <span className="subject-count">{subject.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="users-management">
      <div className="section-header">
        <h2>User Management</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowUserModal(true)}
        >
          + Create User
        </button>
      </div>

      <div className="filters">
        <select 
          value={userFilters.role} 
          onChange={(e) => setUserFilters({...userFilters, role: e.target.value, page: 1})}
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="teacher">Teacher</option>
          <option value="student">Student</option>
        </select>

        <input
          type="text"
          placeholder="Search users..."
          value={userFilters.search}
          onChange={(e) => setUserFilters({...userFilters, search: e.target.value, page: 1})}
        />
      </div>

      <div className="users-table">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Grade/Subject</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user._id}>
                <td>{user.firstName} {user.lastName}</td>
                <td>{user.email}</td>
                <td>
                  <span className={`role-badge ${user.role}`}>
                    {user.role}
                  </span>
                </td>
                <td>{user.grade || user.subject || '-'}</td>
                <td>
                  <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="action-buttons">
                    <button 
                      className="btn btn-sm btn-secondary"
                      onClick={() => startEditUser(user)}
                    >
                      Edit
                    </button>
                    <button 
                      className="btn btn-sm btn-warning"
                      onClick={() => handleResetPassword(user._id)}
                    >
                      Reset Password
                    </button>
                    <button 
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteUser(user._id)}
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

      {/* Create/Edit User Modal */}
      {(showUserModal || editingUser) && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingUser ? 'Edit User' : 'Create New User'}</h3>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowUserModal(false);
                  setEditingUser(null);
                  setUserForm({
                    firstName: '',
                    lastName: '',
                    email: '',
                    password: '',
                    role: 'student',
                    grade: '',
                    subject: '',
                    isActive: true
                  });
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={editingUser ? handleEditUser : handleCreateUser}>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    required
                    value={userForm.firstName}
                    onChange={(e) => setUserForm({...userForm, firstName: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    required
                    value={userForm.lastName}
                    onChange={(e) => setUserForm({...userForm, lastName: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  required
                  value={userForm.email}
                  onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                />
              </div>

              {!editingUser && (
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    required
                    minLength="6"
                    value={userForm.password}
                    onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                  />
                </div>
              )}

              <div className="form-group">
                <label>Role</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {userForm.role === 'student' && (
                <div className="form-group">
                  <label>Grade</label>
                  <select
                    required
                    value={userForm.grade}
                    onChange={(e) => setUserForm({...userForm, grade: e.target.value})}
                  >
                    <option value="">Select Grade</option>
                    <option value="K">Kindergarten</option>
                    <option value="1">Grade 1</option>
                    <option value="2">Grade 2</option>
                    <option value="3">Grade 3</option>
                    <option value="4">Grade 4</option>
                    <option value="5">Grade 5</option>
                    <option value="6">Grade 6</option>
                    <option value="7">Grade 7</option>
                    <option value="8">Grade 8</option>
                    <option value="9">Grade 9</option>
                    <option value="10">Grade 10</option>
                    <option value="11">Grade 11</option>
                    <option value="12">Grade 12</option>
                  </select>
                </div>
              )}

              {userForm.role === 'teacher' && (
                <div className="form-group">
                  <label>Subject</label>
                  <select
                    required
                    value={userForm.subject}
                    onChange={(e) => setUserForm({...userForm, subject: e.target.value})}
                  >
                    <option value="">Select Subject</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Science">Science</option>
                    <option value="English">English</option>
                    <option value="History">History</option>
                    <option value="Geography">Geography</option>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Biology">Biology</option>
                    <option value="Computer Science">Computer Science</option>
                    <option value="Art">Art</option>
                    <option value="Music">Music</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}

              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowUserModal(false);
                    setEditingUser(null);
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

  const renderSessions = () => (
    <div className="sessions-management">
      <div className="section-header">
        <h2>Session Management</h2>
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
              <th>Teacher</th>
              <th>Subject</th>
              <th>Grade</th>
              <th>Scheduled Date</th>
              <th>Duration</th>
              <th>Students</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(session => (
              <tr key={session._id}>
                <td>{session.title}</td>
                <td>{session.teacher?.firstName} {session.teacher?.lastName}</td>
                <td>{session.subject}</td>
                <td>{session.grade}</td>
                <td>{new Date(session.scheduledDate).toLocaleString()}</td>
                <td>{session.formattedDuration}</td>
                <td>{session.students?.length || 0}</td>
                <td>
                  <span className={`status-badge ${session.status}`}>
                    {session.status}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="btn btn-sm btn-secondary">
                      View
                    </button>
                    {session.status === 'scheduled' && (
                      <button className="btn btn-sm btn-danger">
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Assignments Tab
  const renderAssignments = () => (
    <div className="assignments-section">
      <div className="section-header">
        <h2>Teacher-Student Assignments</h2>
        <p>Manage which students are assigned to which teachers</p>
      </div>

      <div className="assignments-grid">
        {/* Teachers with their assigned students */}
        <div className="teachers-section">
          <h3><i className="fas fa-chalkboard-teacher"></i> Teachers & Their Students</h3>
          {assignments.teachers.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-user-friends"></i>
              <p>No teachers found</p>
            </div>
          ) : (
            <div className="teachers-list">
              {assignments.teachers.map(teacher => (
                <div key={teacher.id} className="teacher-card">
                  <div className="teacher-header">
                    <div className="teacher-info">
                      <h4>{teacher.name}</h4>
                      <p>{teacher.email}</p>
                      <span className="subjects-badge">
                        {teacher.subjects.join(', ')}
                      </span>
                    </div>
                    <div className="student-count">
                      {teacher.assignedStudents.length} students
                    </div>
                  </div>
                  
                  <div className="assigned-students">
                    {teacher.assignedStudents.length === 0 ? (
                      <p className="no-students">No students assigned</p>
                    ) : (
                      <div className="students-list">
                        {teacher.assignedStudents.map(student => (
                          <div key={student.id} className="student-item">
                            <div className="student-info">
                              <span className="student-name">{student.name}</span>
                              <span className="student-grade">Grade {student.grade}</span>
                            </div>
                            <button 
                              className="btn btn-sm btn-danger"
                              onClick={() => handleUnassignStudent(student.id)}
                              title="Unassign student"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unassigned students */}
        <div className="unassigned-section">
          <h3><i className="fas fa-user-graduate"></i> Unassigned Students</h3>
          {assignments.unassignedStudents.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-check-circle"></i>
              <p>All students are assigned to teachers</p>
            </div>
          ) : (
            <div className="unassigned-students">
              {assignments.unassignedStudents.map(student => (
                <div key={student.id} className="unassigned-student">
                  <div className="student-info">
                    <h5>{student.name}</h5>
                    <p>{student.email}</p>
                    <span className="grade-badge">Grade {student.grade}</span>
                  </div>
                  <div className="assign-actions">
                    <label>Assign to teacher:</label>
                    <select 
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAssignStudent(student.id, e.target.value);
                          e.target.value = ''; // Reset selection
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="">Select teacher...</option>
                      {assignments.teachers.map(teacher => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name} ({teacher.subjects.join(', ')})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
          <h1>Admin Dashboard</h1>
          <p>Welcome back, {user?.firstName} {user?.lastName}!</p>
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

      <nav className="dashboard-tabs">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <i className="fas fa-home"></i>
          Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <i className="fas fa-users"></i>
          User Management
        </button>
        <button 
          className={`tab-button ${activeTab === 'assignments' ? 'active' : ''}`}
          onClick={() => setActiveTab('assignments')}
        >
          <i className="fas fa-user-friends"></i>
          Teacher-Student Assignments
        </button>
        <button 
          className={`tab-button ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          <i className="fas fa-calendar-alt"></i>
          Session Management
        </button>
      </nav>

      <div className="dashboard-content">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'sessions' && renderSessions()}
        {activeTab === 'assignments' && renderAssignments()}
      </div>
    </div>
  );
};

export default AdminDashboard; 