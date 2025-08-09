import React, { useState, useEffect } from 'react';
import { Image, Download, RotateCcw, Loader2, Eye, Clock, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import ErrorModal from './ErrorModal';

const TabbedSidebar = ({ 
  originalImage, 
  generatedImages = [], 
  onSelectImage, 
  selectedImageIndex = -1,
  onResetToOriginal,
  onSelectUpscaledImage,
  selectedUpscaledImageUrl 
}) => {
  const [activeTab, setActiveTab] = useState('generations');
  const [exportQueue, setExportQueue] = useState([]);
  const [exportHistory, setExportHistory] = useState([]);
  const [errorModal, setErrorModal] = useState({ isOpen: false, title: '', message: '', details: '' });

  // Get tab from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['generations', 'exports'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);

  // Update URL when tab changes
  useEffect(() => {
    const url = new URL(window.location);
    url.searchParams.set('tab', activeTab);
    window.history.replaceState({}, '', url);
  }, [activeTab]);

  // Fetch export queue and history
  useEffect(() => {
    fetchExportData();
  }, []);

  const fetchExportData = async () => {
    try {
      // Fetch export queue
      const queueResponse = await fetch('/api/export/queue');
      if (queueResponse.ok) {
        const queueData = await queueResponse.json();
        setExportQueue(queueData);
      } else {
        console.log('Export queue endpoint not available yet');
        setExportQueue([]);
      }

      // Fetch export history
      const historyResponse = await fetch('/api/export/history');
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setExportHistory(historyData);
      } else {
        console.log('Export history endpoint not available yet');
        setExportHistory([]);
      }
    } catch (error) {
      console.error('Error fetching export data:', error);
      setExportQueue([]);
      setExportHistory([]);
    }
  };

  // Poll for queue updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'exports' && exportQueue.some(item => item.status === 'processing')) {
        fetchExportData();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeTab, exportQueue]);



  // Simplified approach - only show original if no generated images, otherwise show all unique images
  // Helper function to ensure URLs are absolute
  const ensureAbsoluteUrl = (url) => {
    if (!url) return url;
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) {
      // API endpoints are on port 5001, not 3000
      const backendOrigin = 'http://localhost:5001';
      return `${backendOrigin}${url}`;
    }
    return url;
  };

  const imagesToShow = generatedImages.length === 0 
    ? [
        { 
          url: ensureAbsoluteUrl(originalImage), 
          label: 'Original', 
          type: 'original',
          timestamp: null,
          workflow: null,
          id: 'original'
        }
      ]
    : [
        { 
          url: ensureAbsoluteUrl(originalImage), 
          label: 'Original', 
          type: 'original',
          timestamp: null,
          workflow: null,
          id: 'original'
        },
        ...generatedImages.slice().reverse().map((img, index) => ({
          url: ensureAbsoluteUrl(img.url),
          label: `Generated ${generatedImages.length - index}`,
          type: 'generated',
          timestamp: img.timestamp || new Date().toLocaleTimeString(),
          workflow: img.workflow || 'Unknown',
          id: `generated-${generatedImages.length - index - 1}`
        }))
      ];

  const handleDownload = async (imageUrl, label) => {
    try {
      // Fetch the image as a blob
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      // Create a blob URL
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${label.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.png`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      setErrorModal({
        isOpen: true,
        title: 'Download Failed',
        message: 'Failed to download the image. Please try again.',
        details: error.message
      });
    }
  };

  const handleExport = async (imageUrl, originalImageId, originalFilename) => {
    try {
      const response = await fetch('/api/export/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          originalImageId,
          originalFilename
        })
      });

      if (response.ok) {
        await fetchExportData();
        setActiveTab('exports');
      } else {
        console.error('Export failed:', response.statusText);
        setErrorModal({
          isOpen: true,
          title: 'Export Failed',
          message: 'The export feature is not available yet. Please try again later.',
          details: `Status: ${response.status} - ${response.statusText}`
        });
      }
    } catch (error) {
      console.error('Error exporting image:', error);
      setErrorModal({
        isOpen: true,
        title: 'Export Error',
        message: 'Failed to export image. Please try again later.',
        details: error.message
      });
    }
  };

  const handleRetryExport = async (queueId) => {
    try {
      const response = await fetch(`/api/export/queue/${queueId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchExportData();
      }
    } catch (error) {
      console.error('Error retrying export:', error);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-green-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'processing':
        return 'Processing';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
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
          {activeTab === 'generations' 
            ? `${imagesToShow.length} version${imagesToShow.length !== 1 ? 's' : ''}`
            : `${exportQueue.length} queued, ${exportHistory.length} completed`
          }
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-[#2d2d2d]">
        <button
          onClick={() => setActiveTab('generations')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'generations'
              ? 'text-white border-b-2 border-[#0d99ff] bg-[#2d2d2d]'
              : 'text-[#8e8e8e] hover:text-white hover:bg-[#2d2d2d]'
          }`}
        >
          Generations
        </button>
        <button
          onClick={() => setActiveTab('exports')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'exports'
              ? 'text-white border-b-2 border-[#0d99ff] bg-[#2d2d2d]'
              : 'text-[#8e8e8e] hover:text-white hover:bg-[#2d2d2d]'
          }`}
        >
          Exports
          {exportQueue.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#0d99ff] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {exportQueue.length}
            </span>
          )}
        </button>
      </div>

      {/* Reset to Original Button (only in generations tab) */}
      {activeTab === 'generations' && generatedImages.length > 0 && (
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



      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'generations' ? (
          /* Generations Tab */
          <div className="p-4 space-y-4">
            {imagesToShow.map((image, index) => {
              const isSelected = index === 0 
                ? selectedImageIndex === -1 
                : selectedImageIndex === generatedImages.length - index;
              
              return (
                <div
                  key={image.id}
                  className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                    isSelected
                      ? 'border-[#0d99ff] shadow-lg shadow-[#0d99ff]/20'
                      : 'border-[#3a3a3a] hover:border-[#4a4a4a]'
                  }`}
                  onClick={() => {
                    if (index === 0) {
                      // Original image
                      onSelectImage(-1);
                    } else {
                      // Generated image - convert reversed display index back to original array index
                      const originalArrayIndex = generatedImages.length - index;
                      onSelectImage(originalArrayIndex);
                    }
                  }}
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

                      {/* Export Button (only for generated images) */}
                      {image.type === 'generated' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExport(image.url, image.id, image.label);
                          }}
                          className="p-1.5 bg-black/50 text-white rounded hover:bg-black/70"
                          title="Export with upscaling"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      )}
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
        ) : (
          /* Exports Tab */
          <div className="p-4 space-y-4">
            {/* Export Queue */}
            {exportQueue.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Processing Queue</h4>
                <div className="space-y-3">
                  {exportQueue.map((item) => (
                    <div key={item.id} className="bg-green-500/10 rounded-lg p-3 border border-green-500/30">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          {getStatusIcon(item.status)}
                          <span className="ml-2 text-sm text-white">{getStatusText(item.status)}</span>
                        </div>
                        {item.status === 'failed' && (
                          <button
                            onClick={() => handleRetryExport(item.id)}
                            className="p-1 text-green-400 hover:text-green-300"
                            title="Retry export"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-[#8e8e8e] mb-1">{item.original_filename}</p>
                      <p className="text-xs text-[#666]">{formatTimestamp(item.created_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Export History */}
            {exportHistory.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Completed Exports</h4>
                <div className="space-y-3">
                  {exportHistory.map((item) => (
                    <div key={item.id} className={`bg-[#2d2d2d] rounded-lg overflow-hidden border transition-colors group cursor-pointer ${
                      selectedUpscaledImageUrl === item.upscaled_path 
                        ? 'border-[#0d99ff] ring-2 ring-[#0d99ff]/20' 
                        : 'border-[#3a3a3a] hover:border-[#0d99ff]'
                    }`}>
                      <div 
                        className="aspect-square bg-[#2d2d2d] relative"
                        onClick={() => onSelectUpscaledImage && onSelectUpscaledImage(item.upscaled_path, item.original_filename)}
                      >
                        <img
                          src={item.upscaled_path}
                          alt={item.original_filename}
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
                        
                        {/* Action Buttons */}
                        <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(item.upscaled_path, '_blank');
                            }}
                            className="p-1.5 bg-black/50 text-white rounded hover:bg-black/70"
                            title="View full size"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(item.upscaled_path, `${item.original_filename}-upscaled`);
                            }}
                            className="p-1.5 bg-black/50 text-white rounded hover:bg-black/70"
                            title="Download upscaled image"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="p-3">
                        <p className="text-sm text-white mb-1">{item.original_filename}-upscaled</p>
                        <p className="text-xs text-[#666]">{formatTimestamp(item.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {exportQueue.length === 0 && exportHistory.length === 0 && (
              <div className="text-center py-8">
                <RefreshCw className="w-12 h-12 text-[#666] mx-auto mb-4" />
                <p className="text-sm text-[#8e8e8e] mb-2">No exports yet</p>
                <p className="text-xs text-[#666]">Export images from the Generations tab to see them here</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[#2d2d2d]">
        <p className="text-xs text-[#666] text-center">
          {activeTab === 'generations' 
            ? 'Click any image to load it in the editor'
            : 'Click any upscaled image to view it in the editor'
          }
        </p>
        <p className="text-xs text-[#666] text-center mt-1">
          {activeTab === 'generations' 
            ? 'Hover for download and export options'
            : 'Hover for download and view options'
          }
        </p>
      </div>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, title: '', message: '', details: '' })}
        title={errorModal.title}
        message={errorModal.message}
        details={errorModal.details}
      />
    </div>
  );
};

export default TabbedSidebar; 