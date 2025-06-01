import React, { useState } from 'react';
import './Logo.css';

const Logo = () => {
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <div className="logo-container">
      {!imageError ? (
        <img 
          src="/lcc360-logo.png" 
          alt="LCC 360" 
          className="logo-image"
          onError={handleImageError}
        />
      ) : (
        <div className="logo-fallback">
          <span className="logo-text">LCC 360</span>
        </div>
      )}
    </div>
  );
};

export default Logo; 