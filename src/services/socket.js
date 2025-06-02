import { io } from 'socket.io-client';

let socket;

export const initSocket = () => {
  // Get the backend URL for Socket.IO connection
  const getSocketUrl = () => {
    if (process.env.NODE_ENV === 'production') {
      // In production, use the backend URL from environment variable
      const apiUrl = process.env.REACT_APP_API_URL || 'https://lcc360-whiteboard-backend.onrender.com';
      // Remove '/api' from the end if present to get the base backend URL
      return apiUrl.replace('/api', '');
    } else {
      // In development, use local backend
      return 'http://localhost:5001';
    }
  };

  const serverUrl = getSocketUrl();
    
  console.log('Initializing socket connection to:', serverUrl);
    
  socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    timeout: 20000,
    forceNew: false,
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    maxReconnectionAttempts: 5,
    randomizationFactor: 0.5,
    upgrade: true,
    rememberUpgrade: true
  });
  
  socket.on('connect', () => {
    console.log('✅ Socket connected successfully:', socket.id);
  });
  
  socket.on('connect_error', (error) => {
    console.warn('⚠️ Socket connection error (backend may not be deployed yet):', error.message);
    console.log('💡 Frontend will work in offline mode until backend is available');
  });
  
  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason);
    if (reason === 'io server disconnect') {
      // Server disconnected, try to reconnect
      socket.connect();
    }
  });
  
  socket.on('reconnect', (attemptNumber) => {
    console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
  });
  
  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log('🔄 Reconnection attempt:', attemptNumber, '(backend may not be deployed yet)');
  });
  
  socket.on('reconnect_error', (error) => {
    console.warn('⚠️ Reconnection error:', error.message);
  });
  
  socket.on('reconnect_failed', () => {
    console.warn('⚠️ Failed to reconnect after maximum attempts - working in offline mode');
  });
  
  return socket;
};

export const getSocket = () => {
  if (!socket || socket.disconnected) {
    console.log('No existing socket or socket disconnected, creating new one...');
    return initSocket();
  }
  console.log('Returning existing socket:', socket.id);
  return socket;
};