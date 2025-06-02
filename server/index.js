const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const WhiteboardService = require('./services/whiteboardService');

// Import routes
const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');
const userRoutes = require('./routes/users');
const whiteboardRoutes = require('./routes/whiteboard');

const app = express();
const server = http.createServer(app);

// CORS configuration for both development and production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000', 
      'http://localhost:3001',
      'http://192.168.31.158:3000', // Network IP for tablet access
      /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3000$/, // Allow any local network IP on port 3000
      /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:3000$/, // Allow 10.x.x.x network
      /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}:3000$/, // Allow 172.16-31.x.x network
      // Production URLs (will be set via environment variables)
      process.env.CLIENT_URL,
      /^https:\/\/.*\.onrender\.com$/, // Allow any Render.com subdomain
    ].filter(Boolean); // Remove undefined values
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return origin === allowedOrigin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`❌ CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// MongoDB connection with improved error handling
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://khanapcalculus:Thazhath12@cluster0.ipy6r.mongodb.net/lcc360_whiteboard?retryWrites=true&w=majority&appName=Cluster0&authSource=admin';

const connectDB = async () => {
  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    console.log('📡 Using database: lcc360_whiteboard');
    
    const conn = await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 20000, // 20 seconds
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      bufferCommands: false,
      authSource: 'admin', // Specify auth source
      ssl: true, // Ensure SSL is enabled
    });

    console.log('✅ Connected to MongoDB Atlas successfully');
    console.log(`📍 Database: ${conn.connection.name}`);
    console.log(`🌐 Host: ${conn.connection.host}`);
    console.log(`👤 User: khanapcalculus`);
    
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    
    // More specific error handling
    if (error.message.includes('authentication failed')) {
      console.log('🔐 Authentication failed - checking common issues:');
      console.log('   1. Verify user "khanapcalculus" exists in MongoDB Atlas');
      console.log('   2. Check if password "Thazhath12" is correct');
      console.log('   3. Ensure user has "Read and write to any database" permissions');
      console.log('   4. Verify the user is created for the correct cluster');
    } else if (error.message.includes('IP') || error.message.includes('network')) {
      console.log('🌐 Network/IP issue detected:');
      console.log('   1. Add your IP address to MongoDB Atlas Network Access');
      console.log('   2. Or temporarily add 0.0.0.0/0 for development');
      console.log('   3. Check your internet connection');
    } else if (error.message.includes('timeout')) {
      console.log('⏱️  Connection timeout - possible network issue');
      console.log('   1. Check internet connectivity');
      console.log('   2. Verify MongoDB Atlas cluster is running');
    } else {
      console.log('⚠️  Other database connection issue');
      console.log('   Error details:', error.code || 'Unknown');
    }
    
    console.log('💡 The application will continue with demo accounts');
    console.log('   All features work perfectly without database!');
    
    return false;
  }
};

// Handle MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('🔗 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔌 Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('🔒 MongoDB connection closed through app termination');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
});

// Initialize database connection
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/whiteboard', whiteboardRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusText = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting'
  };

  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatusText[dbStatus] || 'Unknown',
      readyState: dbStatus
    },
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version
    }
  });
});

// Socket.IO configuration
const io = socketIo(server, {
  cors: corsOptions
});

// Store active users and their data
const activeUsers = new Map();
const whiteboardService = new WhiteboardService();

io.on('connection', async (socket) => {
  console.log('User connected:', socket.id);
  
  // Generate a unique user ID for this session
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  activeUsers.set(socket.id, { userId, joinedAt: new Date() });

  // Send current whiteboard state from database to new user
  try {
    const whiteboard = await whiteboardService.getWhiteboard();
    const whiteboardState = whiteboardService.convertToClientFormat(whiteboard);
    socket.emit('whiteboard-state', whiteboardState);
  } catch (error) {
    console.error('❌ Error loading whiteboard for new user:', error);
    // Send empty state as fallback
    socket.emit('whiteboard-state', { pages: { 1: [] }, currentPage: 1 });
  }
  
  socket.emit('user-joined', { userId, totalUsers: activeUsers.size });

  // Broadcast to others that a new user joined
  socket.broadcast.emit('user-joined', { userId, totalUsers: activeUsers.size });

  // Handle element updates (individual) - optimized for performance
  socket.on('element-update', async (data) => {
    const page = data.page || 1;
    
    // Broadcast to all other clients immediately for real-time feel
    socket.broadcast.emit('element-update', data);
    
    // Save to database asynchronously (don't block real-time updates)
    setImmediate(async () => {
      try {
        if (data.type === 'add') {
          await whiteboardService.addElement(page, data.element);
        } else if (data.type === 'update') {
          await whiteboardService.updateElement(page, data.element);
        } else if (data.type === 'delete') {
          await whiteboardService.deleteElement(page, data.elementId);
        } else if (data.type === 'clear') {
          await whiteboardService.clearPage(page);
        }
      } catch (error) {
        // Silently handle database errors to not break real-time experience
        console.error('❌ Database save error (non-blocking):', error.message);
      }
    });
  });

  // Handle batch element updates (optimized) - prioritize real-time over database
  socket.on('element-batch-update', async (data) => {
    // Broadcast batch update to all other clients immediately
    socket.broadcast.emit('element-batch-update', data);
    
    // Save batch updates to database asynchronously
    setImmediate(async () => {
      try {
        await whiteboardService.batchUpdate(data.updates);
      } catch (error) {
        // Silently handle database errors to not break real-time experience
        console.error('❌ Batch database save error (non-blocking):', error.message);
      }
    });
  });

  // Handle page changes - no database save needed for page changes
  socket.on('page-change', (data) => {
    // Broadcast page change to all other clients
    socket.broadcast.emit('page-change', data);
  });

  // Handle clear page - optimized
  socket.on('clear-page', async (data) => {
    const page = data.page || 1;
    
    // Broadcast clear to all other clients immediately
    socket.broadcast.emit('clear-page', data);
    
    // Clear page in database asynchronously
    setImmediate(async () => {
      try {
        await whiteboardService.clearPage(page);
      } catch (error) {
        console.error('❌ Clear page database error (non-blocking):', error.message);
      }
    });
  });

  // Handle session-specific events
  socket.on('join-session', (data) => {
    const { sessionId, userId } = data;
    console.log(`User ${userId} joining session: ${sessionId}`);
    
    // Join the session room
    socket.join(`session-${sessionId}`);
    
    // Notify others in the session
    socket.to(`session-${sessionId}`).emit('user-joined-session', {
      userId,
      sessionId,
      timestamp: new Date()
    });
  });

  socket.on('leave-session', (data) => {
    const { sessionId, userId } = data;
    console.log(`User ${userId} leaving session: ${sessionId}`);
    
    // Leave the session room
    socket.leave(`session-${sessionId}`);
    
    // Notify others in the session
    socket.to(`session-${sessionId}`).emit('user-left-session', {
      userId,
      sessionId,
      timestamp: new Date()
    });
  });

  // Handle session-specific whiteboard updates
  socket.on('session-element-update', (data) => {
    const { sessionId } = data;
    console.log(`Session element update for session: ${sessionId}`);
    
    // Broadcast to all users in the session
    socket.to(`session-${sessionId}`).emit('session-element-update', data);
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    activeUsers.delete(socket.id);
    
    // Broadcast updated user count
    socket.broadcast.emit('user-left', { totalUsers: activeUsers.size });
  });
});

const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO enabled with CORS for localhost:3000 and localhost:3001`);
  console.log(`🔐 Authentication routes available at /api/auth`);
  console.log(`📅 Session management routes available at /api/sessions`);
  console.log(`👥 User management routes available at /api/users`);
  console.log(`💾 Whiteboard persistence routes available at /api/whiteboard`);
  console.log(`🏥 Health check available at /api/health`);
});