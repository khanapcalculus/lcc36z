const express = require('express');
const router = express.Router();
const WhiteboardService = require('../services/whiteboardService');

const whiteboardService = new WhiteboardService();

// Get whiteboard data
router.get('/', async (req, res) => {
  try {
    console.log('📖 GET /api/whiteboard - Loading whiteboard data');
    const whiteboard = await whiteboardService.getWhiteboard();
    const clientData = whiteboardService.convertToClientFormat(whiteboard);
    
    res.json({
      success: true,
      data: clientData,
      message: 'Whiteboard loaded successfully'
    });
  } catch (error) {
    console.error('❌ Error loading whiteboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load whiteboard',
      error: error.message
    });
  }
});

// Save whiteboard data
router.post('/save', async (req, res) => {
  try {
    console.log('💾 POST /api/whiteboard/save - Saving whiteboard data');
    const { pages, currentPage } = req.body;
    
    if (!pages) {
      return res.status(400).json({
        success: false,
        message: 'Pages data is required'
      });
    }
    
    const whiteboard = await whiteboardService.saveWhiteboard(pages, currentPage || 1);
    const clientData = whiteboardService.convertToClientFormat(whiteboard);
    
    res.json({
      success: true,
      data: clientData,
      message: 'Whiteboard saved successfully'
    });
  } catch (error) {
    console.error('❌ Error saving whiteboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save whiteboard',
      error: error.message
    });
  }
});

// Auto-save endpoint for periodic saves
router.post('/auto-save', async (req, res) => {
  try {
    console.log('🔄 POST /api/whiteboard/auto-save - Auto-saving whiteboard');
    const { pages, currentPage } = req.body;
    
    if (!pages) {
      return res.status(400).json({
        success: false,
        message: 'Pages data is required'
      });
    }
    
    await whiteboardService.saveWhiteboard(pages, currentPage || 1);
    
    res.json({
      success: true,
      message: 'Whiteboard auto-saved successfully'
    });
  } catch (error) {
    console.error('❌ Error auto-saving whiteboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to auto-save whiteboard',
      error: error.message
    });
  }
});

// Clear whiteboard
router.post('/clear', async (req, res) => {
  try {
    console.log('🧹 POST /api/whiteboard/clear - Clearing whiteboard');
    
    // Reset to initial state
    const whiteboard = await whiteboardService.saveWhiteboard({ 1: [] }, 1);
    const clientData = whiteboardService.convertToClientFormat(whiteboard);
    
    res.json({
      success: true,
      data: clientData,
      message: 'Whiteboard cleared successfully'
    });
  } catch (error) {
    console.error('❌ Error clearing whiteboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear whiteboard',
      error: error.message
    });
  }
});

module.exports = router; 