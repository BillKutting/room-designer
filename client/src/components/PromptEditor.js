import React, { useState } from 'react';
import { Send, Sparkles, RotateCcw } from 'lucide-react';

const PromptEditor = ({ imageUrl, onSubmit, isProcessing }) => {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');

  const stylePresets = [
    {
      name: 'Gaming Setup',
      prompt: 'modern gaming room with RGB lighting, gaming desk, multiple monitors, gaming chair, LED strips, dark theme with neon accents',
      icon: '🎮'
    },
    {
      name: 'Minimalist',
      prompt: 'clean minimalist room with neutral colors, simple furniture, lots of natural light, uncluttered space, modern design',
      icon: '✨'
    },
    {
      name: 'Cozy',
      prompt: 'warm cozy room with soft lighting, comfortable furniture, warm colors, plants, throw pillows, inviting atmosphere',
      icon: '🏠'
    },
    {
      name: 'Modern',
      prompt: 'contemporary modern room with sleek furniture, clean lines, neutral palette, statement lighting, open space',
      icon: '🏢'
    },
    {
      name: 'Industrial',
      prompt: 'industrial style room with exposed brick, metal accents, vintage furniture, warm lighting, urban aesthetic',
      icon: '🏭'
    },
    {
      name: 'Scandinavian',
      prompt: 'Scandinavian design with light wood, white walls, natural materials, functional furniture, bright and airy',
      icon: '🌲'
    }
  ];

  const handleStyleSelect = (style) => {
    setSelectedStyle(style.name);
    setPrompt(style.prompt);
  };

  const handleSubmit = () => {
    if (prompt.trim()) {
      onSubmit(prompt);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Describe Your Design Vision
        </h3>
        <p className="text-gray-600">
          Enter a detailed prompt describing how you want your room to look
        </p>
      </div>

      {/* Style Presets */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Style Presets:</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {stylePresets.map((style) => (
            <button
              key={style.name}
              onClick={() => handleStyleSelect(style)}
              className={`p-3 text-left rounded-lg border transition-colors ${
                selectedStyle === style.name
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">{style.icon}</div>
              <div className="text-sm font-medium text-gray-900">{style.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Prompt */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Custom Design Prompt:
        </label>
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe your ideal room design... (e.g., 'modern gaming room with RGB lighting, gaming desk, multiple monitors')"
            className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isProcessing}
          />
          <div className="absolute bottom-2 right-2">
            <Sparkles size={16} className="text-gray-400" />
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Be specific about colors, furniture, lighting, and overall mood
        </p>
      </div>

      {/* Preview Image */}
      {imageUrl && (
        <div className="text-center">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Working with:</h4>
          <img
            src={imageUrl}
            alt="Room to transform"
            className="max-w-full h-auto max-h-48 rounded-lg shadow-sm mx-auto"
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        <button
          onClick={() => {
            setPrompt('');
            setSelectedStyle('');
          }}
          className="inline-flex items-center px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <RotateCcw size={16} className="mr-2" />
          Clear
        </button>
        
        <button
          onClick={handleSubmit}
          disabled={!prompt.trim() || isProcessing}
          className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing...
            </>
          ) : (
            <>
              <Send size={16} className="mr-2" />
              Generate Design
            </>
          )}
        </button>
      </div>

      {isProcessing && (
        <div className="text-center text-sm text-gray-600">
          <p>AI is creating your room design...</p>
          <p>This may take 30-60 seconds</p>
        </div>
      )}
    </div>
  );
};

export default PromptEditor; 