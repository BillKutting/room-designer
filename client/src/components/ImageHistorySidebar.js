import React, { useState, useEffect } from 'react';
import { Image, Download, RotateCcw, Loader2, Eye, Clock } from 'lucide-react';

const ImageHistorySidebar = ({ 
  originalImage, 
  generatedImages = [], 
  onSelectImage, 
  selectedImageIndex = -1,
  onResetToOriginal 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrls, setImageUrls] = useState({});

  // Fetch image URLs from server if needed
  useEffect(() => {
    const fetchImageUrls = async () => {
      if (!originalImage || generatedImages.length === 0) return;
      
      setIsLoading(true);
      try {
        // For now, we'll use the direct URLs since they're already available
        // In a real implementation, you might want to fetch from the session API
        const urls = {
          original: originalImage,
          generated: generatedImages.map(img => img.url)
        };
        setImageUrls(urls);
      } catch (error) {
        console.error('Error fetching image URLs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchImageUrls();
  }, [originalImage, generatedImages]);

  // Simplified approach - only show original if no generated images, otherwise show all unique images
  const imagesToShow = generatedImages.length === 0 
    ? [
        { 
          url: originalImage, 
          label: 'Original', 
          type: 'original',
          timestamp: null,
          workflow: null,
          id: 'original'
        }
      ]
    : [
        { 
          url: originalImage, 
          label: 'Original', 
          type: 'original',
          timestamp: null,
          workflow: null,
          id: 'original'
        },
        ...generatedImages.map((img, index) => ({
          url: img.url,
          label: `Generated ${index + 1}`,
          type: 'generated',
          timestamp: img.timestamp || new Date().toLocaleTimeString(),
          workflow: img.workflow || 'Unknown',
          id: `generated-${index}`
        }))
      ];



  const handleDownload = (imageUrl, label) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${label.toLowerCase().replace(' ', '_')}.png`;
    link.click();
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-80 bg-[#1e1e1e] border-l border-[#2d2d2d] flex flex-col h-full shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-[#2d2d2d]">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Image className="w-5 h-5 mr-2" />
          Image History
        </h3>
        <p className="text-sm text-[#8e8e8e] mt-1">
          {imagesToShow.length} version{imagesToShow.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Reset to Original Button */}
      {generatedImages.length > 0 && (
        <div className="p-4 border-b border-[#2d2d2d]">
          <button
            onClick={onResetToOriginal}
            className="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-500 transition-all duration-200 text-sm font-medium shadow-md"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Original
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="p-4 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#0d99ff] mr-2" />
          <span className="text-sm text-[#8e8e8e]">Loading images...</span>
        </div>
      )}

      {/* Image List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {imagesToShow.map((image, index) => {
          const isSelected = selectedImageIndex === index - 1 || (index === 0 && selectedImageIndex === -1);
          
          return (
            <div
              key={image.id}
              className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                isSelected
                  ? 'border-[#0d99ff] shadow-lg shadow-[#0d99ff]/20'
                  : 'border-[#3a3a3a] hover:border-[#4a4a4a]'
              }`}
              onClick={() => onSelectImage(index === 0 ? -1 : index - 1)}
            >
              {/* Image Container */}
              <div className="aspect-square bg-[#2d2d2d] relative">
                <img
                  src={image.url}
                  alt={image.label}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                
                {/* Fallback for failed images */}
                <div className="absolute inset-0 hidden items-center justify-center bg-[#2d2d2d]">
                  <div className="text-center">
                    <Image className="w-8 h-8 text-[#666] mx-auto mb-2" />
                    <p className="text-xs text-[#666]">Image unavailable</p>
                  </div>
                </div>
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-200" />
                
                {/* Type Badge */}
                <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium ${
                  image.type === 'original' 
                    ? 'bg-green-500 text-white' 
                    : 'bg-[#0d99ff] text-white'
                }`}>
                  {image.type === 'original' ? 'Original' : 'Generated'}
                </div>
                
                {/* Action Buttons */}
                <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                  {/* View Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(image.url, '_blank');
                    }}
                    className="p-1.5 bg-black/50 text-white rounded hover:bg-black/70"
                    title="View full size"
                  >
                    <Eye className="w-3 h-3" />
                  </button>
                  
                  {/* Download Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(image.url, image.label);
                    }}
                    className="p-1.5 bg-black/50 text-white rounded hover:bg-black/70"
                    title="Download image"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                </div>
              </div>
              
              {/* Info Section */}
              <div className="p-3 bg-[#2d2d2d]">
                <h4 className="text-sm font-medium text-white mb-1 flex items-center">
                  {image.label}
                  {isSelected && (
                    <div className="ml-2 w-2 h-2 bg-[#0d99ff] rounded-full"></div>
                  )}
                </h4>
                
                {image.workflow && (
                  <p className="text-xs text-[#8e8e8e] mb-1">
                    Workflow: {image.workflow}
                  </p>
                )}
                
                {image.timestamp && (
                  <p className="text-xs text-[#666] flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatTimestamp(image.timestamp)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[#2d2d2d]">
        <p className="text-xs text-[#666] text-center">
          Click any image to load it in the editor
        </p>
        <p className="text-xs text-[#666] text-center mt-1">
          Hover for download and view options
        </p>
      </div>
    </div>
  );
};

export default ImageHistorySidebar; 