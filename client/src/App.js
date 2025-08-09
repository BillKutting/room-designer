import React, { useState } from 'react';
import { RotateCcw, Sparkles, Zap, Shield, Clock } from 'lucide-react';
import ImageUpload from './components/ImageUpload';

import InpaintEditor from './components/InpaintEditor';
import ResultViewer from './components/ResultViewer';

import SimpleAnimatedBackground from './components/SimpleAnimatedBackground';

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [originalImage, setOriginalImage] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [selectedImageUrl, setSelectedImageUrl] = useState(null); // Track which image is currently selected
  const [selectedUpscaledImageUrl, setSelectedUpscaledImageUrl] = useState(null); // Track which upscaled image is currently selected
  const [prompt, setPrompt] = useState('');
  const [resultImage, setResultImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [clearMasksFunction, setClearMasksFunction] = useState(null);



  const resizeImageTo1024 = (imageUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas to 1024x1024
        canvas.width = 1024;
        canvas.height = 1024;
        
        // Fill with black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 1024, 1024);
        
        // Calculate scaling to fit image within 1024x1024
        const scale = Math.min(1024 / img.width, 1024 / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        
        // Center the image
        const x = (1024 - scaledWidth) / 2;
        const y = (1024 - scaledHeight) / 2;
        
        // Draw the resized image
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        
        // Convert to blob URL
        canvas.toBlob((blob) => {
          const resizedUrl = URL.createObjectURL(blob);
          resolve(resizedUrl);
        }, 'image/png');
      };
      img.src = imageUrl;
    });
  };

  const handleImageUpload = (imageUrl) => {
    setOriginalImage(imageUrl);
    setUploadedImage(imageUrl);
    setSelectedImageUrl(imageUrl); // Set the original as initially selected
    
    // Automatically resize images larger than 1024x1024
    const img = new Image();
    img.onload = () => {
      if (img.width > 1024 || img.height > 1024) {
        // Auto-resize the image to 1024x1024
        resizeImageTo1024(imageUrl).then(resizedUrl => {
          setOriginalImage(imageUrl);
          setUploadedImage(resizedUrl);
          setSelectedImageUrl(resizedUrl);
          setCurrentStep(2);
        });
      } else {
        setCurrentStep(2);
      }
    };
    img.src = imageUrl;
  };





  const executeComfyUIWorkflow = async (workflowType, imageUrl, prompt, maskUrl = null) => {
    console.log(`Starting ${workflowType} workflow:`, { imageUrl, prompt, maskUrl });
    
    const formData = new FormData();
    
    try {
      // Convert image URL to file
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
      }
      const imageBlob = await imageResponse.blob();
      formData.append('image', imageBlob, 'image.jpg');
      formData.append('prompt', prompt);
      
      if (maskUrl) {
        console.log('Adding mask to formData');
        const maskResponse = await fetch(maskUrl);
        if (!maskResponse.ok) {
          throw new Error(`Failed to fetch mask: ${maskResponse.statusText}`);
        }
        const maskBlob = await maskResponse.blob();
        formData.append('mask', maskBlob, 'mask.png');
      } else {
        console.log('No mask provided - sending edit workflow');
      }

      console.log(`Sending ${workflowType} request to ComfyUI...`);
      console.log(`Endpoint: /api/comfyui/${workflowType}`);
      console.log(`FormData entries:`, Array.from(formData.entries()).map(([key, value]) => [key, value instanceof Blob ? `Blob(${value.size} bytes)` : value]));
      
      const response = await fetch(`/api/comfyui/${workflowType}`, {
        method: 'POST',
        body: formData
      });

      console.log(`ComfyUI response status:`, response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`ComfyUI error response:`, errorText);
        throw new Error(`ComfyUI ${workflowType} failed: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`ComfyUI ${workflowType} result:`, result);
      return result.promptId;
    } catch (error) {
      console.error(`Error in executeComfyUIWorkflow (${workflowType}):`, error);
      throw error;
    }
  };

  const monitorComfyUIProgress = async (promptId) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/comfyui/status/${promptId}`);
        const data = await response.json();

        console.log('ComfyUI status response:', data);

        if (data && Object.keys(data).length > 0) {
          // Workflow completed
          const workflowData = Object.values(data)[0];
          const outputs = workflowData.outputs;
          
          console.log('Workflow outputs:', outputs);

          // Look for saved images in the outputs
          let finalImageFilename = null;
          
          // Check all output nodes for saved images
          Object.keys(outputs).forEach(nodeId => {
            const output = outputs[nodeId];
            if (output.images && output.images.length > 0) {
              // Look for images with "Inpainted" prefix (from inpaint workflow)
              // or "img" prefix (from other workflows)
              const savedImage = output.images.find(img => 
                img.filename && (
                  img.filename.startsWith('Inpainted_') || 
                  img.filename.startsWith('img_') ||
                  img.filename.startsWith('UP_') // upscaled images
                )
              );
              
              if (savedImage) {
                finalImageFilename = savedImage.filename;
                console.log('Found saved image:', finalImageFilename);
              }
            }
          });

          if (finalImageFilename) {
            return `/api/comfyui/output/${finalImageFilename}`;
          } else {
            console.log('No saved image found in outputs, checking temp images...');
            // Fallback: look for any image output
            Object.keys(outputs).forEach(nodeId => {
              const output = outputs[nodeId];
              if (output.images && output.images.length > 0 && !finalImageFilename) {
                finalImageFilename = output.images[0].filename;
                console.log('Using temp image as fallback:', finalImageFilename);
              }
            });
            
            if (finalImageFilename) {
              return `/api/comfyui/output/${finalImageFilename}`;
            }
          }
        }

        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error('Timeout waiting for ComfyUI workflow completion');
        }

        // Wait 5 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 5000));
        return checkStatus();
      } catch (error) {
        console.error('Error checking ComfyUI status:', error);
        throw error;
      }
    };

    return checkStatus();
  };

  const handleInpaintComplete = async (imageUrl, maskUrl, promptText) => {
    setPrompt(promptText);
    setIsProcessing(true);
    
    try {
      // Use selectedImageUrl if available, otherwise fall back to the passed imageUrl
      const actualImageUrl = selectedImageUrl || imageUrl;
      
      // Determine workflow type based on whether maskUrl is provided
      const workflowType = maskUrl ? 'inpaint' : 'edit';
      console.log(`handleInpaintComplete called with:`, { imageUrl, maskUrl, promptText });
      console.log(`Using selectedImageUrl: ${selectedImageUrl}, actualImageUrl: ${actualImageUrl}`);
      console.log(`Using workflow type: ${workflowType} (maskUrl: ${maskUrl ? 'provided' : 'null'})`);
      
      const promptId = await executeComfyUIWorkflow(workflowType, actualImageUrl, promptText, maskUrl);
      const resultImageUrl = await monitorComfyUIProgress(promptId);
      
      // Play completion sound
      playCompletionSound();
      
      // Add the new generated image to the history
      const newGeneratedImage = {
        url: resultImageUrl,
        timestamp: new Date().toISOString(),
        workflow: workflowType,
        prompt: promptText
      };
      
      setGeneratedImages(prev => [...prev, newGeneratedImage]);
      
      // Update the uploaded image to the generated result so user can continue editing
      setUploadedImage(resultImageUrl);
      
      // Set the new generated image as the selected image for future edits
      setSelectedImageUrl(resultImageUrl);
      
      // Clear all masks after successful generation so user can start fresh
      if (clearMasksFunction) {
        clearMasksFunction();
      }
      
      setIsProcessing(false);
      // Stay in step 2 (InpaintEditor) instead of going to step 3
    } catch (error) {
      console.error('Error processing image:', error);
      alert(`Error processing image: ${error.message}`);
      setIsProcessing(false);
    }
  };

  const playCompletionSound = () => {
    try {
      console.log('Attempting to play MP3 sound...');
      // Use ONLY the custom MP3 SFX file
      const audio = new Audio('/SFX/finished-sfx.mp3');
      audio.volume = 0.3; // Set volume to 30%
      
      // Add event listeners for debugging
      audio.addEventListener('loadstart', () => console.log('Audio loading started'));
      audio.addEventListener('canplay', () => console.log('Audio can play'));
      audio.addEventListener('error', (e) => console.log('Audio error:', e));
      
      // Play the audio file - no fallback
      audio.play().then(() => {
        console.log('MP3 audio played successfully!');
      }).catch(error => {
        console.log('MP3 audio playback failed:', error);
      });
    } catch (error) {
      console.log('Audio playback not supported or blocked by browser:', error);
    }
  };

  const resetProcess = () => {
    setCurrentStep(1);
    setOriginalImage(null);
    setUploadedImage(null);
    setSelectedImageUrl(null);
    setSelectedUpscaledImageUrl(null);
    setGeneratedImages([]);
    setPrompt('');
    setResultImage(null);
  };

  const handleImageSelect = (selectedImageUrl) => {
    // Don't change uploadedImage - keep it as the original for editing
    setSelectedImageUrl(selectedImageUrl); // Update the selected image state for display
    // Clear any selected upscaled image when switching to a different image
    setSelectedUpscaledImageUrl(null);
  };

  const handleUpscaledImageSelect = (upscaledImageUrl, originalFilename) => {
    // Don't change uploadedImage - keep it as the original for editing
    setSelectedImageUrl(upscaledImageUrl); // Update the selected image state for display
    setSelectedUpscaledImageUrl(upscaledImageUrl); // Update the selected upscaled image state
  };

  const handleClearMasks = (clearMasksFn) => {
    setClearMasksFunction(() => clearMasksFn);
  };



  return (
    <div className="h-screen bg-[#1a1a1a]">
      {currentStep === 1 && (
        <div className="min-h-screen bg-[#1a1a1a] relative overflow-hidden">
          {/* Simple Animated Background */}
          <SimpleAnimatedBackground />
          
          {/* Above-the-Fold Section */}
          <div className="relative z-10 min-h-screen flex flex-col">
            {/* Hero Section (60% of above-the-fold) */}
            <div className="flex-1 flex items-center justify-center pt-16 pb-8">
              <div className="max-w-6xl mx-auto px-6 text-center">
                {/* Badge */}
                <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-[#0d99ff]/20 via-[#00d4ff]/20 to-[#0d99ff]/20 border border-[#0d99ff]/30 rounded-full text-[#0d99ff] text-sm font-medium mb-6 animate-pulse shadow-lg backdrop-blur-sm">
                  <Sparkles className="w-4 h-4 mr-2 animate-spin" style={{ animationDuration: '3s' }} />
                  AI-Powered Room Transformation
                </div>
                
                {/* Main Headline */}
                <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-[#0d99ff] to-[#00d4ff] bg-clip-text text-transparent mb-6 leading-tight">
                  Redesign Any Room
                  <br />
                  <span className="text-white">in Seconds</span>
                </h1>
                
                {/* Subheadline */}
                <p className="text-xl md:text-2xl text-[#8e8e8e] max-w-3xl mx-auto leading-relaxed mb-8">
                  <span className="text-white font-medium">No design skills needed • Professional results • Instant transformations</span>
                </p>
              </div>
            </div>

            {/* Upload Section (40% of above-the-fold) */}
            <div className="flex-shrink-0 pb-16 -mt-8">
              <div className="max-w-4xl mx-auto px-6">
                <div className="bg-[#1e1e1e]/80 backdrop-blur-sm border border-[#2d2d2d] rounded-2xl p-8 shadow-2xl">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">Start Your Transformation</h2>
                    <p className="text-[#8e8e8e]">Upload a photo of your room to begin the AI-powered redesign process</p>
                  </div>
                  <ImageUpload onUpload={handleImageUpload} />
                </div>
                
                {/* Value Props */}
                <div className="flex flex-wrap justify-center gap-6 mt-8">
                  <div className="flex items-center text-[#8e8e8e]">
                    <Zap className="w-5 h-5 text-[#0d99ff] mr-2" />
                    <span>Instant Results</span>
                  </div>
                  <div className="flex items-center text-[#8e8e8e]">
                    <Shield className="w-5 h-5 text-[#0d99ff] mr-2" />
                    <span>Professional Quality</span>
                  </div>
                  <div className="flex items-center text-[#8e8e8e]">
                    <Clock className="w-5 h-5 text-[#0d99ff] mr-2" />
                    <span>Under 2 Minutes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      

      
      {currentStep === 2 && uploadedImage && (
        <InpaintEditor 
          imageUrl={uploadedImage}
          originalImageUrl={originalImage}
          generatedImages={generatedImages}
          selectedImageUrl={selectedImageUrl}
          onComplete={handleInpaintComplete}
          isProcessing={isProcessing}
          onImageSelect={handleImageSelect}
          onSelectUpscaledImage={handleUpscaledImageSelect}
          selectedUpscaledImageUrl={selectedUpscaledImageUrl}
          onClearMasks={handleClearMasks}
          onFinalize={() => {
            setResultImage(uploadedImage);
            setCurrentStep(3);
          }}
        />
      )}
      
      {currentStep === 3 && resultImage && (
        <div className="h-screen bg-[#1a1a1a] flex items-center justify-center p-6">
          <div className="max-w-6xl w-full">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-[#0d99ff] to-[#00d4ff] bg-clip-text text-transparent mb-4">
                Your Transformed Room
              </h1>
              <button
                onClick={resetProcess}
                className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-[#1e1e1e] border border-[#2d2d2d] rounded-lg hover:bg-[#2d2d2d] shadow-lg transition-all"
              >
                <RotateCcw size={18} className="mr-2" />
                Transform Another Room
              </button>
            </div>
            <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-2xl shadow-2xl p-8">
              <ResultViewer 
                imageUrl={resultImage}
                prompt={prompt}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;