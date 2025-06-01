import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  // Debug device information
  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isTablet = /iPad|Android(?!.*Mobile)|Tablet/i.test(userAgent);
    const isMobile = /iPhone|Android.*Mobile|BlackBerry|Opera Mini|IEMobile/i.test(userAgent);
    const screenInfo = `${window.screen.width}x${window.screen.height}`;
    const viewportInfo = `${window.innerWidth}x${window.innerHeight}`;
    
    // Get the dynamically detected API URL
    const getApiUrl = () => {
      if (process.env.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL;
      }
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:5001/api';
      }
      return `http://${hostname}:5001/api`;
    };
    
    const debug = `
Device: ${isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop'}
Screen: ${screenInfo}
Viewport: ${viewportInfo}
Current URL: ${window.location.href}
Hostname: ${window.location.hostname}
Detected API URL: ${getApiUrl()}
User Agent: ${userAgent}
    `.trim();
    
    setDebugInfo(debug);
    console.log('🔍 Login Debug Info:', debug);
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    console.log('🔐 Login attempt:', {
      email: formData.email,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    });

    try {
      await login(formData.email, formData.password);
      console.log('✅ Login successful, navigating to dashboard');
      navigate('/dashboard');
    } catch (err) {
      console.error('❌ Login failed:', err);
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role) => {
    const demoCredentials = {
      admin: { email: 'admin@lcc360.com', password: 'admin123' },
      teacher: { email: 'teacher@lcc360.com', password: 'teacher123' },
      student: { email: 'student@lcc360.com', password: 'student123' }
    };

    const credentials = demoCredentials[role];
    setFormData(credentials);
    setLoading(true);
    setError('');

    console.log('🎭 Demo login attempt:', {
      role,
      email: credentials.email,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    });

    try {
      await login(credentials.email, credentials.password);
      console.log('✅ Demo login successful, navigating to dashboard');
      navigate('/dashboard');
    } catch (err) {
      console.error('❌ Demo login failed:', err);
      setError(err.message || 'Demo login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>LCC 360</h1>
          <p>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group">
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
              className="form-input"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
            />
          </div>

          <div className="form-group">
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
              className="form-input"
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
            />
          </div>

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="demo-section">
          <p className="demo-text">Try demo accounts:</p>
          <div className="demo-buttons">
            <button 
              onClick={() => handleDemoLogin('admin')}
              className="demo-button"
              disabled={loading}
            >
              Admin Demo
            </button>
            <button 
              onClick={() => handleDemoLogin('teacher')}
              className="demo-button"
              disabled={loading}
            >
              Teacher Demo
            </button>
            <button 
              onClick={() => handleDemoLogin('student')}
              className="demo-button"
              disabled={loading}
            >
              Student Demo
            </button>
          </div>
        </div>

        {/* Debug Information (only show in development) */}
        {process.env.NODE_ENV === 'development' && (
          <details className="debug-section" style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
            <summary style={{ cursor: 'pointer', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
              Debug Info (Click to expand)
            </summary>
            <pre style={{ padding: '10px', background: '#f9f9f9', borderRadius: '4px', marginTop: '10px', whiteSpace: 'pre-wrap' }}>
              {debugInfo}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

export default Login; 