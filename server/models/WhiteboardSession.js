const mongoose = require('mongoose');

const ElementSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, required: true },
  x: Number,
  y: Number,
  width: Number,
  height: Number,
  radius: Number,
  points: [Number],
  stroke: String,
  strokeWidth: Number,
  fill: String,
  lineCap: String,
  lineJoin: String,
  tension: Number,
  globalCompositeOperation: String,
  rotation: { type: Number, default: 0 },
  src: String // for images
}, { _id: false });

const PageSchema = new mongoose.Schema({
  pageNumber: { type: Number, required: true },
  elements: [ElementSchema],
  createdAt: { type: Date, default: Date.now },
  lastModified: { type: Date, default: Date.now }
}, { _id: false });

const WhiteboardSessionSchema = new mongoose.Schema({
  sessionId: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  studentName: { 
    type: String, 
    required: true,
    trim: true
  },
  studentEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  title: {
    type: String,
    default: 'Untitled Whiteboard'
  },
  pages: [PageSchema],
  currentPage: { 
    type: Number, 
    default: 1 
  },
  totalPages: {
    type: Number,
    default: 1
  },
  // Session metadata
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  lastModified: { 
    type: Date, 
    default: Date.now 
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  },
  // Session status
  isActive: {
    type: Boolean,
    default: true
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  // Statistics
  totalElements: {
    type: Number,
    default: 0
  },
  sessionDuration: {
    type: Number, // in minutes
    default: 0
  },
  // Collaboration info
  collaborators: [{
    userId: String,
    joinedAt: { type: Date, default: Date.now },
    leftAt: Date,
    isActive: { type: Boolean, default: true }
  }],
  // Tags and categories
  tags: [String],
  subject: String,
  grade: String,
  // Export info
  exports: [{
    format: String, // 'pdf', 'png', 'json'
    exportedAt: { type: Date, default: Date.now },
    fileSize: Number
  }]
}, {
  timestamps: true,
  collection: 'whiteboard_sessions'
});

// Indexes for better performance
WhiteboardSessionSchema.index({ studentName: 1, createdAt: -1 });
WhiteboardSessionSchema.index({ sessionId: 1 });
WhiteboardSessionSchema.index({ createdAt: -1 });
WhiteboardSessionSchema.index({ isActive: 1 });
WhiteboardSessionSchema.index({ studentEmail: 1 });

// Virtual for session duration in human readable format
WhiteboardSessionSchema.virtual('sessionDurationFormatted').get(function() {
  const minutes = this.sessionDuration;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
});

// Method to update last accessed time
WhiteboardSessionSchema.methods.updateLastAccessed = function() {
  this.lastAccessedAt = new Date();
  return this.save();
};

// Method to calculate total elements
WhiteboardSessionSchema.methods.calculateTotalElements = function() {
  let total = 0;
  this.pages.forEach(page => {
    total += page.elements.length;
  });
  this.totalElements = total;
  return total;
};

// Method to mark session as completed
WhiteboardSessionSchema.methods.completeSession = function() {
  this.isCompleted = true;
  this.isActive = false;
  const now = new Date();
  const duration = Math.round((now - this.createdAt) / (1000 * 60)); // in minutes
  this.sessionDuration = duration;
  this.lastModified = now;
  return this.save();
};

// Static method to find sessions by student
WhiteboardSessionSchema.statics.findByStudent = function(studentName, limit = 10) {
  return this.find({ studentName: new RegExp(studentName, 'i') })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get recent sessions
WhiteboardSessionSchema.statics.getRecentSessions = function(limit = 20) {
  return this.find({ isActive: true })
    .sort({ lastAccessedAt: -1 })
    .limit(limit)
    .select('sessionId studentName title createdAt lastAccessedAt totalElements');
};

// Pre-save middleware to update timestamps and calculate totals
WhiteboardSessionSchema.pre('save', function(next) {
  this.lastModified = new Date();
  this.totalPages = this.pages.length || 1;
  this.calculateTotalElements();
  next();
});

module.exports = mongoose.model('WhiteboardSession', WhiteboardSessionSchema); 