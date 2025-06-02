const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { authMiddleware, adminMiddleware, teacherMiddleware } = require('../middleware/auth');
const router = express.Router();

// JWT Secret (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Helper function to generate JWT token
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// @route   POST /api/auth/login
// @desc    Login user (admin, teacher, student)
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Demo accounts fallback (when database is not available)
    const demoAccounts = {
      'admin@lcc360.com': {
        id: 'demo-admin-001',
        email: 'admin@lcc360.com',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        fullName: 'Admin User',
        isActive: true,
        createdAt: new Date(),
        lastLogin: new Date()
      },
      'teacher@lcc360.com': {
        id: 'demo-teacher-001',
        email: 'teacher@lcc360.com',
        password: 'teacher123',
        firstName: 'Teacher',
        lastName: 'Demo',
        role: 'teacher',
        fullName: 'Teacher Demo',
        subjects: ['Mathematics', 'Science'],
        isActive: true,
        createdAt: new Date(),
        lastLogin: new Date()
      },
      'student@lcc360.com': {
        id: 'demo-student-001',
        email: 'student@lcc360.com',
        password: 'student123',
        firstName: 'Student',
        lastName: 'Demo',
        role: 'student',
        fullName: 'Student Demo',
        grade: '10',
        subjects: ['Mathematics', 'Science'],
        isActive: true,
        createdAt: new Date(),
        lastLogin: new Date()
      }
    };

    // Check for demo account first
    const demoUser = demoAccounts[email.toLowerCase()];
    if (demoUser && demoUser.password === password) {
      console.log('✅ Demo account login successful:', email);
      
      // Generate token for demo user
      const token = generateToken(demoUser.id, demoUser.role);
      
      // Remove password from response
      const { password: _, ...userData } = demoUser;
      
      return res.json({
        success: true,
        message: 'Demo login successful',
        token,
        user: userData
      });
    }

    // Try database authentication if demo account not found
    try {
      // Check if user exists in database
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated. Please contact administrator.'
        });
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Update last login
      await user.updateLastLogin();

      // Generate token
      const token = generateToken(user._id, user.role);

      // Prepare user data (password excluded by toJSON method)
      const userData = user.toJSON();

      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: userData
      });

    } catch (dbError) {
      console.error('Database authentication failed, checking demo accounts only:', dbError.message);
      
      // If database fails and not a demo account, return error
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Database temporarily unavailable - only demo accounts are accessible.'
      });
    }

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @route   POST /api/auth/register
// @desc    Register new user (admin only)
// @access  Private (Admin)
router.post('/register', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      role,
      grade,
      subjects,
      phone,
      dateOfBirth
    } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    if (!['admin', 'teacher', 'student'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Role-specific validation
    if (role === 'student' && !grade) {
      return res.status(400).json({
        success: false,
        message: 'Grade is required for students'
      });
    }

    if ((role === 'student' || role === 'teacher') && (!subjects || subjects.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'At least one subject is required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create new user
    const userData = {
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      role,
      createdBy: req.user.userId,
      lastModifiedBy: req.user.userId
    };

    // Add role-specific fields
    if (role === 'student') {
      userData.grade = grade;
      userData.subjects = subjects;
    } else if (role === 'teacher') {
      userData.subjects = subjects;
    }

    // Add optional fields
    if (phone) userData.phone = phone;
    if (dateOfBirth) userData.dateOfBirth = new Date(dateOfBirth);

    const user = new User(userData);
    await user.save();

    // Return user data (password excluded)
    const newUser = user.toJSON();

    res.status(201).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully`,
      user: newUser
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // Check if this is a demo account (userId starts with 'demo-')
    if (req.user.userId.startsWith('demo-')) {
      console.log('✅ Returning demo account profile:', req.user.userId);
      
      return res.json({
        success: true,
        user: req.user.userDoc
      });
    }

    // Try database lookup for non-demo accounts
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        user: user.toJSON()
      });
    } catch (dbError) {
      console.error('Database error in /me route:', dbError.message);
      
      return res.status(500).json({
        success: false,
        message: 'Database temporarily unavailable'
      });
    }

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      dateOfBirth,
      preferences,
      defaultTimezone
    } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update allowed fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (dateOfBirth) user.dateOfBirth = new Date(dateOfBirth);
    if (preferences) user.preferences = { ...user.preferences, ...preferences };
    if (defaultTimezone && user.role === 'teacher') user.defaultTimezone = defaultTimezone;

    user.lastModifiedBy = req.user.userId;
    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: user.toJSON()
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during profile update'
    });
  }
});

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    user.lastModifiedBy = req.user.userId;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password change'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// @route   GET /api/auth/verify-token
// @desc    Verify JWT token validity
// @access  Private
router.get('/verify-token', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    user: {
      userId: req.user.userId,
      role: req.user.role
    }
  });
});

module.exports = router; 