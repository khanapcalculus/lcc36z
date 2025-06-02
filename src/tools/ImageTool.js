export default class ImageTool {
  constructor(context) {
    this.context = context;
  }

  // Function to compress image to a reasonable size for sharing
  compressImage(file, maxWidth = 800, maxHeight = 600, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        
        // Scale down if image is too large
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }
        
        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress the image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to compressed base64
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        
        console.log('🗜️ Image compressed:', {
          originalSize: file.size,
          originalDimensions: `${img.width}x${img.height}`,
          compressedDimensions: `${width}x${height}`,
          compressedSize: compressedDataUrl.length,
          compressionRatio: Math.round((1 - compressedDataUrl.length / file.size) * 100) + '%'
        });
        
        resolve({
          dataUrl: compressedDataUrl,
          width,
          height
        });
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image for compression'));
      };
      
      // Load the original file
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsDataURL(file);
    });
  }

  uploadImage(file) {
    const { addElement } = this.context;
    
    return new Promise((resolve, reject) => {
      console.log('📤 Starting image upload:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });
      
      // Check file size - if too large, compress it
      const maxFileSize = 2 * 1024 * 1024; // 2MB limit
      const needsCompression = file.size > maxFileSize;
      
      if (needsCompression) {
        console.log('⚠️ Large image detected, compressing...');
        
        this.compressImage(file)
          .then(({ dataUrl, width, height }) => {
            const newElement = {
              type: 'image',
              x: 100,
              y: 100,
              width: Math.min(width, 500), // Limit display size
              height: Math.min(height, 500),
              src: dataUrl
            };
            
            console.log('✅ Compressed image element created:', {
              id: newElement.id,
              displaySize: `${newElement.width}x${newElement.height}`,
              dataSize: dataUrl.length
            });
            
            addElement(newElement);
            resolve(newElement);
          })
          .catch(reject);
      } else {
        // File is small enough, process normally
        console.log('✅ Image size acceptable, processing normally...');
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
          const img = new Image();
          img.src = e.target.result;
          
          img.onload = () => {
            // Calculate dimensions while maintaining aspect ratio
            const maxWidth = 500;
            const maxHeight = 500;
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
              height = (maxWidth / width) * height;
              width = maxWidth;
            }
            
            if (height > maxHeight) {
              width = (maxHeight / height) * width;
              height = maxHeight;
            }
            
            const newElement = {
              type: 'image',
              x: 100,
              y: 100,
              width: width,
              height: height,
              src: e.target.result
            };
            
            console.log('✅ Normal image element created:', {
              displaySize: `${newElement.width}x${newElement.height}`,
              dataSize: e.target.result.length
            });
            
            addElement(newElement);
            resolve(newElement);
          };
          
          img.onerror = () => {
            reject(new Error('Failed to load image'));
          };
        };
        
        reader.onerror = () => {
          reject(new Error('Failed to read file'));
        };
        
        reader.readAsDataURL(file);
      }
    });
  }
}