import React, { useContext, useEffect, useRef, useState } from 'react';
import { Circle, Image, Layer, Line, Rect, Stage, Transformer } from 'react-konva';
import { WhiteboardContext } from '../../context/WhiteboardContext';
import CircleTool from '../../tools/CircleTool';
import EraserTool from '../../tools/EraserTool';
import ImageTool from '../../tools/ImageTool';
import LineTool from '../../tools/LineTool';
import PanTool from '../../tools/PanTool';
import PenTool from '../../tools/PenTool';
import RectangleTool from '../../tools/RectangleTool';
import TransformTool from '../../tools/TransformTool';
import './Canvas.css';

const Canvas = () => {
  const context = useContext(WhiteboardContext);
  const {
    tool,
    selectedElement,
    setSelectedElement,
    updateElement,
    scale,
    position,
    palmRejectionEnabled,
    pages,
    currentPage
  } = context;
  
  const stageRef = useRef(null);
  const layerRef = useRef(null);
  const transformerRef = useRef(null);
  
  // Image cache for proper loading
  const [imageCache, setImageCache] = useState(new Map());
  
  const toolInstances = useRef({
    pen: null,
    eraser: null,
    rectangle: null,
    circle: null,
    line: null,
    transform: null,
    pan: null,
    image: null
  });
  
  // Palm rejection state
  const [activeTouches, setActiveTouches] = useState(new Map());
  const [rejectedTouches, setRejectedTouches] = useState(new Set());
  
  // Very strict palm rejection settings
  const PALM_REJECTION_CONFIG = {
    maxTouchRadius: 8,           // Maximum touch radius for stylus (very strict)
    maxTouchForce: 0.3,          // Maximum force for stylus (very strict)
    minStylusForce: 0.1,         // Minimum force to be considered stylus
    maxSimultaneousTouches: 1,   // Only allow 1 touch at a time (very strict)
    touchTimeoutMs: 100,         // Time to wait before accepting touch
    palmSizeThreshold: 15,       // Touches larger than this are likely palm
    velocityThreshold: 500,      // Fast movements are likely intentional
    edgeMargin: 50              // Ignore touches near screen edges
  };
  
  // Function to load and cache images
  const loadImage = (src) => {
    return new Promise((resolve, reject) => {
      // Check if image is already cached
      if (imageCache.has(src)) {
        resolve(imageCache.get(src));
        return;
      }

      const img = new window.Image();
      img.crossOrigin = 'anonymous'; // Handle CORS if needed
      
      img.onload = () => {
        console.log('✅ Image loaded successfully:', src.substring(0, 50) + '...');
        setImageCache(prev => {
          const newCache = new Map(prev.set(src, img));
          // Force a re-render by updating the cache state
          return newCache;
        });
        resolve(img);
      };
      
      img.onerror = (error) => {
        console.error('❌ Failed to load image:', error);
        reject(error);
      };
      
      img.src = src;
    });
  };

  // Preload images when elements change
  useEffect(() => {
    const currentPageElements = pages[currentPage] || [];
    const imageElements = currentPageElements.filter(el => el.type === 'image');
    
    imageElements.forEach(element => {
      if (element.src && !imageCache.has(element.src)) {
        console.log('🔄 Preloading image for element:', element.id);
        loadImage(element.src).catch(error => {
          console.error('Failed to preload image:', error);
        });
      }
    });
  }, [pages, currentPage, imageCache]);
  
  // Test direct event listeners
  useEffect(() => {
    console.log('Canvas component mounted, stageRef:', stageRef.current);
    
    // Check Stage after a short delay to ensure it's mounted
    setTimeout(() => {
      if (stageRef.current) {
        const stage = stageRef.current;
        const container = stage.container();
        console.log('Stage container:', container);
        console.log('Stage size:', stage.width(), 'x', stage.height());
        console.log('Container style:', container.style.cssText);
        console.log('Container position:', container.getBoundingClientRect());
      }
    }, 1000);
  }, []);
  
  // Initialize tools
  useEffect(() => {
    console.log('Initializing tools with context:', context);
    if (context && Object.keys(context).length > 0 && !toolInstances.current.pen) {
      console.log('Context is valid, creating tool instances...');
      toolInstances.current = {
        pen: new PenTool(context),
        eraser: new EraserTool(context),
        rectangle: new RectangleTool(context),
        circle: new CircleTool(context),
        line: new LineTool(context),
        transform: new TransformTool(context),
        pan: new PanTool(context),
        image: new ImageTool(context)
      };
      console.log('Tool instances created:', Object.keys(toolInstances.current));
    } else if (toolInstances.current.pen) {
      console.log('Tools already exist, updating context references...');
      // Update context references without recreating tools
      Object.values(toolInstances.current).forEach(tool => {
        if (tool && tool.context) {
          tool.context = context;
        }
      });
    } else {
      console.log('Context is not ready yet:', context);
    }
  }, [context]);
  
  // Handle transformer
  useEffect(() => {
    if (selectedElement && transformerRef.current) {
      // Check if the selected element exists on the current page
      const currentPageElements = pages[currentPage] || [];
      const elementExistsOnCurrentPage = currentPageElements.find(el => el.id === selectedElement.id);
      
      if (!elementExistsOnCurrentPage) {
        console.log('Selected element not found on current page, clearing selection');
        setSelectedElement(null);
        return;
      }
      
      const node = layerRef.current.findOne(`#${selectedElement.id}`);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer().batchDraw();
      } else {
        console.log('Node not found for selected element, clearing selection');
        setSelectedElement(null);
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [selectedElement, pages, currentPage, setSelectedElement]);
  
  // Palm rejection: Analyze touch characteristics
  const analyzeTouchForPalmRejection = (touch, event) => {
    const config = PALM_REJECTION_CONFIG;
    const stage = stageRef.current;
    if (!stage) return false;

    // Get touch properties
    const touchRadius = touch.radiusX || touch.radius || 0;
    const touchForce = touch.force || 0;
    const touchType = touch.touchType || 'direct';
    
    // Get screen dimensions
    const stageBox = stage.container().getBoundingClientRect();
    const touchX = touch.clientX - stageBox.left;
    const touchY = touch.clientY - stageBox.top;
    
    console.log('Palm rejection analysis:', {
      touchRadius,
      touchForce,
      touchType,
      touchX,
      touchY,
      activeTouchCount: activeTouches.size
    });

    // Rule 1: Reject if too many simultaneous touches (very strict)
    if (activeTouches.size >= config.maxSimultaneousTouches) {
      console.log('❌ Palm rejection: Too many simultaneous touches');
      return true;
    }

    // Rule 2: Reject large touch areas (likely palm)
    if (touchRadius > config.maxTouchRadius) {
      console.log('❌ Palm rejection: Touch radius too large:', touchRadius);
      return true;
    }

    // Rule 3: Reject high force touches (likely palm)
    if (touchForce > config.maxTouchForce && touchForce > 0) {
      console.log('❌ Palm rejection: Touch force too high:', touchForce);
      return true;
    }

    // Rule 4: Accept stylus with proper force
    if (touchType === 'stylus' && touchForce >= config.minStylusForce) {
      console.log('✅ Palm rejection: Stylus detected with proper force');
      return false;
    }

    // Rule 5: Reject touches near screen edges (likely palm)
    if (touchX < config.edgeMargin || 
        touchY < config.edgeMargin || 
        touchX > stageBox.width - config.edgeMargin || 
        touchY > stageBox.height - config.edgeMargin) {
      console.log('❌ Palm rejection: Touch near screen edge');
      return true;
    }

    // Rule 6: Reject very large touch areas
    if (touchRadius > config.palmSizeThreshold) {
      console.log('❌ Palm rejection: Touch area too large (palm size)');
      return true;
    }

    // Rule 7: Check for rapid successive touches (likely palm)
    const now = Date.now();
    const recentTouches = Array.from(activeTouches.values()).filter(
      t => now - t.startTime < 200
    );
    if (recentTouches.length > 2) {
      console.log('❌ Palm rejection: Too many rapid touches');
      return true;
    }

    console.log('✅ Palm rejection: Touch accepted');
    return false;
  };

  // Enhanced touch start handler with palm rejection
  const handleTouchStart = (e) => {
    e.evt.preventDefault();
    
    const touches = e.evt.changedTouches;
    const now = Date.now();
    
    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      const touchId = touch.identifier;
      
      // Only apply palm rejection if enabled
      if (palmRejectionEnabled) {
        // Analyze touch for palm rejection
        const shouldReject = analyzeTouchForPalmRejection(touch, e.evt);
        
        if (shouldReject) {
          rejectedTouches.add(touchId);
          console.log('🚫 Touch rejected by palm rejection:', touchId);
          continue;
        }
      }
      
      // Accept the touch
      setActiveTouches(prev => new Map(prev.set(touchId, {
        startTime: now,
        startX: touch.clientX,
        startY: touch.clientY,
        touch: touch
      })));
      
      console.log('✅ Touch accepted:', touchId, palmRejectionEnabled ? '(palm rejection enabled)' : '(palm rejection disabled)');
      
      // Convert to mouse event for existing tools
      const mouseEvent = {
        ...e,
        evt: {
          ...e.evt,
          clientX: touch.clientX,
          clientY: touch.clientY,
          preventDefault: () => e.evt.preventDefault()
        }
      };
      
      handleMouseDown(mouseEvent);
    }
  };

  // Enhanced touch move handler
  const handleTouchMove = (e) => {
    e.evt.preventDefault();
    
    const touches = e.evt.changedTouches;
    
    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      const touchId = touch.identifier;
      
      // Skip rejected touches (only if palm rejection is enabled)
      if (palmRejectionEnabled && rejectedTouches.has(touchId)) {
        continue;
      }
      
      // Skip if touch not in active touches
      if (!activeTouches.has(touchId)) {
        continue;
      }
      
      // Convert to mouse event for existing tools
      const mouseEvent = {
        ...e,
        evt: {
          ...e.evt,
          clientX: touch.clientX,
          clientY: touch.clientY,
          preventDefault: () => e.evt.preventDefault()
        }
      };
      
      handleMouseMove(mouseEvent);
    }
  };

  // Enhanced touch end handler
  const handleTouchEnd = (e) => {
    e.evt.preventDefault();
    
    const touches = e.evt.changedTouches;
    
    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      const touchId = touch.identifier;
      
      // Clean up touch tracking
      setActiveTouches(prev => {
        const newMap = new Map(prev);
        newMap.delete(touchId);
        return newMap;
      });
      
      setRejectedTouches(prev => {
        const newSet = new Set(prev);
        newSet.delete(touchId);
        return newSet;
      });
      
      // Skip rejected touches (only if palm rejection was enabled)
      if (palmRejectionEnabled && rejectedTouches.has(touchId)) {
        continue;
      }
      
      // Convert to mouse event for existing tools
      const mouseEvent = {
        ...e,
        evt: {
          ...e.evt,
          clientX: touch.clientX,
          clientY: touch.clientY,
          preventDefault: () => e.evt.preventDefault()
        }
      };
      
      handleMouseUp(mouseEvent);
    }
  };

  const handleMouseDown = (e) => {
    console.log('Canvas handleMouseDown triggered!');
    console.log('Mouse down - current tool:', tool, 'toolInstances:', toolInstances.current);
    console.log('Event target:', e.target, 'Stage:', e.target.getStage());
    
    // Don't prevent default for transform tool interactions
    if (tool !== 'transform') {
      e.evt.preventDefault();
    }
    
    try {
      const currentTool = toolInstances.current[tool];
      if (currentTool) {
        console.log('Calling onMouseDown for tool:', tool);
        currentTool.onMouseDown(e);
      } else {
        console.log('No tool instance found for:', tool);
        console.log('Available tools:', Object.keys(toolInstances.current));
      }
    } catch (error) {
      console.error('Error in handleMouseDown:', error);
    }
  };
  
  const handleMouseMove = (e) => {
    try {
      const currentTool = toolInstances.current[tool];
      if (currentTool) {
        currentTool.onMouseMove(e);
      }
    } catch (error) {
      console.error('Error in handleMouseMove:', error);
    }
  };
  
  const handleMouseUp = (e) => {
    console.log('Canvas handleMouseUp triggered!');
    
    // Don't prevent default for transform tool interactions
    if (tool !== 'transform') {
      e.evt.preventDefault();
    }
    
    try {
      const currentTool = toolInstances.current[tool];
      if (currentTool) {
        console.log('Calling onMouseUp for tool:', tool);
        currentTool.onMouseUp(e);
      }
    } catch (error) {
      console.error('Error in handleMouseUp:', error);
    }
  };
  
  const handleWheel = (e) => {
    if (tool === 'pan') {
      const panTool = toolInstances.current.pan;
      if (panTool) {
        panTool.onWheel(e);
      }
    }
  };
  
  const handleTransformEnd = (e) => {
    console.log('Canvas handleTransformEnd called');
    const transformTool = toolInstances.current.transform;
    if (transformTool) {
      transformTool.onTransformEnd(e);
    }
  };
  
  const handleElementClick = (element) => {
    console.log('Element clicked:', element, 'current tool:', tool);
    if (tool === 'transform') {
      setSelectedElement(element);
    }
  };
  
  const renderElement = (element) => {
    console.log('Canvas: rendering element:', element.type, 'with dimensions:', 
               element.type === 'rectangle' ? `${element.width}x${element.height}` :
               element.type === 'circle' ? `radius: ${element.radius}` :
               element.type === 'line' ? `points: ${element.points}` :
               element.type === 'image' ? `${element.width}x${element.height} src: ${element.src?.substring(0, 30)}...` : 'unknown');
    
    switch (element.type) {
      case 'line':
        return (
          <Line
            key={element.id}
            id={element.id}
            points={element.points}
            stroke={element.stroke}
            strokeWidth={element.strokeWidth}
            lineCap={element.lineCap}
            lineJoin={element.lineJoin}
            tension={element.tension}
            globalCompositeOperation={element.globalCompositeOperation}
            rotation={element.rotation || 0}
            onClick={() => handleElementClick(element)}
          />
        );
      case 'rectangle':
        return (
          <Rect
            key={element.id}
            id={element.id}
            x={element.x}
            y={element.y}
            width={element.width}
            height={element.height}
            stroke={element.stroke}
            strokeWidth={element.strokeWidth}
            fill={element.fill}
            rotation={element.rotation || 0}
            onClick={() => handleElementClick(element)}
            draggable={tool === 'transform' && selectedElement?.id === element.id}
            onDragEnd={(e) => {
              if (tool === 'transform') {
                const updatedElement = {
                  ...element,
                  x: e.target.x(),
                  y: e.target.y()
                };
                updateElement(updatedElement);
                if (context.saveToHistory) {
                  context.saveToHistory();
                }
              }
            }}
          />
        );
      case 'circle':
        return (
          <Circle
            key={element.id}
            id={element.id}
            x={element.x}
            y={element.y}
            radius={element.radius}
            stroke={element.stroke}
            strokeWidth={element.strokeWidth}
            fill={element.fill}
            rotation={element.rotation || 0}
            onClick={() => handleElementClick(element)}
            draggable={tool === 'transform' && selectedElement?.id === element.id}
            onDragEnd={(e) => {
              if (tool === 'transform') {
                const updatedElement = {
                  ...element,
                  x: e.target.x(),
                  y: e.target.y()
                };
                updateElement(updatedElement);
                if (context.saveToHistory) {
                  context.saveToHistory();
                }
              }
            }}
          />
        );
      case 'image':
        // Get cached image or return null if not loaded yet
        const cachedImage = imageCache.get(element.src);
        if (!cachedImage) {
          console.log('⏳ Image not loaded yet, skipping render for:', element.id);
          // Trigger loading if not already in progress
          loadImage(element.src).catch(error => {
            console.error('Failed to load image during render:', error);
          });
          return null;
        }
        
        console.log('✅ Rendering cached image for element:', element.id);
        return (
          <Image
            key={element.id}
            id={element.id}
            x={element.x}
            y={element.y}
            width={element.width}
            height={element.height}
            rotation={element.rotation || 0}
            image={cachedImage}
            onClick={() => handleElementClick(element)}
            draggable={tool === 'transform' && selectedElement?.id === element.id}
            onDragEnd={(e) => {
              if (tool === 'transform') {
                const updatedElement = {
                  ...element,
                  x: e.target.x(),
                  y: e.target.y()
                };
                updateElement(updatedElement);
                if (context.saveToHistory) {
                  context.saveToHistory();
                }
              }
            }}
          />
        );
      default:
        console.log('⚠️ Unknown element type:', element.type);
        return null;
    }
  };
  
  return (
    <div className="canvas-container">
      <Stage
        width={window.innerWidth}
        height={window.innerHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        ref={stageRef}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        draggable={false}
        listening={true}
        preventDefault={false}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          touchAction: 'none', // Disable browser touch handling
          userSelect: 'none',  // Prevent text selection
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none'
        }}
      >
        <Layer 
          ref={layerRef}
          listening={true}
        >
          {(pages[currentPage] || []).map(renderElement)}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
              return newBox;
            }}
            onTransformEnd={handleTransformEnd}
            enabledAnchors={[
              'top-left', 'top-center', 'top-right',
              'middle-right', 'middle-left',
              'bottom-left', 'bottom-center', 'bottom-right'
            ]}
            rotateEnabled={true}
            borderEnabled={true}
            anchorSize={8}
            anchorStroke="#666"
            anchorFill="#fff"
            anchorCornerRadius={2}
          />
        </Layer>
      </Stage>
    </div>
  );
};

export default Canvas;