const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Basic authentication middleware
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided, authorization denied'
      });
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    console.log('🔧 DEBUG - Token decoded:', { userId: decoded.userId, role: decoded.role });
    
    // Demo accounts data (same as in auth routes)
    const demoAccounts = {
      'demo-admin-001': {
        id: 'demo-admin-001',
        email: 'admin@lcc360.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        fullName: 'Admin User',
        isActive: true
      },
      'demo-teacher-001': {
        id: 'demo-teacher-001',
        email: 'teacher@lcc360.com',
        firstName: 'Teacher',
        lastName: 'Demo',
        role: 'teacher',
        fullName: 'Teacher Demo',
        subjects: ['Mathematics', 'Science'],
        isActive: true
      },
      'demo-student-001': {
        id: 'demo-student-001',
        email: 'student@lcc360.com',
        firstName: 'Student',
        lastName: 'Demo',
        role: 'student',
        fullName: 'Student Demo',
        grade: '10',
        subjects: ['Mathematics', 'Science'],
        isActive: true
      }
    };

    // Check if this is a demo account
    const demoUser = demoAccounts[decoded.userId];
    if (demoUser) {
      console.log('✅ Demo account token verified:', demoUser.email, 'Role:', demoUser.role);
      
      // Add user info to request for demo account
      req.user = {
        userId: decoded.userId,
        role: decoded.role, // Use role from token
        userDoc: demoUser
      };
      
      console.log('🔧 DEBUG - req.user set to:', { userId: req.user.userId, role: req.user.role });
      
      return next();
    }

    // Try database authentication for non-demo accounts
    try {
      // Check if user still exists and is active
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Token is no longer valid'
        });
      }

      // Add user info to request
      req.user = {
        userId: decoded.userId,
        role: decoded.role,
        userDoc: user
      };

      console.log('🔧 DEBUG - Database user authenticated:', { userId: req.user.userId, role: req.user.role });

      next();
    } catch (dbError) {
      console.error('Database authentication failed in middleware:', dbError.message);
      
      // If database fails and not a demo account, return error
      return res.status(401).json({
        success: false,
        message: 'Authentication failed. Database temporarily unavailable.'
      });
    }

  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

// Admin-only middleware
const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
  next();
};

// Teacher-only middleware
const teacherMiddleware = (req, res, next) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Teacher privileges required.'
    });
  }
  next();
};

// Student-only middleware
const studentMiddleware = (req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Student privileges required.'
    });
  }
  next();
};

// Teacher or Admin middleware
const teacherOrAdminMiddleware = (req, res, next) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Teacher or Admin privileges required.'
    });
  }
  next();
};

// Admin or Teacher managing their own students middleware
const manageStudentsMiddleware = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      // Admins can manage all students
      return next();
    }
    
    if (req.user.role === 'teacher') {
      // Teachers can only manage their assigned students
      const teacher = await User.findById(req.user.userId).populate('assignedStudents');
      
      // If checking a specific student, verify they're assigned to this teacher
      if (req.params.studentId) {
        const isAssigned = teacher.assignedStudents.some(
          student => student._id.toString() === req.params.studentId
        );
        
        if (!isAssigned) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You can only manage your assigned students.'
          });
        }
      }
      
      // Add teacher's assigned students to request for filtering
      req.assignedStudents = teacher.assignedStudents.map(s => s._id.toString());
      return next();
    }
    
    return res.status(403).json({
      success: false,
      message: 'Access denied. Insufficient privileges.'
    });
    
  } catch (error) {
    console.error('Manage students middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in authorization'
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await User.findById(decoded.userId);
    if (user && user.isActive) {
      req.user = {
        userId: decoded.userId,
        role: decoded.role,
        userDoc: user
      };
    }

    next();
  } catch (error) {
    // If token is invalid, continue without authentication
    next();
  }
};

// Resource ownership middleware (user can only access their own resources)
const ownershipMiddleware = (req, res, next) => {
  const resourceUserId = req.params.userId || req.body.userId;
  
  if (req.user.role === 'admin') {
    // Admins can access any resource
    return next();
  }
  
  if (req.user.userId !== resourceUserId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only access your own resources.'
    });
  }
  
  next();
};

// Role-based access control middleware
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    console.log('🔧 DEBUG - requireRole check:', { 
      allowedRoles, 
      userRole: req.user?.role, 
      userId: req.user?.userId,
      hasUser: !!req.user 
    });
    
    if (!req.user) {
      console.log('❌ DEBUG - No user in request');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      console.log('❌ DEBUG - Role not allowed:', { 
        userRole: req.user.role, 
        allowedRoles,
        includes: allowedRoles.includes(req.user.role)
      });
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${allowedRoles.join(', ')}`
      });
    }

    console.log('✅ DEBUG - Role check passed:', req.user.role);
    next();
  };
};

module.exports = {
  authMiddleware,
  adminMiddleware,
  teacherMiddleware,
  studentMiddleware,
  teacherOrAdminMiddleware,
  manageStudentsMiddleware,
  optionalAuthMiddleware,
  ownershipMiddleware,
  requireRole
}; 