const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  // Basic session info
  sessionId: {
    type: String,
    unique: true,
    required: true,
    default: () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  // Scheduling
  scheduledDate: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // Duration in minutes
    required: true,
    min: 5,
    max: 480 // Max 8 hours
  },
  timezone: {
    type: String,
    required: true,
    default: 'America/Los_Angeles'
  },
  
  // Participants
  teacher: {
    type: mongoose.Schema.Types.Mixed, // Allow both ObjectId and String for demo accounts
    required: true
  },
  students: [{
    type: mongoose.Schema.Types.Mixed // Allow both ObjectId and String for demo accounts
  }],
  maxParticipants: {
    type: Number,
    default: 30,
    min: 1,
    max: 100
  },
  
  // Session settings
  subject: {
    type: String,
    required: true,
    enum: ['Mathematics', 'Science', 'English', 'History', 'Geography', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Art', 'Music', 'Other']
  },
  grade: {
    type: String,
    required: true
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: function() { return this.isRecurring; }
  },
  recurringEndDate: {
    type: Date,
    required: function() { return this.isRecurring; }
  },
  
  // Access control
  shareLink: {
    type: String,
    unique: true,
    default: () => `link_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  requiresApproval: {
    type: Boolean,
    default: false
  },
  password: {
    type: String,
    trim: true
  },
  
  // Session status
  status: {
    type: String,
    enum: ['scheduled', 'active', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  actualStartTime: Date,
  actualEndTime: Date,
  
  // Whiteboard data
  whiteboardData: {
    pages: {
      type: Map,
      of: [mongoose.Schema.Types.Mixed],
      default: () => new Map([['1', []]])
    },
    currentPage: {
      type: Number,
      default: 1
    },
    totalPages: {
      type: Number,
      default: 1
    }
  },
  
  // Analytics and tracking
  analytics: {
    totalParticipants: {
      type: Number,
      default: 0
    },
    peakParticipants: {
      type: Number,
      default: 0
    },
    totalDrawingActions: {
      type: Number,
      default: 0
    },
    averageEngagementTime: {
      type: Number,
      default: 0
    },
    participantJoinTimes: [{
      userId: {
        type: mongoose.Schema.Types.Mixed // Allow both ObjectId and String for demo accounts
      },
      joinTime: Date,
      leaveTime: Date,
      totalTime: Number // in minutes
    }]
  },
  
  // Email notifications
  emailSettings: {
    sendReminders: {
      type: Boolean,
      default: true
    },
    reminderTimes: [{
      type: Number, // minutes before session
      default: [60, 15] // 1 hour and 15 minutes before
    }],
    emailsSent: [{
      type: {
        type: String,
        enum: ['invitation', 'reminder', 'cancellation', 'update']
      },
      sentAt: Date,
      recipients: [String] // email addresses
    }]
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.Mixed, // Allow both ObjectId and String for demo accounts
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.Mixed // Allow both ObjectId and String for demo accounts
  },
  tags: [String],
  notes: {
    type: String,
    maxlength: 2000
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
sessionSchema.index({ teacher: 1, scheduledDate: 1 });
sessionSchema.index({ shareLink: 1 });
sessionSchema.index({ status: 1, scheduledDate: 1 });
sessionSchema.index({ 'students': 1, scheduledDate: 1 });
sessionSchema.index({ subject: 1, grade: 1 });

// Virtual for session URL
sessionSchema.virtual('sessionUrl').get(function() {
  return `${process.env.CLIENT_URL || 'http://localhost:3001'}/join/${this.shareLink}`;
});

// Virtual for formatted duration
sessionSchema.virtual('formattedDuration').get(function() {
  const hours = Math.floor(this.duration / 60);
  const minutes = this.duration % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
});

// Virtual for session time remaining
sessionSchema.virtual('timeUntilSession').get(function() {
  const now = new Date();
  const sessionTime = new Date(this.scheduledDate);
  const diffMs = sessionTime - now;
  
  if (diffMs < 0) return 'Session has passed';
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours > 24) {
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day(s)`;
  } else if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}m`;
  } else {
    return `${diffMinutes}m`;
  }
});

// Methods
sessionSchema.methods.addParticipant = function(userId, joinTime = new Date()) {
  const existingParticipant = this.analytics.participantJoinTimes.find(
    p => p.userId.toString() === userId.toString()
  );
  
  if (!existingParticipant) {
    this.analytics.participantJoinTimes.push({
      userId,
      joinTime,
      totalTime: 0
    });
    this.analytics.totalParticipants += 1;
  }
  
  // Update peak participants
  const currentActive = this.analytics.participantJoinTimes.filter(
    p => p.joinTime && !p.leaveTime
  ).length;
  
  if (currentActive > this.analytics.peakParticipants) {
    this.analytics.peakParticipants = currentActive;
  }
  
  return this.save();
};

sessionSchema.methods.removeParticipant = function(userId, leaveTime = new Date()) {
  const participant = this.analytics.participantJoinTimes.find(
    p => p.userId.toString() === userId.toString() && !p.leaveTime
  );
  
  if (participant) {
    participant.leaveTime = leaveTime;
    participant.totalTime = Math.round((leaveTime - participant.joinTime) / (1000 * 60)); // minutes
  }
  
  return this.save();
};

sessionSchema.methods.updateWhiteboardData = function(pages, currentPage) {
  this.whiteboardData.pages = new Map(Object.entries(pages));
  this.whiteboardData.currentPage = currentPage;
  this.whiteboardData.totalPages = Object.keys(pages).length;
  this.analytics.totalDrawingActions += 1;
  
  return this.save();
};

sessionSchema.methods.canUserJoin = function(userId) {
  // Check if session is active or scheduled
  if (!['scheduled', 'active'].includes(this.status)) {
    return { canJoin: false, reason: 'Session is not available' };
  }
  
  // Check if user is the teacher
  if (this.teacher.toString() === userId.toString()) {
    return { canJoin: true, role: 'teacher' };
  }
  
  // Check if user is in students list
  if (this.students.some(studentId => studentId.toString() === userId.toString())) {
    return { canJoin: true, role: 'student' };
  }
  
  // Check if session is public
  if (this.isPublic) {
    return { canJoin: true, role: 'guest' };
  }
  
  return { canJoin: false, reason: 'You are not authorized to join this session' };
};

// Static methods
sessionSchema.statics.findUpcomingSessions = function(userId, role = 'student') {
  const now = new Date();
  const query = {
    scheduledDate: { $gte: now },
    status: { $in: ['scheduled', 'active'] }
  };
  
  if (role === 'teacher') {
    query.teacher = userId;
  } else if (role === 'student') {
    query.students = userId;
  }
  
  return this.find(query)
    .populate('teacher', 'firstName lastName email')
    .populate('students', 'firstName lastName email')
    .sort({ scheduledDate: 1 });
};

sessionSchema.statics.findSessionByShareLink = function(shareLink) {
  return this.findOne({ shareLink })
    .populate('teacher', 'firstName lastName email')
    .populate('students', 'firstName lastName email');
};

// Pre-save middleware
sessionSchema.pre('save', function(next) {
  if (this.isModified('scheduledDate') || this.isModified('duration')) {
    // Validate that session doesn't conflict with existing sessions for the teacher
    const sessionStart = new Date(this.scheduledDate);
    const sessionEnd = new Date(sessionStart.getTime() + (this.duration * 60 * 1000));
    
    // This validation would need to be implemented based on business rules
  }
  
  next();
});

module.exports = mongoose.model('Session', sessionSchema); 