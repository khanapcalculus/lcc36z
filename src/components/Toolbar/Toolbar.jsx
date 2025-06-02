import React, { useContext, useEffect, useRef, useState } from 'react';
import { WhiteboardContext } from '../../context/WhiteboardContext';
import ImageTool from '../../tools/ImageTool';
import ColorPalette from '../ColorPalette/ColorPalette.jsx';
import StrokePalette from '../StrokePalette/StrokePalette.jsx';
import './Toolbar.css';

const Toolbar = () => {
  const context = useContext(WhiteboardContext);
  const { 
    tool, 
    setTool, 
    clearPage, 
    undo, 
    redo, 
    canUndo, 
    canRedo,
    saveToDatabase,
    palmRejectionEnabled,
    setPalmRejectionEnabled
  } = context;
  
  const fileInputRef = useRef(null);
  const toolInstances = useRef({});
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageStatus, setImageStatus] = useState('');
  
  useEffect(() => {
    toolInstances.current = {
      image: new ImageTool(context)
    };
  }, [context]);
  
  const handleImageUpload = () => {
    fileInputRef.current.click();
  };
  
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setIsProcessingImage(true);
      setImageStatus('Processing image...');
      
      try {
        const imageToolInstance = toolInstances.current.image;
        if (imageToolInstance) {
          // Check file size and show appropriate message
          const fileSizeMB = Math.round(file.size / (1024 * 1024) * 10) / 10;
          
          if (fileSizeMB > 2) {
            setImageStatus(`Compressing large image (${fileSizeMB} MB)...`);
          }
          
          await imageToolInstance.uploadImage(file);
          setImageStatus('Image added successfully!');
          
          // Clear status after 2 seconds
          setTimeout(() => {
            setImageStatus('');
            setIsProcessingImage(false);
          }, 2000);
        }
      } catch (error) {
        console.error('Error uploading image:', error);
        setImageStatus('Failed to upload image');
        setTimeout(() => {
          setImageStatus('');
          setIsProcessingImage(false);
        }, 3000);
      }
      
      // Reset file input
      e.target.value = null;
    }
  };
  
  return (
    <div className="toolbar">
      <div className="tool-group">
        <button 
          className={`tool-button ${tool === 'pen' ? 'active' : ''}`}
          onClick={() => {
            console.log('Toolbar: Setting tool to pen');
            setTool('pen');
          }}
          title="Pen"
        >
          <i className="fas fa-pen"></i>
        </button>
        
        <button 
          className={`tool-button ${tool === 'eraser' ? 'active' : ''}`}
          onClick={() => {
            console.log('Toolbar: Setting tool to eraser');
            setTool('eraser');
          }}
          title="Eraser"
        >
          <i className="fas fa-eraser"></i>
        </button>
        
        <button 
          className={`tool-button ${tool === 'rectangle' ? 'active' : ''}`}
          onClick={() => {
            console.log('Toolbar: Setting tool to rectangle');
            setTool('rectangle');
          }}
          title="Rectangle"
        >
          <i className="fas fa-square"></i>
        </button>
        
        <button 
          className={`tool-button ${tool === 'circle' ? 'active' : ''}`}
          onClick={() => setTool('circle')}
          title="Circle"
        >
          <i className="fas fa-circle"></i>
        </button>
        
        <button 
          className={`tool-button ${tool === 'line' ? 'active' : ''}`}
          onClick={() => setTool('line')}
          title="Line"
        >
          <i className="fas fa-slash"></i>
        </button>
        
        <button 
          className={`tool-button ${tool === 'transform' ? 'active' : ''}`}
          onClick={() => setTool('transform')}
          title="Transform"
        >
          <i className="fas fa-arrows-alt"></i>
        </button>
        
        <button 
          className={`tool-button ${tool === 'pan' ? 'active' : ''}`}
          onClick={() => setTool('pan')}
          title="Pan"
        >
          <i className="fas fa-hand-paper"></i>
        </button>
        
        <button 
          className="tool-button"
          onClick={handleImageUpload}
          title="Upload Image"
          disabled={isProcessingImage}
        >
          <i className={`fas ${isProcessingImage ? 'fa-spinner fa-spin' : 'fa-image'}`}></i>
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*" 
          onChange={handleFileChange} 
        />
        
        {/* Image processing status */}
        {imageStatus && (
          <div className="image-status">
            {imageStatus}
          </div>
        )}
      </div>
      
      <div className="tool-group">
        <ColorPalette />
        <StrokePalette />
      </div>
      
      <div className="tool-group">
        <button 
          className="tool-button"
          onClick={undo}
          disabled={!canUndo}
          title="Undo"
        >
          <i className="fas fa-undo"></i>
        </button>
        
        <button 
          className="tool-button"
          onClick={redo}
          disabled={!canRedo}
          title="Redo"
        >
          <i className="fas fa-redo"></i>
        </button>
        
        <button 
          className="tool-button"
          onClick={clearPage}
          title="Clear Page"
        >
          <i className="fas fa-trash"></i>
        </button>
        
        <button 
          className="tool-button"
          onClick={saveToDatabase}
          title="Save to Database"
        >
          <i className="fas fa-save"></i>
        </button>
        
        <button 
          className={`tool-button ${palmRejectionEnabled ? 'active' : ''}`}
          onClick={() => setPalmRejectionEnabled(!palmRejectionEnabled)}
          title={`Palm Rejection: ${palmRejectionEnabled ? 'ON (Very Strict)' : 'OFF'}`}
          style={{ 
            backgroundColor: palmRejectionEnabled ? '#4CAF50' : '#f44336',
            color: 'white'
          }}
        >
          <i className="fas fa-shield-alt"></i>
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
