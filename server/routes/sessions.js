const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const User = require('../models/User');
const { authMiddleware, requireRole } = require('../middleware/auth');
const mongoose = require('mongoose');

// @route   GET /api/sessions/teacher/stats
// @desc    Get session statistics for teacher dashboard
// @access  Private (Teacher only)
router.get('/teacher/stats', authMiddleware, requireRole(['teacher']), async (req, res) => {
  try {
    const teacherId = req.user.userId;
    
    const totalSessions = await Session.countDocuments({ teacher: teacherId });
    const activeSessions = await Session.countDocuments({ teacher: teacherId, status: 'active' });
    const completedSessions = await Session.countDocuments({ teacher: teacherId, status: 'completed' });
    const scheduledSessions = await Session.countDocuments({ teacher: teacherId, status: 'scheduled' });
    
    // Get upcoming sessions (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcomingSessions = await Session.countDocuments({
      teacher: teacherId,
      status: 'scheduled',
      scheduledDate: { $gte: new Date(), $lte: nextWeek }
    });

    // Calculate total teaching hours
    const completedSessionsWithDuration = await Session.find({
      teacher: teacherId,
      status: 'completed'
    }).select('duration');
    
    const totalTeachingHours = Math.round(
      completedSessionsWithDuration.reduce((total, session) => total + (session.duration || 0), 0) / 60
    );

    // Get recent sessions
    const recentSessions = await Session.find({ teacher: teacherId })
      .sort({ scheduledDate: -1 })
      .limit(10)
      .select('title scheduledDate status');

    // Calculate average attendance (mock data for now)
    const averageAttendance = 85; // This would be calculated from actual attendance data

    res.json({
      success: true,
      stats: {
        totalSessions,
        activeSessions,
        completedSessions,
        scheduledSessions,
        upcomingSessions,
        totalTeachingHours,
        averageAttendance,
        recentSessions
      }
    });

  } catch (error) {
    console.error('❌ Error fetching teacher session stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching session statistics',
      error: error.message
    });
  }
});

// @route   GET /api/sessions/teacher
// @desc    Get sessions for a specific teacher
// @access  Private (Teacher only)
router.get('/teacher', authMiddleware, requireRole(['teacher']), async (req, res) => {
  try {
    const teacherId = req.user.userId;
    const { status, upcoming, grade, limit = 20, page = 1 } = req.query;

    let query = { teacher: teacherId };

    // Apply filters
    if (status) query.status = status;
    if (grade) query.grade = grade;
    
    if (upcoming === 'true') {
      query.scheduledDate = { $gte: new Date() };
      query.status = { $in: ['scheduled', 'active'] };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const sessions = await Session.find(query)
      .populate('students', 'firstName lastName email grade')
      .sort({ scheduledDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Session.countDocuments(query);

    res.json({
      success: true,
      sessions,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: sessions.length,
        totalSessions: total
      }
    });

  } catch (error) {
    console.error('❌ Error fetching teacher sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sessions',
      error: error.message
    });
  }
});

// @route   GET /api/sessions/dashboard/stats
// @desc    Get dashboard statistics for the current user
// @access  Private
router.get('/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.userDoc.role;

    let stats = {};

    if (userRole === 'admin') {
      // Admin stats - all sessions
      const totalSessions = await Session.countDocuments();
      const activeSessions = await Session.countDocuments({ status: 'active' });
      const scheduledSessions = await Session.countDocuments({ status: 'scheduled' });
      const completedSessions = await Session.countDocuments({ status: 'completed' });
      const totalUsers = await User.countDocuments();
      const totalTeachers = await User.countDocuments({ role: 'teacher' });
      const totalStudents = await User.countDocuments({ role: 'student' });

      stats = {
        totalSessions,
        activeSessions,
        scheduledSessions,
        completedSessions,
        totalUsers,
        totalTeachers,
        totalStudents
      };

    } else if (userRole === 'teacher') {
      // Teacher stats - their sessions
      const totalSessions = await Session.countDocuments({ teacher: userId });
      const activeSessions = await Session.countDocuments({ teacher: userId, status: 'active' });
      const scheduledSessions = await Session.countDocuments({ teacher: userId, status: 'scheduled' });
      const completedSessions = await Session.countDocuments({ teacher: userId, status: 'completed' });
      
      const myStudents = await Session.distinct('students', { teacher: userId });
      const totalStudents = myStudents.length;

      stats = {
        totalSessions,
        activeSessions,
        scheduledSessions,
        completedSessions,
        totalStudents
      };

    } else if (userRole === 'student') {
      // Student stats - sessions they're part of
      const totalSessions = await Session.countDocuments({ students: userId });
      const activeSessions = await Session.countDocuments({ students: userId, status: 'active' });
      const scheduledSessions = await Session.countDocuments({ students: userId, status: 'scheduled' });
      const completedSessions = await Session.countDocuments({ students: userId, status: 'completed' });

      stats = {
        totalSessions,
        activeSessions,
        scheduledSessions,
        completedSessions
      };
    }

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard stats',
      error: error.message
    });
  }
});

// @route   GET /api/sessions/join/:shareLink
// @desc    Get session details by share link (for joining)
// @access  Public
router.get('/join/:shareLink', async (req, res) => {
  try {
    const { shareLink } = req.params;

    const session = await Session.findSessionByShareLink(shareLink);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or link is invalid'
      });
    }

    // Return basic session info (don't include sensitive data)
    const sessionInfo = {
      sessionId: session.sessionId,
      title: session.title,
      description: session.description,
      subject: session.subject,
      grade: session.grade,
      scheduledDate: session.scheduledDate,
      duration: session.duration,
      timezone: session.timezone,
      teacher: {
        firstName: session.teacher.firstName,
        lastName: session.teacher.lastName
      },
      status: session.status,
      isPublic: session.isPublic,
      requiresApproval: session.requiresApproval,
      requiresPassword: !!session.password,
      maxParticipants: session.maxParticipants,
      currentParticipants: session.analytics.totalParticipants,
      formattedDuration: session.formattedDuration,
      timeUntilSession: session.timeUntilSession
    };

    res.json({
      success: true,
      session: sessionInfo
    });

  } catch (error) {
    console.error('❌ Error fetching session by share link:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching session',
      error: error.message
    });
  }
});

// @route   POST /api/sessions
// @desc    Create a new session (Teachers and Admins only)
// @access  Private
router.post('/', authMiddleware, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    console.log('🔧 DEBUG - Session creation request received');
    console.log('🔧 DEBUG - User info:', { 
      userId: req.user?.userId, 
      role: req.user?.role,
      userDoc: req.user?.userDoc ? 'present' : 'missing'
    });
    console.log('🔧 DEBUG - Request body keys:', Object.keys(req.body));
    
    const {
      title,
      description,
      scheduledDate,
      duration,
      timezone,
      subject,
      grade,
      students,
      maxParticipants,
      isRecurring,
      recurringPattern,
      recurringEndDate,
      isPublic,
      requiresApproval,
      password,
      tags,
      notes
    } = req.body;

    // Validation
    if (!title || !scheduledDate || !duration || !subject || !grade) {
      console.log('❌ DEBUG - Validation failed - missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: title, scheduledDate, duration, subject, grade'
      });
    }

    // Validate scheduled date is in the future
    const sessionDate = new Date(scheduledDate);
    if (sessionDate <= new Date()) {
      console.log('❌ DEBUG - Validation failed - date in past');
      return res.status(400).json({
        success: false,
        message: 'Session must be scheduled for a future date and time'
      });
    }

    // Validate students exist if provided
    let validStudents = [];
    if (students && students.length > 0) {
      console.log('🔧 DEBUG - Processing students:', students);
      // Demo accounts for validation
      const demoStudents = ['demo-student-001'];
      
      // Separate demo accounts from real database IDs
      const demoStudentIds = students.filter(id => demoStudents.includes(id));
      const realStudentIds = students.filter(id => !demoStudents.includes(id));
      
      // Validate real database students
      if (realStudentIds.length > 0) {
        // For teachers, only allow assigning their own students
        let studentQuery = {
          _id: { $in: realStudentIds },
          role: 'student'
        };
        
        // If user is a teacher, restrict to their assigned students only
        if (req.user.userDoc.role === 'teacher') {
          studentQuery.assignedTeacher = req.user.userId;
        }
        
        const studentUsers = await User.find(studentQuery);
        
        if (studentUsers.length !== realStudentIds.length) {
          console.log('❌ DEBUG - Student validation failed');
          return res.status(400).json({
            success: false,
            message: req.user.userDoc.role === 'teacher' 
              ? 'You can only assign students that are assigned to you'
              : 'One or more student IDs are invalid'
          });
        }
      }
      
      // Combine demo and real students
      validStudents = [...demoStudentIds, ...realStudentIds];
      console.log('✅ DEBUG - Valid students:', validStudents);
    }

    // Create session
    console.log('🔧 DEBUG - Creating session with teacher ID:', req.user.userId);
    const session = new Session({
      title,
      description,
      scheduledDate: sessionDate,
      duration,
      timezone: timezone || 'America/Los_Angeles',
      subject,
      grade,
      teacher: req.user.userId,
      students: validStudents,
      maxParticipants: maxParticipants || 30,
      isRecurring: isRecurring || false,
      recurringPattern,
      recurringEndDate,
      isPublic: isPublic || false,
      requiresApproval: requiresApproval || false,
      password,
      tags: tags || [],
      notes,
      createdBy: req.user.userId
    });

    await session.save();

    // For demo accounts, we can't populate from database, so we'll add the info manually
    const sessionResponse = session.toJSON();
    
    // Add teacher info for demo accounts
    if (req.user.userId === 'demo-teacher-001') {
      sessionResponse.teacher = {
        _id: 'demo-teacher-001',
        firstName: 'Teacher',
        lastName: 'Demo',
        email: 'teacher@lcc360.com'
      };
    }
    
    // Add student info for demo accounts
    if (sessionResponse.students && sessionResponse.students.length > 0) {
      sessionResponse.students = sessionResponse.students.map(studentId => {
        if (studentId === 'demo-student-001') {
          return {
            _id: 'demo-student-001',
            firstName: 'Student',
            lastName: 'Demo',
            email: 'student@lcc360.com'
          };
        }
        return studentId; // Keep real database IDs as is for now
      });
    }

    console.log('✅ Session created successfully:', session.sessionId);

    res.status(201).json({
      success: true,
      message: 'Session created successfully',
      session: sessionResponse
    });

  } catch (error) {
    console.error('❌ Error creating session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating session',
      error: error.message
    });
  }
});

// @route   GET /api/sessions
// @desc    Get sessions for the current user
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, upcoming, limit = 50, page = 1 } = req.query;
    const userId = req.user.userId;
    const userRole = req.user.userDoc.role;

    let query = {};
    
    // Build query based on user role
    if (userRole === 'admin') {
      // Admins can see all sessions
      if (status) query.status = status;
    } else if (userRole === 'teacher') {
      // Teachers see their own sessions
      query.teacher = userId;
      if (status) query.status = status;
    } else if (userRole === 'student') {
      // Students see sessions they're assigned to
      query.students = userId;
      if (status) query.status = status;
    }

    // Filter for upcoming sessions
    if (upcoming === 'true') {
      query.scheduledDate = { $gte: new Date() };
      query.status = { $in: ['scheduled', 'active'] };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const sessions = await Session.find(query)
      .populate('teacher', 'firstName lastName email')
      .populate('students', 'firstName lastName email')
      .sort({ scheduledDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Session.countDocuments(query);

    res.json({
      success: true,
      sessions: sessions.map(session => session.toJSON()),
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: sessions.length,
        totalSessions: total
      }
    });

  } catch (error) {
    console.error('❌ Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sessions',
      error: error.message
    });
  }
});

// @route   POST /api/sessions/join/:shareLink
// @desc    Join a session via share link
// @access  Private
router.post('/join/:shareLink', authMiddleware, async (req, res) => {
  try {
    const { shareLink } = req.params;
    const { password } = req.body;
    const userId = req.user.userId;

    const session = await Session.findSessionByShareLink(shareLink);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or link is invalid'
      });
    }

    // Check if session requires password
    if (session.password && session.password !== password) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect session password'
      });
    }

    // Check if user can join
    const joinCheck = session.canUserJoin(userId);
    if (!joinCheck.canJoin) {
      return res.status(403).json({
        success: false,
        message: joinCheck.reason
      });
    }

    // Check participant limit
    const currentActive = session.analytics.participantJoinTimes.filter(
      p => p.joinTime && !p.leaveTime
    ).length;

    if (currentActive >= session.maxParticipants && joinCheck.role !== 'teacher') {
      return res.status(400).json({
        success: false,
        message: 'Session has reached maximum participant limit'
      });
    }

    // Add participant to session
    await session.addParticipant(userId);

    // Update session status to active if it's the first join and scheduled
    if (session.status === 'scheduled' && !session.actualStartTime) {
      session.status = 'active';
      session.actualStartTime = new Date();
      await session.save();
    }

    console.log(`✅ User ${userId} joined session: ${session.sessionId}`);

    res.json({
      success: true,
      message: 'Successfully joined session',
      session: {
        sessionId: session.sessionId,
        title: session.title,
        shareLink: session.shareLink,
        role: joinCheck.role,
        whiteboardData: session.whiteboardData
      }
    });

  } catch (error) {
    console.error('❌ Error joining session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while joining session',
      error: error.message
    });
  }
});

// @route   POST /api/sessions/:id/start
// @desc    Start a session (Teacher only)
// @access  Private
router.post('/:id/start', authMiddleware, requireRole(['teacher']), async (req, res) => {
  try {
    const sessionId = req.params.id;
    const teacherId = req.user.userId;

    console.log('🔧 DEBUG - Start session request received');
    console.log('🔧 DEBUG - Session ID:', sessionId);
    console.log('🔧 DEBUG - Teacher ID from token:', teacherId);
    console.log('🔧 DEBUG - User role:', req.user.role);

    const session = await Session.findById(sessionId);

    if (!session) {
      console.log('❌ DEBUG - Session not found:', sessionId);
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    console.log('🔧 DEBUG - Session found, teacher in DB:', session.teacher);
    console.log('🔧 DEBUG - Teacher ID match:', session.teacher.toString() === teacherId);

    // Check if teacher owns this session
    if (session.teacher.toString() !== teacherId) {
      console.log('❌ DEBUG - Teacher ownership check failed');
      return res.status(403).json({
        success: false,
        message: 'You can only start your own sessions'
      });
    }

    // Check if session is scheduled
    if (session.status !== 'scheduled') {
      console.log('❌ DEBUG - Session status check failed, current status:', session.status);
      return res.status(400).json({
        success: false,
        message: 'Session must be scheduled to start'
      });
    }

    // Update session status
    session.status = 'active';
    session.actualStartTime = new Date();
    await session.save();

    console.log('✅ Session started successfully:', session.title);

    res.json({
      success: true,
      message: 'Session started successfully',
      session
    });

  } catch (error) {
    console.error('❌ Error starting session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while starting session',
      error: error.message
    });
  }
});

// @route   POST /api/sessions/:id/leave
// @desc    Leave a session
// @access  Private
router.post('/:id/leave', authMiddleware, async (req, res) => {
  try {
    const sessionId = req.params.id;
    const userId = req.user.userId;

    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Remove participant from session
    await session.removeParticipant(userId);

    console.log(`✅ User ${userId} left session: ${session.sessionId}`);

    res.json({
      success: true,
      message: 'Successfully left session'
    });

  } catch (error) {
    console.error('❌ Error leaving session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while leaving session',
      error: error.message
    });
  }
});

// @route   GET /api/sessions/:id/analytics
// @desc    Get session analytics
// @access  Private (Teacher/Admin only)
router.get('/:id/analytics', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('analytics.participantJoinTimes.userId', 'firstName lastName email');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check if user has access to analytics
    const userId = req.user.userId;
    const userRole = req.user.userDoc.role;
    
    if (userRole !== 'admin' && session.teacher.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only view analytics for your own sessions'
      });
    }

    // Calculate additional analytics
    const analytics = {
      ...session.analytics.toObject(),
      sessionDuration: session.actualEndTime && session.actualStartTime 
        ? Math.round((session.actualEndTime - session.actualStartTime) / (1000 * 60))
        : null,
      averageSessionTime: session.analytics.participantJoinTimes.length > 0
        ? Math.round(
            session.analytics.participantJoinTimes
              .filter(p => p.totalTime > 0)
              .reduce((sum, p) => sum + p.totalTime, 0) / 
            session.analytics.participantJoinTimes.filter(p => p.totalTime > 0).length
          )
        : 0,
      participantDetails: session.analytics.participantJoinTimes.map(p => ({
        user: p.userId,
        joinTime: p.joinTime,
        leaveTime: p.leaveTime,
        totalTime: p.totalTime,
        isActive: p.joinTime && !p.leaveTime
      }))
    };

    res.json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('❌ Error fetching session analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching analytics',
      error: error.message
    });
  }
});

// @route   GET /api/sessions/:id
// @desc    Get a specific session by ID
// @access  Private
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('teacher', 'firstName lastName email')
      .populate('students', 'firstName lastName email')
      .populate('analytics.participantJoinTimes.userId', 'firstName lastName email');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check if user has access to this session
    const userId = req.user.userId;
    const userRole = req.user.userDoc.role;
    
    const hasAccess = userRole === 'admin' || 
                     session.teacher.toString() === userId ||
                     session.students.some(student => student._id.toString() === userId) ||
                     session.isPublic;

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this session'
      });
    }

    res.json({
      success: true,
      session: session.toJSON()
    });

  } catch (error) {
    console.error('❌ Error fetching session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching session',
      error: error.message
    });
  }
});

// @route   PUT /api/sessions/:id
// @desc    Update a session
// @access  Private (Teacher/Admin only)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check if user can edit this session
    const userId = req.user.userId;
    const userRole = req.user.userDoc.role;
    
    if (userRole !== 'admin' && session.teacher.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own sessions'
      });
    }

    // Don't allow editing of completed or cancelled sessions
    if (['completed', 'cancelled'].includes(session.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit completed or cancelled sessions'
      });
    }

    const {
      title,
      description,
      scheduledDate,
      duration,
      timezone,
      subject,
      grade,
      students,
      maxParticipants,
      isPublic,
      requiresApproval,
      password,
      tags,
      notes,
      status
    } = req.body;

    // Update fields
    if (title) session.title = title;
    if (description !== undefined) session.description = description;
    if (scheduledDate) {
      const newDate = new Date(scheduledDate);
      if (newDate <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Session must be scheduled for a future date and time'
        });
      }
      session.scheduledDate = newDate;
    }
    if (duration) session.duration = duration;
    if (timezone) session.timezone = timezone;
    if (subject) session.subject = subject;
    if (grade) session.grade = grade;
    if (maxParticipants) session.maxParticipants = maxParticipants;
    if (isPublic !== undefined) session.isPublic = isPublic;
    if (requiresApproval !== undefined) session.requiresApproval = requiresApproval;
    if (password !== undefined) session.password = password;
    if (tags) session.tags = tags;
    if (notes !== undefined) session.notes = notes;
    if (status && ['scheduled', 'active', 'completed', 'cancelled'].includes(status)) {
      session.status = status;
    }

    // Handle students update
    if (students) {
      const studentUsers = await User.find({
        _id: { $in: students },
        role: 'student'
      });
      
      if (studentUsers.length !== students.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more student IDs are invalid'
        });
      }
      session.students = students;
    }

    session.lastModifiedBy = userId;
    await session.save();

    // Populate and return updated session
    await session.populate('teacher', 'firstName lastName email');
    await session.populate('students', 'firstName lastName email');

    console.log('✅ Session updated successfully:', session.sessionId);

    res.json({
      success: true,
      message: 'Session updated successfully',
      session: session.toJSON()
    });

  } catch (error) {
    console.error('❌ Error updating session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating session',
      error: error.message
    });
  }
});

// @route   DELETE /api/sessions/:id
// @desc    Delete/Cancel a session
// @access  Private (Teacher/Admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check if user can delete this session
    const userId = req.user.userId;
    const userRole = req.user.userDoc.role;
    
    if (userRole !== 'admin' && session.teacher.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own sessions'
      });
    }

    // If session is active or has participants, mark as cancelled instead of deleting
    if (session.status === 'active' || session.analytics.totalParticipants > 0) {
      session.status = 'cancelled';
      session.lastModifiedBy = userId;
      await session.save();

      console.log('✅ Session cancelled successfully:', session.sessionId);

      res.json({
        success: true,
        message: 'Session cancelled successfully'
      });
    } else {
      // Safe to delete if no participants and not active
      await Session.findByIdAndDelete(req.params.id);

      console.log('✅ Session deleted successfully:', session.sessionId);

      res.json({
        success: true,
        message: 'Session deleted successfully'
      });
    }

  } catch (error) {
    console.error('❌ Error deleting session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting session',
      error: error.message
    });
  }
});

// @route   PATCH /api/sessions/:id/make-public
// @desc    Make a session public (for testing/debugging)
// @access  Private (Teacher/Admin only)
router.patch('/:id/make-public', authMiddleware, async (req, res) => {
  try {
    const sessionId = req.params.id;
    const userId = req.user.userId;
    const userRole = req.user.userDoc.role;

    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check if user has permission to modify this session
    if (userRole !== 'admin' && session.teacher.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only modify your own sessions'
      });
    }

    // Make session public
    session.isPublic = true;
    await session.save();

    console.log(`✅ Session ${session.sessionId} made public by user ${userId}`);

    res.json({
      success: true,
      message: 'Session is now public',
      session: {
        sessionId: session.sessionId,
        title: session.title,
        isPublic: session.isPublic,
        shareLink: session.shareLink
      }
    });

  } catch (error) {
    console.error('❌ Error making session public:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating session',
      error: error.message
    });
  }
});

module.exports = router; 