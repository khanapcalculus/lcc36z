import React, { createContext, useCallback, useEffect, useState } from 'react';

const AuthContext = createContext();

// Smart API URL detection for network access
const getApiBaseUrl = () => {
  // If we have an environment variable, use it
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Get the current hostname
  const hostname = window.location.hostname;
  
  // If accessing via localhost, use localhost for API
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5001/api';
  }
  
  // If accessing via network IP, use the same IP for API
  return `http://${hostname}:5001/api`;
};

const API_BASE_URL = getApiBaseUrl();

console.log('🌐 API Base URL:', API_BASE_URL);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Get token from localStorage
  const getToken = useCallback(() => {
    return localStorage.getItem('authToken');
  }, []);

  // Set token in localStorage
  const setToken = useCallback((token) => {
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }, []);

  // API call helper with authentication
  const apiCall = useCallback(async (endpoint, options = {}) => {
    const token = getToken();
    const url = `${API_BASE_URL}${endpoint}`;
    
    console.log('🔗 Making API call to:', url);
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('API call error:', error);
      throw error;
    }
  }, [getToken]);

  // Login function
  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const response = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (response.success) {
        setToken(response.token);
        setUser(response.user);
        setIsAuthenticated(true);
        
        // Store user data in localStorage for persistence
        localStorage.setItem('userData', JSON.stringify(response.user));
        
        console.log('✅ Login successful:', response.user.email);
        return response; // Return the full response
      } else {
        console.error('❌ Login failed:', response.message);
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error; // Re-throw the error so the component can handle it
    } finally {
      setLoading(false);
    }
  }, [apiCall, setToken]);

  // Logout function
  const logout = useCallback(async () => {
    setLoading(true);
    try {
      // Call logout endpoint to invalidate token on server (optional)
      await apiCall('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with logout even if API call fails
    } finally {
      // Clear local storage and state
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('userData');
      setLoading(false);
    }
  }, [apiCall, setToken]);

  // Verify token and get user data
  const verifyToken = useCallback(async () => {
    const token = getToken();
    
    if (!token) {
      setLoading(false);
      return false;
    }

    try {
      const response = await apiCall('/auth/verify-token');
      
      if (response.success) {
        // Get full user profile
        const profileResponse = await apiCall('/auth/me');
        
        if (profileResponse.success) {
          setUser(profileResponse.user);
          setIsAuthenticated(true);
          localStorage.setItem('userData', JSON.stringify(profileResponse.user));
          return true;
        }
      }
      
      // Token is invalid
      logout();
      return false;
    } catch (error) {
      console.error('Token verification error:', error);
      logout();
      return false;
    } finally {
      setLoading(false);
    }
  }, [apiCall, getToken, logout]);

  // Update user profile
  const updateProfile = useCallback(async (profileData) => {
    try {
      const response = await apiCall('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });

      if (response.success) {
        setUser(response.user);
        localStorage.setItem('userData', JSON.stringify(response.user));
        return { success: true, user: response.user };
      } else {
        return { success: false, message: response.message };
      }
    } catch (error) {
      console.error('Profile update error:', error);
      return { 
        success: false, 
        message: error.message || 'Profile update failed' 
      };
    }
  }, [apiCall]);

  // Change password
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      const response = await apiCall('/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      return response;
    } catch (error) {
      console.error('Password change error:', error);
      return { 
        success: false, 
        message: error.message || 'Password change failed' 
      };
    }
  }, [apiCall]);

  // Check if user has specific role
  const hasRole = useCallback((role) => {
    return user && user.role === role;
  }, [user]);

  // Check if user has any of the specified roles
  const hasAnyRole = useCallback((roles) => {
    return user && roles.includes(user.role);
  }, [user]);

  // Get user's full name
  const getUserDisplayName = useCallback(() => {
    if (!user) return '';
    return user.fullName || `${user.firstName} ${user.lastName}`;
  }, [user]);

  // Initialize authentication state on app load
  useEffect(() => {
    const initAuth = async () => {
      // Try to get user data from localStorage first
      const storedUserData = localStorage.getItem('userData');
      const token = getToken();
      
      if (storedUserData && token) {
        try {
          const userData = JSON.parse(storedUserData);
          setUser(userData);
          setIsAuthenticated(true);
          
          // Verify token in background
          verifyToken();
        } catch (error) {
          console.error('Error parsing stored user data:', error);
          logout();
        }
      } else {
        setLoading(false);
      }
    };

    initAuth();
  }, [getToken, verifyToken, logout]);

  // Context value
  const contextValue = {
    // State
    user,
    loading,
    isAuthenticated,
    
    // Actions
    login,
    logout,
    updateProfile,
    changePassword,
    verifyToken,
    
    // Utilities
    hasRole,
    hasAnyRole,
    getUserDisplayName,
    getToken,
    apiCall,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext, AuthProvider };

