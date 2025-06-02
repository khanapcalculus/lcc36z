import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getSocket } from '../services/socket';

const WhiteboardContext = createContext();

export const useWhiteboard = () => {
  const context = useContext(WhiteboardContext);
  if (!context) {
    throw new Error('useWhiteboard must be used within a WhiteboardProvider');
  }
  return context;
};

// Export the context directly for components that need it
export { WhiteboardContext };

export const WhiteboardProvider = ({ children }) => {
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [pages, setPages] = useState({ 1: [] });
  const [currentPage, setCurrentPage] = useState(1);
  const [history, setHistory] = useState([{ pages: { 1: [] }, currentPage: 1 }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [palmRejectionEnabled, setPalmRejectionEnabled] = useState(true);

  const socket = useRef(null);
  const userId = useRef(`user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const batchTimeout = useRef(null);
  const pendingUpdates = useRef([]);

  // Batched socket updates for performance
  const emitBatchedUpdates = () => {
    if (pendingUpdates.current.length > 0 && socket.current && socket.current.connected) {
      console.log('WhiteboardContext: Emitting batch of', pendingUpdates.current.length, 'updates');
      socket.current.emit('element-batch-update', {
        updates: pendingUpdates.current,
        userId: userId.current,
        page: currentPage
      });
      pendingUpdates.current = [];
    }
    batchTimeout.current = null;
  };

  const addToBatch = (updateData) => {
    pendingUpdates.current.push(updateData);
    
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
    }
    
    batchTimeout.current = setTimeout(emitBatchedUpdates, 100);
  };

  // Function to force emit batch immediately (for important operations)
  const flushBatch = () => {
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
    }
    emitBatchedUpdates();
  };

  // Manual save function
  const saveToDatabase = async () => {
    try {
      console.log('💾 Manually saving whiteboard to database...');
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/whiteboard/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pages,
          currentPage
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Whiteboard saved to database successfully');
        return true;
      } else {
        console.error('❌ Failed to save whiteboard to database');
        return false;
      }
    } catch (error) {
      console.error('❌ Error saving whiteboard to database:', error);
      return false;
    }
  };

  // Auto-save function (lighter weight)
  const autoSaveToDatabase = async () => {
    try {
      console.log('🔄 Auto-saving whiteboard to database...');
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/whiteboard/auto-save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pages,
          currentPage
        }),
      });
      
      if (response.ok) {
        console.log('✅ Whiteboard auto-saved successfully');
        return true;
      } else {
        console.error('❌ Failed to auto-save whiteboard');
        return false;
      }
    } catch (error) {
      console.error('❌ Error auto-saving whiteboard:', error);
      return false;
    }
  };

  // Load whiteboard from database
  const loadFromDatabase = async () => {
    try {
      console.log('📖 Loading whiteboard from database...');
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/whiteboard`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          console.log('✅ Whiteboard loaded from database successfully');
          setPages(result.data.pages);
          setCurrentPage(result.data.currentPage);
          
          // Initialize history with loaded data
          setHistory([{ pages: result.data.pages, currentPage: result.data.currentPage }]);
          setHistoryIndex(0);
          
          return true;
        }
      } else {
        console.log('⚠️ No saved whiteboard found, starting fresh');
        return false;
      }
    } catch (error) {
      console.error('❌ Error loading whiteboard from database:', error);
      return false;
    }
  };

  // Auto-save functionality
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (Object.keys(pages).length > 0) {
        autoSaveToDatabase();
      }
    }, 30000); // Auto-save every 30 seconds

    return () => {
      clearInterval(autoSaveInterval);
    };
  }, [pages, currentPage]);

  // Load data on component mount
  useEffect(() => {
    loadFromDatabase();
  }, []);

  useEffect(() => {
    console.log('WhiteboardContext: Initializing socket connection...');
    let keepAliveInterval;
    
    try {
      socket.current = getSocket();
      
      if (!socket.current) {
        console.error('WhiteboardContext: Failed to get socket instance');
        return;
      }
      
      console.log('WhiteboardContext: Socket instance created:', socket.current);
      
      socket.current.on('connect', () => {
        console.log('WhiteboardContext: Connected to server with ID:', socket.current.id);
        console.log('WhiteboardContext: Socket connected successfully!');
      });

      socket.current.on('connect_error', (error) => {
        console.error('WhiteboardContext: Socket connection error:', error);
        console.error('WhiteboardContext: Error details:', error.message);
        console.error('WhiteboardContext: Error type:', error.type);
      });

      socket.current.on('disconnect', (reason) => {
        console.log('WhiteboardContext: Socket disconnected:', reason);
      });

      // Handle initial whiteboard state from server
      socket.current.on('whiteboard-state', (data) => {
        console.log('WhiteboardContext: Received whiteboard-state from server:', data);
        // Load from database instead of using server memory
        loadFromDatabase();
      });

      socket.current.on('element-update', (data) => {
        console.log('WhiteboardContext: Received element-update:', data);
        if (data.userId !== userId.current) {
          console.log('WhiteboardContext: Processing element update from another user');
          updateElementsFromSocket(data);
        } else {
          console.log('WhiteboardContext: Ignoring own element update');
        }
      });

      // Handle batched updates
      socket.current.on('element-batch-update', (data) => {
        console.log('WhiteboardContext: Received element-batch-update:', data.updates.length, 'updates');
        if (data.userId !== userId.current) {
          console.log('WhiteboardContext: Processing batched updates from another user');
          data.updates.forEach(update => {
            updateElementsFromSocket(update);
          });
        } else {
          console.log('WhiteboardContext: Ignoring own batched updates');
        }
      });

      socket.current.on('page-change', (data) => {
        console.log('WhiteboardContext: Received page-change:', data);
        if (data.userId !== userId.current) {
          console.log('WhiteboardContext: Processing page change from another user');
          // Only update the pages data, don't force current user to change pages
          setPages(prevPages => {
            const updatedPages = { ...prevPages };
            // Merge the received pages with existing pages
            Object.keys(data.pages).forEach(pageNum => {
              updatedPages[pageNum] = data.pages[pageNum];
            });
            return updatedPages;
          });
        } else {
          console.log('WhiteboardContext: Ignoring own page change');
        }
      });

      // Keep-alive ping for mobile devices
      keepAliveInterval = setInterval(() => {
        if (socket.current && socket.current.connected) {
          socket.current.emit('ping');
        }
      }, 25000); // Ping every 25 seconds

      // Test socket connection with more detailed logging
      setTimeout(() => {
        if (socket.current) {
          console.log('WhiteboardContext: Socket connection test...');
          console.log('WhiteboardContext: Socket exists?', !!socket.current);
          console.log('WhiteboardContext: Socket connected?', socket.current.connected);
          console.log('WhiteboardContext: Socket ID:', socket.current.id);
          console.log('WhiteboardContext: User ID:', userId.current);
          
          if (socket.current.connected) {
            console.log('WhiteboardContext: Socket connection test - ✅ CONNECTED');
          } else {
            console.error('WhiteboardContext: Socket connection test - ❌ NOT CONNECTED');
            console.log('WhiteboardContext: Attempting to reconnect...');
            socket.current.connect();
          }
        } else {
          console.error('WhiteboardContext: Socket instance is null');
        }
      }, 2000);
      
    } catch (error) {
      console.error('WhiteboardContext: Error initializing socket:', error);
    }

    return () => {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
      }
      if (socket.current) {
        console.log('WhiteboardContext: Disconnecting socket...');
        socket.current.disconnect();
      }
    };
  }, []);

  const updateElementsFromSocket = (data) => {
    console.log('WhiteboardContext: updateElementsFromSocket called with:', data);
    
    if (data.type === 'add') {
      setPages(prevPages => {
        const updatedPages = { ...prevPages };
        const targetPage = data.page || currentPage;
        
        if (!updatedPages[targetPage]) {
          updatedPages[targetPage] = [];
        }
        
        // Check if element already exists to avoid duplicates
        const existingElement = updatedPages[targetPage].find(el => el.id === data.element.id);
        if (!existingElement) {
          updatedPages[targetPage] = [...updatedPages[targetPage], data.element];
          console.log('WhiteboardContext: Added element from socket:', data.element.id);
        } else {
          console.log('WhiteboardContext: Element already exists, skipping:', data.element.id);
        }
        
        return updatedPages;
      });
    } else if (data.type === 'update') {
      setPages(prevPages => {
        const updatedPages = { ...prevPages };
        const targetPage = data.page || currentPage;
        
        if (updatedPages[targetPage]) {
          updatedPages[targetPage] = updatedPages[targetPage].map(el => 
            el.id === data.element.id ? data.element : el
          );
          console.log('WhiteboardContext: Updated element from socket:', data.element.id);
        }
        
        return updatedPages;
      });
    } else if (data.type === 'delete') {
      setPages(prevPages => {
        const updatedPages = { ...prevPages };
        const targetPage = data.page || currentPage;
        
        if (updatedPages[targetPage]) {
          updatedPages[targetPage] = updatedPages[targetPage].filter(el => el.id !== data.elementId);
          console.log('WhiteboardContext: Deleted element from socket:', data.elementId);
        }
        
        return updatedPages;
      });
    } else if (data.type === 'clear') {
      setPages(prevPages => {
        const updatedPages = { ...prevPages };
        const targetPage = data.page || currentPage;
        updatedPages[targetPage] = [];
        console.log('WhiteboardContext: Cleared page from socket:', targetPage);
        return updatedPages;
      });
    }
  };

  const addElement = (element) => {
    console.log('WhiteboardContext: addElement called with:', element);
    
    // Generate ID if not provided - do this outside setPages so we can return it
    const newElement = {
      ...element,
      id: element.id || `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    setPages(prevPages => {
      const updatedPages = { ...prevPages };
      
      // Ensure current page exists
      if (!updatedPages[currentPage]) {
        updatedPages[currentPage] = [];
      }
      
      // Add element to current page
      updatedPages[currentPage] = [...updatedPages[currentPage], newElement];
      
      console.log('WhiteboardContext: Element added to page', currentPage, 'total elements:', updatedPages[currentPage].length);
      
      return updatedPages;
    });
    
    // Emit to socket (immediate for add operations)
    if (socket.current && socket.current.connected) {
      const messageData = {
        type: 'add',
        page: currentPage,
        element: newElement,
        userId: userId.current
      };
      
      // Calculate message size
      const messageSize = JSON.stringify(messageData).length;
      const messageSizeKB = Math.round(messageSize / 1024);
      
      console.log('WhiteboardContext: Emitting element-update to socket');
      console.log('WhiteboardContext: Socket connected?', socket.current.connected);
      console.log('WhiteboardContext: Message size:', messageSizeKB, 'KB');
      
      // Warn if message is very large
      if (messageSizeKB > 500) {
        console.warn('⚠️ Large socket message:', messageSizeKB, 'KB - may fail to transmit');
      }
      
      console.log('WhiteboardContext: Emitting data:', {
        type: messageData.type,
        page: messageData.page,
        elementType: messageData.element.type,
        elementId: messageData.element.id,
        messageSize: messageSizeKB + ' KB'
      });
      
      socket.current.emit('element-update', messageData);
      console.log('WhiteboardContext: Element-update emitted successfully');
    } else {
      console.log('WhiteboardContext: Socket not connected - working in offline mode');
    }
    
    // Return the new element with ID
    return newElement;
  };

  const updateElement = (updatedElement) => {
    console.log('WhiteboardContext: updateElement called with:', updatedElement);
    setPages(prevPages => {
      const updatedPages = { ...prevPages };
      const oldElement = updatedPages[currentPage].find(el => el.id === updatedElement.id);
      console.log('WhiteboardContext: updating element from:', oldElement, 'to:', updatedElement);
      
      updatedPages[currentPage] = updatedPages[currentPage].map(el => 
        el.id === updatedElement.id ? updatedElement : el
      );
      
      console.log('WhiteboardContext: updated pages:', updatedPages);
      
      // Add to batch instead of immediate emit
      if (socket.current && socket.current.connected) {
        console.log('WhiteboardContext: Adding element update to batch:', updatedElement.id);
        addToBatch({
          type: 'update',
          page: currentPage,
          element: updatedElement,
          userId: userId.current
        });
      } else {
        console.error('WhiteboardContext: Socket not connected for element update');
      }
      
      return updatedPages;
    });
  };

  // Add to history when an action is complete (like finishing a drawing)
  const saveToHistory = () => {
    const newHistory = [...history.slice(0, historyIndex + 1), {
      pages: { ...pages },
      currentPage
    }];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    console.log('WhiteboardContext: Saved to history, index:', newHistory.length - 1);
  };

  const deleteElement = (elementId) => {
    setPages(prevPages => {
      const updatedPages = { ...prevPages };
      updatedPages[currentPage] = updatedPages[currentPage].filter(el => el.id !== elementId);
      
      // Add to history
      const newHistory = [...history.slice(0, historyIndex + 1), {
        pages: updatedPages,
        currentPage
      }];
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      
      // Emit to socket
      if (socket.current && socket.current.connected) {
        socket.current.emit('element-update', {
          type: 'delete',
          page: currentPage,
          elementId,
          userId: userId.current
        });
      } else {
        console.log('WhiteboardContext: Socket not connected - delete operation saved locally');
      }
      
      return updatedPages;
    });
  };

  const clearPage = () => {
    setPages(prevPages => {
      const updatedPages = { ...prevPages };
      updatedPages[currentPage] = [];
      
      // Add to history
      const newHistory = [...history.slice(0, historyIndex + 1), {
        pages: updatedPages,
        currentPage
      }];
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      
      // Emit to socket
      if (socket.current && socket.current.connected) {
        socket.current.emit('element-update', {
          type: 'clear',
          page: currentPage,
          userId: userId.current
        });
      } else {
        console.log('WhiteboardContext: Socket not connected - clear operation saved locally');
      }
      
      return updatedPages;
    });
  };

  const changePage = (pageNumber) => {
    console.log('WhiteboardContext: changing page from', currentPage, 'to', pageNumber);
    console.log('WhiteboardContext: current page elements before change:', pages[currentPage]);
    console.log('WhiteboardContext: target page elements before change:', pages[pageNumber]);
    
    // Clear selected element when changing pages
    setSelectedElement(null);
    
    if (!pages[pageNumber]) {
      setPages(prevPages => {
        const updatedPages = { ...prevPages, [pageNumber]: [] };
        
        // Emit to socket
        if (socket.current && socket.current.connected) {
          socket.current.emit('page-change', {
            pages: updatedPages,
            userId: userId.current
          });
        } else {
          console.log('WhiteboardContext: Socket not connected - page change saved locally');
        }
        
        return updatedPages;
      });
    }
    
    setCurrentPage(pageNumber);
    
    // Log elements after page change
    setTimeout(() => {
      console.log('WhiteboardContext: elements after page change:', pages[pageNumber]);
    }, 100);
  };

  const undo = () => {
    console.log('WhiteboardContext: undo called, historyIndex:', historyIndex, 'history length:', history.length);
    if (historyIndex > 0) {
      // Clear selected element before undo
      setSelectedElement(null);
      
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const prevState = history[newIndex];
      console.log('WhiteboardContext: undoing to state:', prevState);
      setPages(prevState.pages);
      setCurrentPage(prevState.currentPage);
      
      // Emit to socket
      if (socket.current && socket.current.connected) {
        socket.current.emit('page-change', {
          pages: prevState.pages,
          userId: userId.current
        });
      } else {
        console.log('WhiteboardContext: Socket not connected - undo operation saved locally');
      }
    } else {
      console.log('WhiteboardContext: cannot undo, at beginning of history');
    }
  };

  const redo = () => {
    console.log('WhiteboardContext: redo called, historyIndex:', historyIndex, 'history length:', history.length);
    if (historyIndex < history.length - 1) {
      // Clear selected element before redo
      setSelectedElement(null);
      
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const nextState = history[newIndex];
      console.log('WhiteboardContext: redoing to state:', nextState);
      setPages(nextState.pages);
      setCurrentPage(nextState.currentPage);
      
      // Emit to socket
      if (socket.current && socket.current.connected) {
        socket.current.emit('page-change', {
          pages: nextState.pages,
          userId: userId.current
        });
      } else {
        console.log('WhiteboardContext: Socket not connected - redo operation saved locally');
      }
    } else {
      console.log('WhiteboardContext: cannot redo, at end of history');
    }
  };

  return (
    <WhiteboardContext.Provider
      value={{
        tool,
        setTool,
        color,
        setColor,
        strokeWidth,
        setStrokeWidth,
        elements: pages[currentPage] || [],
        addElement,
        updateElement,
        deleteElement,
        clearPage,
        currentPage,
        changePage,
        pages,
        undo,
        redo,
        saveToHistory,
        saveToDatabase,
        flushBatch,
        isDrawing,
        setIsDrawing,
        selectedElement,
        setSelectedElement,
        scale,
        setScale,
        position,
        setPosition,
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
        palmRejectionEnabled,
        setPalmRejectionEnabled
      }}
    >
      {children}
    </WhiteboardContext.Provider>
  );
};