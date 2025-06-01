const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  // Basic Information
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  fullName: {
    type: String
  },
  
  // Role Management
  role: {
    type: String,
    enum: ['admin', 'teacher', 'student'],
    required: true
  },
  
  // Student-specific fields
  grade: {
    type: String,
    required: function() { return this.role === 'student'; }
  },
  subjects: [{
    type: String
  }],
  studentId: {
    type: String,
    unique: true,
    sparse: true // Only for students
  },
  assignedTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Teacher assigned to this student
  },
  
  // Teacher-specific fields
  teacherId: {
    type: String,
    unique: true,
    sparse: true // Only for teachers
  },
  assignedStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  defaultTimezone: {
    type: String,
    default: 'America/Los_Angeles'
  },
  
  // Profile Information
  avatar: String,
  phone: String,
  dateOfBirth: Date,
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: Date,
  
  // Session Tracking
  totalSessions: {
    type: Number,
    default: 0
  },
  totalSessionTime: {
    type: Number, // in minutes
    default: 0
  },
  
  // Preferences
  preferences: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    sessionReminders: {
      type: Boolean,
      default: true
    },
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    }
  },
  
  // Security
  passwordResetToken: String,
  passwordResetExpires: Date,
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Admin who created this account
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  collection: 'users'
});

// Indexes for better performance
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ studentId: 1 });
UserSchema.index({ teacherId: 1 });
UserSchema.index({ grade: 1, subjects: 1 });
UserSchema.index({ isActive: 1 });

// Virtual for full name
UserSchema.virtual('displayName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save middleware
UserSchema.pre('save', async function(next) {
  // Set full name
  this.fullName = `${this.firstName} ${this.lastName}`;
  
  // Hash password if modified
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Generate student/teacher IDs
UserSchema.pre('save', function(next) {
  try {
    if (this.isNew) {
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      
      if (this.role === 'student' && !this.studentId) {
        this.studentId = `STU${timestamp}${randomStr}`;
      } else if (this.role === 'teacher' && !this.teacherId) {
        this.teacherId = `TCH${timestamp}${randomStr}`;
      }
    }
    next();
  } catch (error) {
    console.error('Error in ID generation middleware:', error);
    // Don't fail the save if ID generation fails
    next();
  }
});

// Instance methods
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

UserSchema.methods.addSessionTime = function(minutes) {
  this.totalSessions += 1;
  this.totalSessionTime += minutes;
  return this.save();
};

UserSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.passwordResetToken;
  delete user.passwordResetExpires;
  delete user.emailVerificationToken;
  delete user.emailVerificationExpires;
  return user;
};

// Static methods
UserSchema.statics.findByRole = function(role) {
  return this.find({ role, isActive: true });
};

UserSchema.statics.findTeacherStudents = function(teacherId) {
  return this.findById(teacherId).populate('assignedStudents');
};

UserSchema.statics.findStudentsByGradeAndSubject = function(grade, subject) {
  return this.find({ 
    role: 'student', 
    grade, 
    subjects: subject,
    isActive: true 
  });
};

UserSchema.statics.getSessionStats = function(userId) {
  return this.findById(userId).select('totalSessions totalSessionTime');
};

module.exports = mongoose.model('User', UserSchema); 