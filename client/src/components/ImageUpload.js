import React, { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import axios from 'axios';

const ImageUpload = ({ onUpload }) => {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file) => {
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setUploadedImage(response.data.imageUrl);
        onUpload(response.data.imageUrl);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = () => {
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (uploadedImage) {
    return (
      <div className="text-center">
        <div className="relative inline-block">
          <img
            src={uploadedImage}
            alt="Uploaded room"
            className="max-w-full h-auto max-h-96 rounded-lg shadow-lg border-2 border-[#3a3a3a]"
          />
          <button
            onClick={removeImage}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-colors shadow-lg"
          >
            <X size={16} />
          </button>
        </div>
        <p className="mt-4 text-sm text-[#8e8e8e]">Image uploaded successfully!</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div
        className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
          isDragging
            ? 'border-[#0d99ff] bg-[#0d99ff]/10'
            : 'border-[#3a3a3a] hover:border-[#4a4a4a] bg-[#2d2d2d]'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload size={48} className="mx-auto text-[#8e8e8e] mb-4" />
        
        <h3 className="text-lg font-medium text-white mb-2">
          Upload Room Image
        </h3>
        
        <p className="text-[#8e8e8e] mb-4">
          Drag and drop your room image here, or click to browse
        </p>
        
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#0d99ff] to-[#00d4ff] text-white rounded-lg hover:from-[#00d4ff] hover:to-[#0d99ff] disabled:opacity-50 transition-all duration-200 font-medium shadow-lg"
        >
          {isUploading ? 'Uploading...' : 'Choose Image'}
        </button>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
      
      <p className="mt-4 text-sm text-[#666]">
        Supported formats: JPG, PNG, WebP (Max 10MB)
      </p>
    </div>
  );
};

export default ImageUpload; 