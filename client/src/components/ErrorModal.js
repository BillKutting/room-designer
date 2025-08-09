import React from 'react';
import { X, AlertCircle } from 'lucide-react';

const ErrorModal = ({ isOpen, onClose, title, message, details }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-xl shadow-2xl w-full max-w-md">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2d2d2d]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              <p className="text-sm text-[#8e8e8e]">Something went wrong</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#2d2d2d] hover:bg-[#3a3a3a] transition-colors"
          >
            <X className="w-4 h-4 text-[#8e8e8e] hover:text-white" />
          </button>
        </div>
        
        {/* Modal Content */}
        <div className="p-6">
          <p className="text-white mb-4">{message}</p>
          {details && (
            <div className="bg-[#2d2d2d] rounded-lg p-3">
              <p className="text-xs text-[#8e8e8e] font-mono">{details}</p>
            </div>
          )}
        </div>
        
        {/* Modal Footer */}
        <div className="flex items-center justify-end p-6 border-t border-[#2d2d2d]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal; 