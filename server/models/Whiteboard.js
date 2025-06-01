const mongoose = require('mongoose');

// Element schema for individual drawing elements
const elementSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, required: true }, // 'line', 'rectangle', 'circle', 'image'
  points: [Number], // For lines and paths
  x: Number, // For shapes and images
  y: Number,
  width: Number, // For rectangles and images
  height: Number,
  radius: Number, // For circles
  stroke: String, // Color
  strokeWidth: Number,
  fill: String,
  lineCap: String,
  lineJoin: String,
  tension: Number,
  globalCompositeOperation: String,
  rotation: { type: Number, default: 0 },
  src: String // For images
}, { _id: false });

// Page schema for individual pages
const pageSchema = new mongoose.Schema({
  pageNumber: { type: Number, required: true },
  elements: [elementSchema]
}, { _id: false });

// Main whiteboard schema
const whiteboardSchema = new mongoose.Schema({
  whiteboardId: { 
    type: String, 
    required: true, 
    unique: true,
    default: 'default-whiteboard' // For now, we'll use a single whiteboard
  },
  pages: [pageSchema],
  currentPage: { type: Number, default: 1 },
  lastModified: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// Update lastModified on save
whiteboardSchema.pre('save', function(next) {
  this.lastModified = new Date();
  next();
});

module.exports = mongoose.model('Whiteboard', whiteboardSchema); 