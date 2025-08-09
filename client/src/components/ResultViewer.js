import React, { useState } from 'react';
import { Download, Share2, RotateCcw, Check } from 'lucide-react';

const ResultViewer = ({ imageUrl, prompt }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `room-design-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My AI Room Design',
          text: 'Check out this room design I created with AI!',
          url: imageUrl
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(imageUrl);
        alert('Image URL copied to clipboard!');
      } catch (error) {
        alert('Share not supported. Right-click and copy image URL.');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Your Room Design is Ready!
        </h3>
        <p className="text-gray-600">
          Here's your AI-generated room transformation
        </p>
      </div>

      {/* Result Image */}
      <div className="flex justify-center">
        <div className="relative">
          <img
            src={imageUrl}
            alt="Generated room design"
            className="max-w-full h-auto max-h-96 rounded-lg shadow-lg"
          />
          {downloadSuccess && (
            <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm flex items-center">
              <Check size={16} className="mr-1" />
              Downloaded!
            </div>
          )}
        </div>
      </div>

      {/* Prompt Used */}
      {prompt && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Design Prompt Used:</h4>
          <p className="text-gray-600 text-sm italic">"{prompt}"</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isDownloading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Downloading...
            </>
          ) : (
            <>
              <Download size={20} className="mr-2" />
              Download Image
            </>
          )}
        </button>

        <button
          onClick={handleShare}
          className="inline-flex items-center px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700"
        >
          <Share2 size={20} className="mr-2" />
          Share
        </button>
      </div>

      {/* Tips */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">💡 Tips:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• The image is high-resolution and ready for printing</li>
          <li>• You can use this as a reference for real room renovations</li>
          <li>• Try different prompts to explore various design styles</li>
          <li>• Share your designs with friends and family</li>
        </ul>
      </div>

      {/* Next Steps */}
      <div className="text-center">
        <p className="text-sm text-gray-600 mb-4">
          Want to try a different style or make more changes?
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <RotateCcw size={16} className="mr-2" />
          Start New Design
        </button>
      </div>
    </div>
  );
};

export default ResultViewer; 