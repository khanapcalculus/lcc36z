const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Session = require('../models/Session');
const { authMiddleware, requireRole } = require('../middleware/auth');
const mongoose = require('mongoose');

// @route   GET /api/users
// @desc    Get all users (Admin only) or filtered users
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { role, grade, subject, search, limit = 50, page = 1 } = req.query;
    const userRole = req.user.userDoc.role;
    const userId = req.user.userId;

    let query = {};
    let allowedFields = 'firstName lastName email role isActive createdAt';

    // Role-based access control
    if (userRole === 'admin') {
      // Admins can see all users
      if (role) query.role = role;
      if (grade) query.grade = grade;
      if (subject) query.subjects = subject;
      allowedFields += ' grade subjects lastLogin sessionCount';
    } else if (userRole === 'teacher') {
      // Teachers can see their assigned students
      query.role = 'student';
      // TODO: Add logic to filter students assigned to this teacher
      allowedFields = 'firstName lastName email grade isActive';
    } else {
      // Students can only see basic info of other students in their sessions
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Search functionality
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select(allowedFields)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: users.length,
        totalUsers: total
      }
    });

  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users',
      error: error.message
    });
  }
});

// @route   GET /api/users/teachers/available
// @desc    Get available teachers for assignment
// @access  Private (Admin only)
router.get('/teachers/available', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { subject, search } = req.query;

    let query = { role: 'teacher', isActive: true };
    
    if (subject) {
      query.subjects = subject;
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const teachers = await User.find(query)
      .select('firstName lastName email subjects')
      .sort({ firstName: 1, lastName: 1 });

    res.json({
      success: true,
      teachers
    });

  } catch (error) {
    console.error('❌ Error fetching available teachers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching teachers',
      error: error.message
    });
  }
});

// @route   GET /api/users/students/available
// @desc    Get available students for assignment
// @access  Private (Admin/Teacher)
router.get('/students/available', authMiddleware, requireRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { grade, search } = req.query;
    const userRole = req.user.userDoc.role;
    const userId = req.user.userId;

    let query = { role: 'student', isActive: true };
    
    // If teacher, only show their assigned students
    if (userRole === 'teacher') {
      query.assignedTeacher = userId;
    }
    
    if (grade) {
      query.grade = grade;
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const students = await User.find(query)
      .select('firstName lastName email grade assignedTeacher')
      .populate('assignedTeacher', 'firstName lastName')
      .sort({ grade: 1, firstName: 1, lastName: 1 });

    res.json({
      success: true,
      students: students.map(student => ({
        _id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        grade: student.grade,
        assignedTeacher: student.assignedTeacher ? {
          id: student.assignedTeacher._id,
          name: `${student.assignedTeacher.firstName} ${student.assignedTeacher.lastName}`
        } : null
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching available students:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching students',
      error: error.message
    });
  }
});

// @route   GET /api/users/dashboard/stats
// @desc    Get user management statistics for admin dashboard
// @access  Private (Admin only)
router.get('/dashboard/stats', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    const totalTeachers = await User.countDocuments({ role: 'teacher' });
    const totalStudents = await User.countDocuments({ role: 'student' });
    const activeTeachers = await User.countDocuments({ role: 'teacher', isActive: true });
    const activeStudents = await User.countDocuments({ role: 'student', isActive: true });

    // Get recent registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentRegistrations = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get users by grade distribution
    const gradeDistribution = await User.aggregate([
      { $match: { role: 'student', isActive: true } },
      { $group: { _id: '$grade', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Get users by subject distribution
    const subjectDistribution = await User.aggregate([
      { $match: { role: 'teacher', isActive: true } },
      { $unwind: '$subjects' }, // Unwind the subjects array
      { $group: { _id: '$subjects', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        totalAdmins,
        totalTeachers,
        totalStudents,
        activeTeachers,
        activeStudents,
        recentRegistrations,
        gradeDistribution,
        subjectDistribution
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user statistics',
      error: error.message
    });
  }
});

// @route   GET /api/users/teacher/students/stats
// @desc    Get student statistics for teacher dashboard
// @access  Private (Teacher only)
router.get('/teacher/students/stats', authMiddleware, requireRole(['teacher']), async (req, res) => {
  try {
    const teacherId = req.user.userId;
    
    // Get only students assigned to this teacher
    const assignedStudents = await User.countDocuments({ 
      role: 'student', 
      isActive: true,
      assignedTeacher: teacherId
    });
    
    // Get students who have participated in this teacher's sessions
    const sessionsWithStudents = await Session.find({ teacher: teacherId })
      .populate('students', '_id')
      .select('students');
    
    const uniqueStudentIds = new Set();
    sessionsWithStudents.forEach(session => {
      if (session.students && Array.isArray(session.students)) {
        session.students.forEach(student => {
          if (student && student._id) {
            uniqueStudentIds.add(student._id.toString());
          } else if (typeof student === 'string') {
            // Handle demo accounts or string IDs
            uniqueStudentIds.add(student);
          }
        });
      }
    });
    
    const studentsInSessions = uniqueStudentIds.size;

    res.json({
      success: true,
      stats: {
        totalStudents: assignedStudents,
        activeStudents: assignedStudents,
        myStudents: assignedStudents,
        studentsInSessions: studentsInSessions
      }
    });

  } catch (error) {
    console.error('❌ Error fetching teacher student stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student statistics',
      error: error.message
    });
  }
});

// @route   GET /api/users/teacher/students
// @desc    Get students assigned to a specific teacher
// @access  Private (Teacher only)
router.get('/teacher/students', authMiddleware, requireRole(['teacher']), async (req, res) => {
  try {
    const teacherId = req.user.userId;
    const { grade, search, limit = 20, page = 1 } = req.query;

    // Get only students assigned to this teacher
    let query = { 
      role: 'student', 
      isActive: true,
      assignedTeacher: teacherId
    };
    
    if (grade) query.grade = grade;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const students = await User.find(query)
      .select('firstName lastName email grade totalSessions totalSessionTime')
      .sort({ grade: 1, firstName: 1, lastName: 1 });

    // Add session statistics for each student
    const studentsWithStats = await Promise.all(
      students.map(async (student) => {
        const studentSessions = await Session.countDocuments({
          teacher: teacherId,
          students: student._id,
          status: 'completed'
        });
        
        const sessionHours = await Session.find({
          teacher: teacherId,
          students: student._id,
          status: 'completed'
        }).select('duration');
        
        const totalHours = Math.round(
          sessionHours.reduce((total, session) => total + (session.duration || 0), 0) / 60
        );

        return {
          ...student.toObject(),
          totalSessions: studentSessions,
          totalHours
        };
      })
    );

    // Apply pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedStudents = studentsWithStats.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      students: paginatedStudents,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(studentsWithStats.length / parseInt(limit)),
        count: paginatedStudents.length,
        totalStudents: studentsWithStats.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching teacher students:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching students',
      error: error.message
    });
  }
});

// @route   GET /api/users/teacher-student-assignments
// @desc    Get all teacher-student assignments (Admin only)
// @access  Private (Admin only)
router.get('/teacher-student-assignments', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    console.log('📋 Fetching teacher-student assignments...');

    // Get all teachers with their assigned students
    let teachers = [];
    try {
      teachers = await User.find({ role: 'teacher', isActive: true })
        .populate({
          path: 'assignedStudents',
          select: 'firstName lastName email grade',
          match: { isActive: true }
        })
        .select('firstName lastName email subjects assignedStudents')
        .sort({ firstName: 1, lastName: 1 });
      
      console.log(`✅ Found ${teachers.length} teachers`);
    } catch (populateError) {
      console.error('❌ Error populating teachers:', populateError);
      // Fallback: get teachers without populate
      teachers = await User.find({ role: 'teacher', isActive: true })
        .select('firstName lastName email subjects assignedStudents')
        .sort({ firstName: 1, lastName: 1 });
      console.log(`✅ Fallback: Found ${teachers.length} teachers without populate`);
    }

    // Get unassigned students
    let unassignedStudents = [];
    try {
      unassignedStudents = await User.find({ 
        role: 'student', 
        isActive: true,
        $or: [
          { assignedTeacher: { $exists: false } },
          { assignedTeacher: null }
        ]
      })
        .select('firstName lastName email grade')
        .sort({ grade: 1, firstName: 1, lastName: 1 });
      
      console.log(`✅ Found ${unassignedStudents.length} unassigned students`);
    } catch (studentError) {
      console.error('❌ Error fetching unassigned students:', studentError);
      unassignedStudents = [];
    }

    // Process teachers data safely
    const processedTeachers = teachers.map(teacher => {
      const teacherObj = teacher.toObject ? teacher.toObject() : teacher;
      
      // Handle assignedStudents safely
      let assignedStudents = [];
      if (teacherObj.assignedStudents && Array.isArray(teacherObj.assignedStudents)) {
        assignedStudents = teacherObj.assignedStudents
          .filter(student => student && student._id) // Filter out null/undefined students
          .map(student => {
            const studentObj = student.toObject ? student.toObject() : student;
            return {
              id: studentObj._id,
              name: `${studentObj.firstName || 'Unknown'} ${studentObj.lastName || 'Student'}`,
              email: studentObj.email || 'No email',
              grade: studentObj.grade || 'Unknown'
            };
          });
      }

      return {
        id: teacherObj._id,
        name: `${teacherObj.firstName || 'Unknown'} ${teacherObj.lastName || 'Teacher'}`,
        email: teacherObj.email || 'No email',
        subjects: teacherObj.subjects || [],
        assignedStudents
      };
    });

    // Process unassigned students data safely
    const processedUnassignedStudents = unassignedStudents.map(student => {
      const studentObj = student.toObject ? student.toObject() : student;
      return {
        id: studentObj._id,
        name: `${studentObj.firstName || 'Unknown'} ${studentObj.lastName || 'Student'}`,
        email: studentObj.email || 'No email',
        grade: studentObj.grade || 'Unknown'
      };
    });

    console.log(`✅ Processed ${processedTeachers.length} teachers and ${processedUnassignedStudents.length} unassigned students`);

    res.json({
      success: true,
      assignments: {
        teachers: processedTeachers,
        unassignedStudents: processedUnassignedStudents
      }
    });

  } catch (error) {
    console.error('❌ Error fetching teacher-student assignments:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching assignments',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @route   POST /api/users
// @desc    Create a new user (Admin only)
// @access  Private
router.post('/', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      role,
      grade,
      subject,
      isActive = true
    } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: firstName, lastName, email, password, role'
      });
    }

    // Validate role
    if (!['admin', 'teacher', 'student'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be admin, teacher, or student'
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

    // Validate grade and subject for students and teachers
    if (role === 'student' && !grade) {
      return res.status(400).json({
        success: false,
        message: 'Grade is required for students'
      });
    }

    if (role === 'teacher' && !subject) {
      return res.status(400).json({
        success: false,
        message: 'Subject is required for teachers'
      });
    }

    // Prepare user data
    const userData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password: password, // Let the model's pre-save middleware handle hashing
      role,
      isActive
    };

    // Only set createdBy if it's a real ObjectId (not a demo account)
    if (req.user.userId && mongoose.Types.ObjectId.isValid(req.user.userId)) {
      userData.createdBy = req.user.userId;
    }

    // Add role-specific fields
    if (role === 'student') {
      userData.grade = grade;
      // For students, subjects can be empty initially or set based on grade
      userData.subjects = [];
    } else if (role === 'teacher') {
      // Convert single subject to array for teachers
      userData.subjects = [subject];
    }

    // Create user
    const user = new User(userData);
    await user.save();

    // Remove password from response
    const userResponse = user.toJSON();

    console.log('✅ User created successfully:', user.email);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: userResponse
    });

  } catch (error) {
    console.error('❌ Error creating user:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    if (error.errors) {
      console.error('Validation errors:', error.errors);
    }
    console.error('Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Server error while creating user',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get a specific user by ID
// @access  Private
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const requestedUserId = req.params.id;
    const currentUserId = req.user.userId;
    const userRole = req.user.userDoc.role;

    // Check access permissions
    if (userRole !== 'admin' && requestedUserId !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own profile'
      });
    }

    const user = await User.findById(requestedUserId).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get additional stats for the user
    let additionalStats = {};
    
    if (user.role === 'teacher') {
      const totalSessions = await Session.countDocuments({ teacher: user._id });
      const activeSessions = await Session.countDocuments({ teacher: user._id, status: 'active' });
      const completedSessions = await Session.countDocuments({ teacher: user._id, status: 'completed' });
      const totalStudents = await Session.distinct('students', { teacher: user._id });
      
      additionalStats = {
        totalSessions,
        activeSessions,
        completedSessions,
        totalStudents: totalStudents.length
      };
    } else if (user.role === 'student') {
      const totalSessions = await Session.countDocuments({ students: user._id });
      const completedSessions = await Session.countDocuments({ students: user._id, status: 'completed' });
      
      additionalStats = {
        totalSessions,
        completedSessions
      };
    }

    res.json({
      success: true,
      user: {
        ...user.toJSON(),
        stats: additionalStats
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user',
      error: error.message
    });
  }
});

// @route   PUT /api/users/:id
// @desc    Update a user
// @access  Private
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const requestedUserId = req.params.id;
    const currentUserId = req.user.userId;
    const userRole = req.user.userDoc.role;

    // Check access permissions
    if (userRole !== 'admin' && requestedUserId !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own profile'
      });
    }

    const user = await User.findById(requestedUserId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const {
      firstName,
      lastName,
      email,
      grade,
      subject,
      isActive,
      role
    } = req.body;

    // Update allowed fields
    if (firstName) user.firstName = firstName.trim();
    if (lastName) user.lastName = lastName.trim();
    
    // Only admins can change email, role, and isActive status
    if (userRole === 'admin') {
      if (email) {
        // Check if new email is already taken
        const existingUser = await User.findOne({ 
          email: email.toLowerCase(),
          _id: { $ne: requestedUserId }
        });
        
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'Email is already taken by another user'
          });
        }
        
        user.email = email.toLowerCase().trim();
      }
      
      if (role && ['admin', 'teacher', 'student'].includes(role)) {
        user.role = role;
      }
      
      if (isActive !== undefined) {
        user.isActive = isActive;
      }
    }

    // Update grade for students
    if (user.role === 'student' && grade) {
      user.grade = grade;
    }

    // Update subject for teachers
    if (user.role === 'teacher' && subject) {
      user.subjects = [subject];
    }

    // Only set lastModifiedBy if it's a real ObjectId (not a demo account)
    if (currentUserId && mongoose.Types.ObjectId.isValid(currentUserId)) {
      user.lastModifiedBy = currentUserId;
    }
    await user.save();

    // Remove password from response
    const userResponse = user.toJSON();
    delete userResponse.password;

    console.log('✅ User updated successfully:', user.email);

    res.json({
      success: true,
      message: 'User updated successfully',
      user: userResponse
    });

  } catch (error) {
    console.error('❌ Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating user',
      error: error.message
    });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete/Deactivate a user
// @access  Private (Admin only)
router.delete('/:id', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const userId = req.params.id;
    const currentUserId = req.user.userId;

    // Prevent admin from deleting themselves
    if (userId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has active sessions
    const activeSessions = await Session.countDocuments({
      $or: [
        { teacher: userId, status: { $in: ['scheduled', 'active'] } },
        { students: userId, status: { $in: ['scheduled', 'active'] } }
      ]
    });

    if (activeSessions > 0) {
      // Deactivate instead of delete if user has active sessions
      user.isActive = false;
      // Only set lastModifiedBy if it's a real ObjectId (not a demo account)
      if (currentUserId && mongoose.Types.ObjectId.isValid(currentUserId)) {
        user.lastModifiedBy = currentUserId;
      }
      await user.save();

      console.log('✅ User deactivated successfully:', user.email);

      res.json({
        success: true,
        message: 'User deactivated successfully (has active sessions)'
      });
    } else {
      // Safe to delete if no active sessions
      await User.findByIdAndDelete(userId);

      console.log('✅ User deleted successfully:', user.email);

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    }

  } catch (error) {
    console.error('❌ Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting user',
      error: error.message
    });
  }
});

// @route   POST /api/users/:id/reset-password
// @desc    Reset user password (Admin only)
// @access  Private
router.post('/:id/reset-password', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const userId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Set new password (let model middleware handle hashing)
    user.password = newPassword;
    // Only set lastModifiedBy if it's a real ObjectId (not a demo account)
    if (req.user.userId && mongoose.Types.ObjectId.isValid(req.user.userId)) {
      user.lastModifiedBy = req.user.userId;
    }
    await user.save();

    console.log('✅ Password reset successfully for user:', user.email);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('❌ Error resetting password:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resetting password',
      error: error.message
    });
  }
});

// @route   POST /api/users/assign-student-to-teacher
// @desc    Assign a student to a teacher (Admin only)
// @access  Private (Admin only)
router.post('/assign-student-to-teacher', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { studentId, teacherId } = req.body;

    if (!studentId || !teacherId) {
      return res.status(400).json({
        success: false,
        message: 'Both studentId and teacherId are required'
      });
    }

    // Validate student exists and is a student
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found or invalid role'
      });
    }

    // Validate teacher exists and is a teacher
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found or invalid role'
      });
    }

    // Remove student from previous teacher if assigned
    if (student.assignedTeacher) {
      const previousTeacher = await User.findById(student.assignedTeacher);
      if (previousTeacher) {
        previousTeacher.assignedStudents = previousTeacher.assignedStudents.filter(
          id => id.toString() !== studentId
        );
        await previousTeacher.save();
      }
    }

    // Assign student to new teacher
    student.assignedTeacher = teacherId;
    await student.save();

    // Add student to teacher's assigned students if not already there
    if (!teacher.assignedStudents.includes(studentId)) {
      teacher.assignedStudents.push(studentId);
      await teacher.save();
    }

    console.log(`✅ Student ${student.firstName} ${student.lastName} assigned to teacher ${teacher.firstName} ${teacher.lastName}`);

    res.json({
      success: true,
      message: 'Student assigned to teacher successfully',
      assignment: {
        student: {
          id: student._id,
          name: `${student.firstName} ${student.lastName}`,
          email: student.email,
          grade: student.grade
        },
        teacher: {
          id: teacher._id,
          name: `${teacher.firstName} ${teacher.lastName}`,
          email: teacher.email,
          subjects: teacher.subjects
        }
      }
    });

  } catch (error) {
    console.error('❌ Error assigning student to teacher:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while assigning student to teacher',
      error: error.message
    });
  }
});

// @route   POST /api/users/unassign-student-from-teacher
// @desc    Remove student assignment from teacher (Admin only)
// @access  Private (Admin only)
router.post('/unassign-student-from-teacher', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'studentId is required'
      });
    }

    // Find student
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found or invalid role'
      });
    }

    // Remove from teacher's assigned students
    if (student.assignedTeacher) {
      const teacher = await User.findById(student.assignedTeacher);
      if (teacher) {
        teacher.assignedStudents = teacher.assignedStudents.filter(
          id => id.toString() !== studentId
        );
        await teacher.save();
      }
    }

    // Remove teacher assignment from student
    student.assignedTeacher = undefined;
    await student.save();

    console.log(`✅ Student ${student.firstName} ${student.lastName} unassigned from teacher`);

    res.json({
      success: true,
      message: 'Student unassigned from teacher successfully'
    });

  } catch (error) {
    console.error('❌ Error unassigning student from teacher:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while unassigning student from teacher',
      error: error.message
    });
  }
});

module.exports = router; 