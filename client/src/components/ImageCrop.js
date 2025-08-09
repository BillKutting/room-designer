import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RotateCw, Lock, Unlock, Check, ArrowLeft } from 'lucide-react';

const ImageCrop = ({ imageUrl, onCrop, onCancel, onSkip }) => {
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lockAspectRatio, setLockAspectRatio] = useState(true);
  const [targetSize] = useState({ width: 1024, height: 1024 });
  
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const cropRef = useRef(null);

  const initializeCrop = useCallback(() => {
    const img = imageRef.current;
    const container = containerRef.current;
    if (!img || !container) return;

    console.log('Image loaded:', img.src);
    console.log('Image dimensions:', img.naturalWidth, 'x', img.naturalHeight);
    console.log('Container dimensions:', container.offsetWidth, 'x', container.offsetHeight);

    // Just center the image initially
    setImagePosition({ x: 0, y: 0 });
  }, []);

  // Initialize crop when image loads or component mounts
  useEffect(() => {
    const img = imageRef.current;
    if (img) {
      if (img.complete) {
        initializeCrop();
      } else {
        img.onload = initializeCrop;
      }
    }
  }, [imageUrl, initializeCrop]);

  const handleMouseDown = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Always drag the image (no resize handles needed)
    setIsDragging(true);
    setDragStart({ x: x - imagePosition.x, y: y - imagePosition.y });
  }, [imagePosition]);





  const handleCrop = useCallback(async () => {
    const img = imageRef.current;
    const container = containerRef.current;
    if (!img || !container) return;
    
    try {
      // Create a canvas to crop the image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Get container dimensions
      const containerRect = container.getBoundingClientRect();
      const cropSize = Math.min(containerRect.width, containerRect.height) * 0.8; // 80% of container
      
      // Calculate the center of the container (fixed crop area)
      const cropCenterX = containerRect.width / 2;
      const cropCenterY = containerRect.height / 2;
      
      // Calculate the crop area bounds
      const cropLeft = cropCenterX - cropSize / 2;
      const cropTop = cropCenterY - cropSize / 2;
      const cropRight = cropCenterX + cropSize / 2;
      const cropBottom = cropCenterY + cropSize / 2;
      
      // Calculate the image position relative to the crop area
      const imageLeft = cropLeft - imagePosition.x;
      const imageTop = cropTop - imagePosition.y;
      
      // Calculate the crop coordinates in the original image space
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;
      
      const cropX = Math.max(0, imageLeft * scaleX);
      const cropY = Math.max(0, imageTop * scaleY);
      const cropWidth = Math.min(img.naturalWidth - cropX, cropSize * scaleX);
      const cropHeight = Math.min(img.naturalHeight - cropY, cropSize * scaleY);
      
      // Set canvas size to target size
      canvas.width = targetSize.width;
      canvas.height = targetSize.height;
      
      // Draw the cropped portion
      ctx.drawImage(
        img,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, targetSize.width, targetSize.height
      );
      
      // Convert to blob and upload to server
      canvas.toBlob(async (blob) => {
        if (!blob) {
          console.error('Failed to create blob from canvas');
          // Fallback: create a simple cropped image using the original URL
          onCrop(imageUrl, null);
          return;
        }
        
        try {
          const formData = new FormData();
          formData.append('image', blob, 'cropped-image.png');
          
          const response = await fetch('/api/upload-cropped', {
            method: 'POST',
            body: formData
          });
          
          if (!response.ok) {
            throw new Error('Failed to upload cropped image');
          }
          
          const result = await response.json();
          onCrop(result.imageUrl, blob);
        } catch (error) {
          console.error('Error uploading cropped image:', error);
          // Fallback to local blob URL
          const croppedUrl = URL.createObjectURL(blob);
          onCrop(croppedUrl, blob);
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error during cropping:', error);
      // Ultimate fallback: use original image
      onCrop(imageUrl, null);
    }
  }, [imagePosition, targetSize, onCrop, imageUrl]);

  const handleRotate = useCallback(() => {
    // This would rotate the image 90 degrees
    // For now, we'll just reinitialize the crop
    setTimeout(initializeCrop, 100);
  }, [initializeCrop]);

  useEffect(() => {
    const handleMouseUpGlobal = () => {
      setIsDragging(false);
    };

    const handleMouseMoveGlobal = (e) => {
      if (!isDragging) return;
      
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const newX = x - dragStart.x;
      const newY = y - dragStart.y;
      
      setImagePosition({ x: newX, y: newY });
    };

    document.addEventListener('mouseup', handleMouseUpGlobal);
    document.addEventListener('mousemove', handleMouseMoveGlobal);
    
    return () => {
      document.removeEventListener('mouseup', handleMouseUpGlobal);
      document.removeEventListener('mousemove', handleMouseMoveGlobal);
    };
  }, [isDragging, dragStart]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2">
              <div className="bg-[#1e1e1e] rounded-xl border border-[#2d2d2d] shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[#2d2d2d]">
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="p-1.5 hover:bg-[#2d2d2d] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base font-semibold">Crop Image to 1024×1024</h2>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => setLockAspectRatio(!lockAspectRatio)}
              className={`p-1.5 rounded-lg transition-colors ${
                lockAspectRatio ? 'bg-[#0d99ff] text-white' : 'hover:bg-[#2d2d2d]'
              }`}
              title={lockAspectRatio ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
            >
              {lockAspectRatio ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            </button>
            <button
              onClick={handleRotate}
              className="p-1.5 hover:bg-[#2d2d2d] rounded-lg transition-colors"
              title="Rotate 90°"
            >
              <RotateCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Crop Area */}
        <div className="flex-1 p-4 flex items-center justify-center">
          <div 
            ref={containerRef}
            className="relative bg-[#0a0a0a] rounded-lg overflow-hidden"
            style={{ maxWidth: '75%', maxHeight: 'calc(100vh - 350px)', minHeight: '400px' }}
          >
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Crop preview"
              className="absolute block w-full h-full object-contain cursor-move"
              style={{ 
                transform: `translate(${imagePosition.x}px, ${imagePosition.y}px)`
              }}
              crossOrigin="anonymous"
              onLoad={initializeCrop}
              onError={(e) => console.error('Image failed to load:', e.target.src)}
              onMouseDown={handleMouseDown}
            />
            
            {/* Fixed Crop Overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Dark overlay */}
              <div className="absolute inset-0 bg-black/50" />
              
              {/* Fixed crop rectangle in center */}
              <div
                className="absolute border-2 border-white shadow-lg"
                style={{
                  left: '10%',
                  top: '10%',
                  width: '80%',
                  height: '80%',
                  backgroundColor: 'transparent'
                }}
              >
                {/* Corner indicators */}
                {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(handle => (
                  <div
                    key={handle}
                    className="absolute w-3 h-3 bg-white border border-gray-800"
                    style={{
                      left: handle.includes('left') ? '-6px' : 'calc(100% - 6px)',
                      top: handle.includes('top') ? '-6px' : 'calc(100% - 6px)',
                      transform: 'translate(-50%, -50%)'
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-[#2d2d2d]">
          <div className="text-xs text-gray-400">
            Drag image to position • Fixed 1024×1024 crop area • {lockAspectRatio ? 'Aspect ratio locked' : 'Aspect ratio free'}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onSkip}
              className="px-3 py-1.5 text-gray-400 hover:text-white transition-colors text-sm"
            >
              Skip
            </button>
            <button
              onClick={handleCrop}
              className="px-4 py-1.5 bg-[#0d99ff] text-white rounded-lg hover:bg-[#0b87e6] transition-colors flex items-center gap-1.5 text-sm"
            >
              <Check className="w-3 h-3" />
              Crop & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCrop;
