import React, { useState, useRef, useEffect } from 'react';
import { RotateCcw, Send, Paintbrush, ZoomIn, ZoomOut, Download, Undo, Redo, Settings, MousePointer, Lasso, Eraser, PenTool, Sparkles, Zap, Loader2, Wand2, Square } from 'lucide-react';
import ImageHistorySidebar from './ImageHistorySidebar';

const InpaintEditor = ({ imageUrl, originalImageUrl, onComplete, isProcessing = false, resultImage = null, onFinalize = null, onAddGeneratedImage = null }) => {
  const [currentTool, setCurrentTool] = useState('brush'); // 'brush', 'grab', 'lasso', 'eraser'
  const [brushColor, setBrushColor] = useState('black'); // 'black' or 'white'
  const [brushSize, setBrushSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isLassoing, setIsLassoing] = useState(false);

  const [lassoPoints, setLassoPoints] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  
  // Track brush strokes and lasso selections for preservation
  const [brushStrokes, setBrushStrokes] = useState([]);
  const [lassoSelections, setLassoSelections] = useState([]);
  const [isPenning, setIsPenning] = useState(false);
  const [penPoints, setPenPoints] = useState([]);
  
  // Pen shape editing state
  const [penShapes, setPenShapes] = useState([]);
  const [selectedPenShapeIndex, setSelectedPenShapeIndex] = useState(null);
  const [selectedPenPointIndex, setSelectedPenPointIndex] = useState(null);
  
  // Rectangle tool state (for eraser replacement)
  const [rectangles, setRectangles] = useState([]);
  const [selectedRectangleIndex, setSelectedRectangleIndex] = useState(null);
  const [rectangleCorners, setRectangleCorners] = useState([]);
  const [isRectangleing, setIsRectangleing] = useState(false);
  const [selectedCorner, setSelectedCorner] = useState(null);

  
  // Undo system
  const [editHistory, setEditHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // ComfyUI Workflow states - REMOVED: workflow selection is now automatic
  const [useUpscale, setUseUpscale] = useState(false);
  const [upscalePrompt, setUpscalePrompt] = useState('');
  const [isMagicProcessing, setIsMagicProcessing] = useState(false);

  // Image history management
  const [generatedImages, setGeneratedImages] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(-1); // -1 = original, 0+ = generated images
  const [lastImageUrl, setLastImageUrl] = useState(imageUrl);

  // Track when a new image is generated and add it to history
  useEffect(() => {
    if (imageUrl !== lastImageUrl && lastImageUrl !== null) {
      // This is a new generated image, add it to history
      const newImage = {
        url: imageUrl,
        timestamp: new Date().toLocaleTimeString(),
        workflow: 'AI Generated'
      };
      setGeneratedImages(prev => [...prev, newImage]);
      setSelectedImageIndex(generatedImages.length); // Select the new image
    }
    setLastImageUrl(imageUrl);
  }, [imageUrl, lastImageUrl, generatedImages.length]);

  // Redraw canvas whenever brush strokes, lasso selections, or pen shapes change
  useEffect(() => {
    // Only redraw if the image is loaded
    if (imgRef.current && imgRef.current.complete) {
      const currentState = {
        brushStrokes: brushStrokes,
        lassoSelections: lassoSelections,
        penShapes: penShapes,
        rectangles: rectangles
      };
      redrawCanvas(currentState);
    }
  }, [brushStrokes, lassoSelections, penShapes, rectangles]);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const saveToHistory = () => {
    const currentState = {
      brushStrokes: [...brushStrokes],
      lassoSelections: [...lassoSelections],
      penShapes: [...penShapes],
      rectangles: [...rectangles]
    };
    
    // Remove any future history if we're not at the end
    const newHistory = editHistory.slice(0, historyIndex + 1);
    newHistory.push(currentState);
    
    setEditHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const previousState = editHistory[historyIndex - 1];
      setBrushStrokes(previousState.brushStrokes);
      setLassoSelections(previousState.lassoSelections);
      setPenShapes(previousState.penShapes);
      setRectangles(previousState.rectangles || []);
      setHistoryIndex(historyIndex - 1);
      
      // Redraw canvas with previous state
      redrawCanvas(previousState);
    } else if (historyIndex === 0) {
      // Clear everything
      setBrushStrokes([]);
      setLassoSelections([]);
      setPenShapes([]);
      setRectangles([]);
      setHistoryIndex(-1);
      
      // Clear canvas
      const canvas = canvasRef.current;
      if (canvas && imgRef.current && imgRef.current.complete) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);
      }
    }
  };

  const redo = () => {
    if (historyIndex < editHistory.length - 1) {
      const nextState = editHistory[historyIndex + 1];
      setBrushStrokes(nextState.brushStrokes);
      setLassoSelections(nextState.lassoSelections);
      setPenShapes(nextState.penShapes);
      setRectangles(nextState.rectangles || []);
      setHistoryIndex(historyIndex + 1);
      
      // Redraw canvas with next state
      redrawCanvas(nextState);
    }
  };

  const redrawCanvas = (state) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Clear and redraw original image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Only draw image if it's loaded
    if (imgRef.current && imgRef.current.complete) {
      ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);
    }
    
    // Redraw brush strokes - group by color and size for better performance
    const strokeGroups = {};
    state.brushStrokes.forEach(stroke => {
      const key = `${stroke.color}-${stroke.size}`;
      if (!strokeGroups[key]) {
        strokeGroups[key] = [];
      }
      strokeGroups[key].push(stroke);
    });
    
    Object.entries(strokeGroups).forEach(([key, strokes]) => {
      const [color, size] = key.split('-');
      ctx.lineWidth = parseInt(size);
      ctx.lineCap = 'round';
      ctx.strokeStyle = color === 'black' ? 'rgba(0, 0, 0, 1)' : 'rgba(255, 255, 255, 1)';
      
      // Group consecutive segments into paths
      let currentPath = [];
      
      strokes.forEach(stroke => {
        if (stroke.type === 'line') {
          // If we have a current path, stroke it first
          if (currentPath.length > 0) {
            ctx.beginPath();
            ctx.moveTo(currentPath[0].x, currentPath[0].y);
            currentPath.forEach(point => {
              ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
            currentPath = [];
          }
          
          // Draw the line
          ctx.beginPath();
          ctx.moveTo(stroke.start.x, stroke.start.y);
          ctx.lineTo(stroke.end.x, stroke.end.y);
          ctx.stroke();
        } else if (stroke.type === 'segment') {
          currentPath.push(stroke.point);
        }
      });
      
      // Stroke any remaining path
      if (currentPath.length > 0) {
        ctx.beginPath();
        ctx.moveTo(currentPath[0].x, currentPath[0].y);
        currentPath.forEach(point => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
      }
    });
    
    // Redraw lasso selections
    state.lassoSelections.forEach(selection => {
      ctx.beginPath();
      ctx.moveTo(selection.points[0].x, selection.points[0].y);
      
      for (let i = 1; i < selection.points.length; i++) {
        ctx.lineTo(selection.points[i].x, selection.points[i].y);
      }
      
      ctx.closePath();
      
      if (selection.color === 'black') {
        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      }
      
      ctx.fill();
    });
    

    
    // Redraw pen shapes
    state.penShapes.forEach(shape => {
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y);
      }
      
      ctx.closePath();
      
      if (shape.color === 'black') {
        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      }
      
      ctx.fill();
    });
    
    // Redraw rectangles
    if (state.rectangles) {
      state.rectangles.forEach(rect => {
        ctx.beginPath();
        ctx.moveTo(rect.corners[0].x, rect.corners[0].y);
        for (let i = 1; i < rect.corners.length; i++) {
          ctx.lineTo(rect.corners[i].x, rect.corners[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = rect.color === 'black' ? '#000' : '#fff';
        ctx.fill();
      });
    }
  };

  const redrawCanvasWithPenPreview = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current || !imgRef.current.complete) return;
    
    const ctx = canvas.getContext('2d');
    
    // Clear and redraw original image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);
    
    // Redraw all existing drawings
    const currentState = {
      brushStrokes: [...brushStrokes],
      lassoSelections: [...lassoSelections],
      rectangles: [...rectangles],
      penShapes: [...penShapes]
    };
    
    // Redraw brush strokes
    const strokeGroups = {};
    currentState.brushStrokes.forEach(stroke => {
      const key = `${stroke.color}-${stroke.size}`;
      if (!strokeGroups[key]) {
        strokeGroups[key] = [];
      }
      strokeGroups[key].push(stroke);
    });
    
    Object.entries(strokeGroups).forEach(([key, strokes]) => {
      const [color, size] = key.split('-');
      ctx.lineWidth = parseInt(size);
      ctx.lineCap = 'round';
      ctx.strokeStyle = color === 'black' ? 'rgba(0, 0, 0, 1)' : 'rgba(255, 255, 255, 1)';
      
      let currentPath = [];
      strokes.forEach(stroke => {
        if (stroke.type === 'line') {
          if (currentPath.length > 0) {
            ctx.beginPath();
            ctx.moveTo(currentPath[0].x, currentPath[0].y);
            currentPath.forEach(point => {
              ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
            currentPath = [];
          }
          ctx.beginPath();
          ctx.moveTo(stroke.start.x, stroke.start.y);
          ctx.lineTo(stroke.end.x, stroke.end.y);
          ctx.stroke();
        } else if (stroke.type === 'segment') {
          currentPath.push(stroke.point);
        }
      });
      
      if (currentPath.length > 0) {
        ctx.beginPath();
        ctx.moveTo(currentPath[0].x, currentPath[0].y);
        currentPath.forEach(point => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
      }
    });
    
    // Redraw lasso selections
    currentState.lassoSelections.forEach(selection => {
      ctx.beginPath();
      ctx.moveTo(selection.points[0].x, selection.points[0].y);
      for (let i = 1; i < selection.points.length; i++) {
        ctx.lineTo(selection.points[i].x, selection.points[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = selection.color === 'black' ? 'rgba(0, 0, 0, 1)' : 'rgba(255, 255, 255, 1)';
      ctx.fill();
    });
    
    // Redraw rectangles
    currentState.rectangles.forEach(rect => {
      ctx.beginPath();
      ctx.moveTo(rect.corners[0].x, rect.corners[0].y);
      for (let i = 1; i < rect.corners.length; i++) {
        ctx.lineTo(rect.corners[i].x, rect.corners[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = rect.color === 'black' ? '#000' : '#fff';
      ctx.fill();
    });
    
    // Redraw pen shapes with handles for editing
    currentState.penShapes.forEach((shape, shapeIndex) => {
      // Fill the shape
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = shape.color === 'black' ? 'rgba(0, 0, 0, 1)' : 'rgba(255, 255, 255, 1)';
      ctx.fill();
      
      // Draw handles for editing (only if this shape is selected)
      if (shapeIndex === selectedPenShapeIndex) {
        shape.points.forEach((point, pointIndex) => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
          
          // Selected point is highlighted
          if (pointIndex === selectedPenPointIndex) {
            ctx.fillStyle = '#ff6b6b'; // Red for selected point
          } else {
            ctx.fillStyle = '#0d99ff'; // Blue for other points
          }
          
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }
    });
    
    // Draw pen preview (dotted line) for new shape being created
    if (penPoints.length > 1) {
      ctx.setLineDash([5, 5]); // Create dotted line effect
      ctx.lineWidth = 2;
      ctx.strokeStyle = brushColor === 'black' ? '#0d99ff' : '#ff6b6b';
      
      ctx.beginPath();
      ctx.moveTo(penPoints[0].x, penPoints[0].y);
      
      for (let i = 1; i < penPoints.length; i++) {
        ctx.lineTo(penPoints[i].x, penPoints[i].y);
      }
      
      ctx.stroke();
      ctx.setLineDash([]); // Reset to solid line
    }
    
    // Draw handles at each pen point for new shape being created
    penPoints.forEach((point, index) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
      
      // First point is green, others are blue
      if (index === 0) {
        ctx.fillStyle = '#00ff00'; // Green for first point
      } else {
        ctx.fillStyle = '#0d99ff'; // Blue for other points
      }
      
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  };

  useEffect(() => {
    // Use the getSelectedImageUrl function to determine which image to load
    const imageToLoad = getSelectedImageUrl();
    
    if (imageToLoad && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Store the loaded image in ref for use by other functions
        imgRef.current = img;
        
        // Debug: Log image dimensions
        console.log('Image loaded:', {
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          aspectRatio: img.naturalWidth / img.naturalHeight
        });
        
        // Get the background container dimensions (the dark grey container)
        const backgroundContainer = canvas.parentElement.parentElement;
        const containerRect = backgroundContainer.getBoundingClientRect();
        
        console.log('Container dimensions:', {
          width: containerRect.width,
          height: containerRect.height,
          aspectRatio: containerRect.width / containerRect.height
        });
        
        // Set canvas size to match the image's natural dimensions
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        
        // Calculate proper scaling to fit image within container while maintaining aspect ratio
        const imgAspectRatio = img.naturalWidth / img.naturalHeight;
        const containerAspectRatio = containerRect.width / containerRect.height;
        
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (imgAspectRatio > containerAspectRatio) {
          // Image is wider than container - fit to width
          drawWidth = containerRect.width;
          drawHeight = containerRect.width / imgAspectRatio;
          offsetX = 0;
          offsetY = (containerRect.height - drawHeight) / 2;
        } else {
          // Image is taller than container - fit to height
          drawHeight = containerRect.height;
          drawWidth = containerRect.height * imgAspectRatio;
          offsetX = (containerRect.width - drawWidth) / 2;
          offsetY = 0;
        }
        
        console.log('Drawing dimensions:', {
          drawWidth,
          drawHeight,
          offsetX,
          offsetY
        });
        
        // Clear canvas and draw image at full size (canvas is now 1024x1024)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Reset view to center the image at 100% zoom
        resetView();
      };
      img.src = imageToLoad;
    }
  }, [imageUrl, resultImage, selectedImageIndex, generatedImages]); // Added selectedImageIndex dependency

  // Add effect to redraw pen preview whenever penPoints changes
  useEffect(() => {
    if (penPoints.length > 0 && canvasRef.current) {
      redrawCanvasWithPenPreview();
    }
  }, [penPoints]);

  // Add keyboard event listeners for Shift key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
      
      // Keyboard shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          undo();
        } else if (e.key === 'y') {
          e.preventDefault();
          redo();
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
        setStartPoint(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);



  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // Calculate the scale factor between display size and actual canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Account for zoom and pan transformations
    const x = ((e.clientX - rect.left) / zoom - pan.x / zoom) * scaleX;
    const y = ((e.clientY - rect.top) / zoom - pan.y / zoom) * scaleY;
    
    // Ensure coordinates are within canvas bounds
    const clampedX = Math.max(0, Math.min(canvas.width, x));
    const clampedY = Math.max(0, Math.min(canvas.height, y));
    
    // Convert mouse coordinates to canvas coordinates
    return {
      x: clampedX,
      y: clampedY,
    };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Fix coordinate scaling - account for zoom and pan
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Account for zoom and pan transformations
    const x = ((e.clientX - rect.left) / zoom - pan.x / zoom) * scaleX;
    const y = ((e.clientY - rect.top) / zoom - pan.y / zoom) * scaleY;
    
    // Ensure coordinates are within canvas bounds
    const clampedX = Math.max(0, Math.min(canvas.width, x));
    const clampedY = Math.max(0, Math.min(canvas.height, y));
    
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(clampedX, clampedY);
    
    if (isShiftPressed) {
      setStartPoint({ x: clampedX, y: clampedY });
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    setStartPoint(null);
    
    // Save to history when brush stroke is completed
    if (brushStrokes.length > 0) {
      saveToHistory();
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Fix coordinate scaling - account for zoom and pan
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Account for zoom and pan transformations
    const x = ((e.clientX - rect.left) / zoom - pan.x / zoom) * scaleX;
    const y = ((e.clientY - rect.top) / zoom - pan.y / zoom) * scaleY;
    
    // Ensure coordinates are within canvas bounds
    const clampedX = Math.max(0, Math.min(canvas.width, x));
    const clampedY = Math.max(0, Math.min(canvas.height, y));
    
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.strokeStyle = brushColor === 'black' ? 'rgba(0, 0, 0, 1)' : 'rgba(255, 255, 255, 1)';
    
    if (isShiftPressed && startPoint) {
      // Draw straight line from start point to current point
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(clampedX, clampedY);
      ctx.stroke();
      
      // Track this stroke
      setBrushStrokes(prev => [...prev, {
        type: 'line',
        start: { x: startPoint.x, y: startPoint.y },
        end: { x: clampedX, y: clampedY },
        color: brushColor,
        size: brushSize
      }]);
    } else {
      // Normal freehand drawing
      ctx.lineTo(clampedX, clampedY);
      ctx.stroke();
      
      // Track this stroke segment
      setBrushStrokes(prev => [...prev, {
        type: 'segment',
        point: { x: clampedX, y: clampedY },
        color: brushColor,
        size: brushSize
      }]);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redraw the original image
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = imageUrl;
    
    // Clear brush strokes and lasso selections
    setBrushStrokes([]);
    setLassoSelections([]);
    setRectangles([]);
    
    // Clear pen tool state
    setPenPoints([]);
    setIsPenning(false);
    
    // Clear pen shapes
    setPenShapes([]);
    setSelectedPenShapeIndex(null);
    setSelectedPenPointIndex(null);
  };

  const eraseAtPoint = (x, y) => {
    const eraserRadius = Math.max(brushSize * 2, 20); // Larger eraser radius for better usability
    let hasErased = false;
    
    // Draw a visual indicator of the eraser area (temporary)
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = 'red';
      ctx.beginPath();
      ctx.arc(x, y, eraserRadius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    }
    
    // Erase brush strokes by removing them from the data
    setBrushStrokes(prev => {
      const newStrokes = prev.filter(stroke => {
        if (stroke.type === 'line') {
          const distance = distanceToLine(x, y, stroke.start, stroke.end);
          if (distance <= eraserRadius) {
            hasErased = true;
            return false;
          }
        } else if (stroke.type === 'segment') {
          const distance = Math.sqrt((stroke.point.x - x) ** 2 + (stroke.point.y - y) ** 2);
          if (distance <= eraserRadius) {
            hasErased = true;
            return false;
          }
        }
        return true;
      });
      return newStrokes;
    });
    
    // Erase lasso selections
    setLassoSelections(prev => {
      const newSelections = prev.filter(selection => {
        for (const point of selection.points) {
          const distance = Math.sqrt((point.x - x) ** 2 + (point.y - y) ** 2);
          if (distance <= eraserRadius) {
            hasErased = true;
            return false;
          }
        }
        return true;
      });
      return newSelections;
    });
    
    // Erase pen shapes
    setPenShapes(prev => {
      const newShapes = prev.filter(shape => {
        for (const point of shape.points) {
          const distance = Math.sqrt((point.x - x) ** 2 + (point.y - y) ** 2);
          if (distance <= eraserRadius) {
            hasErased = true;
            return false;
          }
        }
        return true;
      });
      return newShapes;
    });
    
    // Save to history if something was erased
    if (hasErased) {
      setTimeout(() => {
        saveToHistory();
      }, 0);
    }
  };



  const distanceToLine = (px, py, start, end) => {
    const A = px - start.x;
    const B = py - start.y;
    const C = end.x - start.x;
    const D = end.y - start.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    
    if (param < 0) {
      xx = start.x;
      yy = start.y;
    } else if (param > 1) {
      xx = end.x;
      yy = end.y;
    } else {
      xx = start.x + param * C;
      yy = start.y + param * D;
    }
    
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => {
      const newZoom = Math.max(prev - 0.25, 0.25);
      // Auto-center when reaching 100% zoom if image has been panned
      if (newZoom === 1 && (pan.x !== 0 || pan.y !== 0)) {
        setPan({ x: 0, y: 0 });
      }
      // Switch away from grab tool if zoom is 100% or smaller
      if (newZoom <= 1 && currentTool === 'grab') {
        setCurrentTool('brush');
      }
      return newZoom;
    });
  };

  const fillLassoSelection = () => {
    if (lassoPoints.length < 3) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Create a path from the lasso points
    ctx.beginPath();
    ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
    
    for (let i = 1; i < lassoPoints.length; i++) {
      ctx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
    }
    
    // Close the path
    ctx.closePath();
    
    // Fill the selection based on brush color (same as brush tool)
    if (brushColor === 'black') {
      // Inpaint mode - fill with black
      ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    } else {
      // Keep mode - fill with white
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    }
    
    ctx.fill();
    
    // Track this lasso selection
    setLassoSelections(prev => [...prev, {
      points: [...lassoPoints],
      color: brushColor
    }]);
    
    // Save to history when lasso selection is completed
    saveToHistory();
    
    // Clear the lasso points
    setLassoPoints([]);
    setIsLassoing(false);
  };

  const fillPenShape = (points) => {
    if (points.length < 3) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Create a path from the pen points
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    
    // Close the path
    ctx.closePath();
    
    // Fill the shape based on brush color
    if (brushColor === 'black') {
      // Inpaint mode - fill with black
      ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    } else {
      // Keep mode - fill with white
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    }
    
    ctx.fill();
    
    // Add to pen shapes for editing
    const newShape = {
      points: points.slice(0, -1), // Remove the duplicate first point
      color: brushColor
    };
    setPenShapes(prev => [...prev, newShape]);
    
    // Save to history when pen shape is completed
    saveToHistory();
    
    // Track this pen shape
    setLassoSelections(prev => [...prev, {
      points: points.slice(0, -1), // Remove the duplicate first point
      color: brushColor
    }]);
  };











  const handleMouseDown = (e) => {
    if (e.button === 0) { // Left click
      if (currentTool === 'grab' && zoom > 1) {
        setIsPanning(true);
        setLastPanPoint({ x: e.clientX, y: e.clientY });
        e.preventDefault();
      } else if (currentTool === 'brush') {
        startDrawing(e);
      } else if (currentTool === 'eraser') {
        setIsDrawing(true); // Enable drawing state for eraser
        const coords = getCoordinates(e);
        eraseAtPoint(coords.x, coords.y);
        e.preventDefault();
      } else if (currentTool === 'lasso') {
        const { x, y } = getCoordinates(e);
        
        // Check if clicking on existing pen shape points for editing
        if (penShapes.length > 0) {
          for (let shapeIndex = 0; shapeIndex < penShapes.length; shapeIndex++) {
            const shape = penShapes[shapeIndex];
            for (let pointIndex = 0; pointIndex < shape.points.length; pointIndex++) {
              const point = shape.points[pointIndex];
              const distance = Math.sqrt((point.x - x) ** 2 + (point.y - y) ** 2);
              
              if (distance < 15) {
                console.log('Clicked pen shape point:', { shapeIndex, pointIndex, point });
                setSelectedPenShapeIndex(shapeIndex);
                setSelectedPenPointIndex(pointIndex);
                e.preventDefault();
                return;
              }
            }
          }
        }
        
        // Check if clicking near the first point to close the shape
        if (penPoints.length > 2) {
          const firstPoint = penPoints[0];
          const distance = Math.sqrt((firstPoint.x - x) ** 2 + (firstPoint.y - y) ** 2);
          
          if (distance < 20) {
            // Close the shape and fill it
            const closedPoints = [...penPoints, firstPoint];
            fillPenShape(closedPoints);
            setPenPoints([]);
            setIsPenning(false);
            e.preventDefault();
            return;
          }
        }
        
        // Add new point to the pen path
        setPenPoints(prev => [...prev, { x, y }]);
        setIsPenning(true);
        e.preventDefault();
      }
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning && zoom > 1) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      
      setPan(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    } else if (currentTool === 'brush') {
      draw(e);
    } else if (currentTool === 'eraser' && isDrawing) {
      const coords = getCoordinates(e);
      eraseAtPoint(coords.x, coords.y);
      e.preventDefault();
    } else if (currentTool === 'lasso' && selectedPenPointIndex !== null && selectedPenShapeIndex !== null) {
      // Dragging a pen shape point
      const { x, y } = getCoordinates(e);
      
      setPenShapes(prev => {
        const newShapes = [...prev];
        const shape = newShapes[selectedPenShapeIndex];
        shape.points[selectedPenPointIndex] = { x, y };
        return newShapes;
      });
      
      // Use the redrawCanvasWithPenPreview function to redraw everything properly
      redrawCanvasWithPenPreview();
      
      e.preventDefault();
    }
  };

  const handleMouseUp = (e) => {
    if (isPanning) {
      setIsPanning(false);
      e.preventDefault();
    } else if (isLassoing) {
      setIsLassoing(false);
      fillLassoSelection();
      setLassoPoints([]);
      setStartPoint(null);
      e.preventDefault();
    } else if (selectedPenPointIndex !== null && selectedPenShapeIndex !== null) {
      // Finished dragging a pen shape point - redraw everything properly
      redrawCanvasWithPenPreview();
      
      setSelectedPenPointIndex(null);
      setSelectedPenShapeIndex(null);
      e.preventDefault();
    } else if (currentTool === 'eraser') {
      setIsDrawing(false); // Stop eraser drawing state
      e.preventDefault();
    } else {
      stopDrawing();
    }
  };

  const handleMagicPrompt = async () => {
    if (!prompt.trim()) {
      alert('Please enter a prompt to optimize');
      return;
    }

    setIsMagicProcessing(true);
    
    try {
      const response = await fetch('http://localhost:5001/api/openai/optimize-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userPrompt: prompt,
          context: 'room design and interior transformation'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to optimize prompt: ${response.statusText}`);
      }

      const data = await response.json();
      setPrompt(data.optimizedPrompt);
      
      console.log('Original prompt:', prompt);
      console.log('Optimized prompt:', data.optimizedPrompt);
    } catch (error) {
      console.error('Error optimizing prompt:', error);
      alert('Failed to optimize prompt. Please try again.');
    } finally {
      setIsMagicProcessing(false);
    }
  };

  const handleComplete = () => {
    // Remove manual workflow validation - make it automatic based on mask detection
    
    // Validate that we have a prompt
    if (!prompt.trim()) {
      alert('Please enter a prompt for the workflow');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // SIMPLE LOGIC: Check if user has actually drawn anything
    const hasUserDrawn = brushStrokes.length > 0 || lassoSelections.length > 0 || penShapes.length > 0;
    
    console.log(`User drawing detected: ${hasUserDrawn}`);
    console.log(`Brush strokes: ${brushStrokes.length}`);
    console.log(`Lasso selections: ${lassoSelections.length}`);
    console.log(`Pen shapes: ${penShapes.length}`);
    
    // Automatic workflow selection based on actual user input
    let workflowData;
    
    if (hasUserDrawn) {
      // User has drawn something - use Inpaint workflow
      console.log('User has drawn mask areas - using Inpaint workflow');
      
      // Create mask from user drawings
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
      const maskCtx = maskCanvas.getContext('2d');
      
      // Get canvas data and create black/white mask
      const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      const maskData = maskCtx.createImageData(canvas.width, canvas.height);
      
      for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        
        // For inpainting: WHITE areas = areas to inpaint, BLACK areas = areas to keep
        if (r < 50 && g < 50 && b < 50) {
          maskData.data[i] = 255;     // R - WHITE (inpaint this area)
          maskData.data[i + 1] = 255; // G - WHITE (inpaint this area)
          maskData.data[i + 2] = 255; // B - WHITE (inpaint this area)
          maskData.data[i + 3] = 255; // A
        } else {
          maskData.data[i] = 0;       // R - BLACK (keep this area)
          maskData.data[i + 1] = 0;   // G - BLACK (keep this area)
          maskData.data[i + 2] = 0;   // B - BLACK (keep this area)
          maskData.data[i + 3] = 255; // A
        }
      }
      
      maskCtx.putImageData(maskData, 0, 0);
      
      // Convert to blob for upload
      maskCanvas.toBlob((blob) => {
        const maskUrl = URL.createObjectURL(blob);
        workflowData = {
          useInpaint: true,
          useTransform: false,
          useUpscale,
          inpaintPrompt: prompt,
          transformPrompt: '',
          upscalePrompt,
          maskUrl
        };
        onComplete(getSelectedImageUrl(), maskUrl, prompt, 'inpaint');
      }, 'image/png');
    } else {
      // No user drawing - use Image Editing workflow
      console.log('No user drawing detected - using Image Editing workflow');
      
      workflowData = {
        useInpaint: false,
        useTransform: true,
        useUpscale,
        inpaintPrompt: '',
        transformPrompt: prompt, // Use the prompt for transform
        upscalePrompt,
        maskUrl: null
      };
      onComplete(getSelectedImageUrl(), null, prompt, 'transform');
    }
  };

  // Image history functions
  // Get the currently selected image URL
  const getSelectedImageUrl = () => {
    if (selectedImageIndex === -1) {
      // Original image is selected
      return originalImageUrl || imageUrl;
    } else if (selectedImageIndex >= 0 && selectedImageIndex < generatedImages.length) {
      // Generated image is selected
      return generatedImages[selectedImageIndex].url;
    }
    // Fallback to current imageUrl
    return imageUrl;
  };

  const handleSelectImage = (index) => {
    setSelectedImageIndex(index);
    // The image loading will be handled in the useEffect
  };

  const handleResetToOriginal = () => {
    setSelectedImageIndex(-1);
    setGeneratedImages([]);
    // Clear any drawing on the canvas
    setBrushStrokes([]);
    setLassoSelections([]);
    setRectangles([]);
    setPenShapes([]);
    setEditHistory([]);
    setHistoryIndex(-1);
  };

  const addGeneratedImage = (imageUrl, workflow = 'Unknown') => {
    const newImage = {
      url: imageUrl,
      timestamp: new Date().toLocaleTimeString(),
      workflow: workflow
    };
    setGeneratedImages(prev => [...prev, newImage]);
    setSelectedImageIndex(generatedImages.length); // Select the new image
  };

  return (
    <div className="h-screen bg-[#1a1a1a] flex">
      {/* MODERN DARK SIDEBAR */}
      <div className="w-80 bg-[#1e1e1e] border-r border-[#2d2d2d] flex flex-col shadow-xl">
        
        {/* SIDEBAR HEADER */}
        <div className="h-16 bg-[#2d2d2d] border-b border-[#3a3a3a] flex items-center px-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[#0d99ff] rounded-lg flex items-center justify-center">
              <Paintbrush className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">Room Designer</h1>
              <p className="text-xs text-[#8e8e8e]">AI-Powered Inpainting</p>
            </div>
          </div>
        </div>

        {/* TOOLS PANEL */}
        <div className="flex-1 overflow-y-auto pb-24">
          
          {/* PROMPT SECTION - MOVED TO TOP */}
          <div className="p-6 border-b border-[#2d2d2d]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">AI Prompt</h3>
              <div className="w-6 h-6 bg-[#3a3a3a] rounded flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-[#8e8e8e]" />
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="text-xs font-medium text-[#8e8e8e] uppercase tracking-wider">
                Describe what you want to see
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Add a modern gaming setup with RGB lighting, replace the old furniture with sleek white pieces, add plants and artwork..."
                className="w-full h-32 px-4 py-3 text-sm text-white bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#0d99ff] focus:border-transparent placeholder-[#666]"
                disabled={isProcessing}
              />

              
              {/* Magic Button */}
              <button
                onClick={handleMagicPrompt}
                disabled={!prompt.trim() || isMagicProcessing}
                className={`w-full py-2 px-4 text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 ${
                  !prompt.trim() || isMagicProcessing
                    ? 'bg-[#2d2d2d] text-[#8e8e8e] cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg hover:shadow-xl'
                }`}
              >
                {isMagicProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Optimizing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>✨ Magic Prompt</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* TOOLS SECTION */}
          <div className="p-6 border-b border-[#2d2d2d]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Tools</h3>
              <div className="w-6 h-6 bg-[#3a3a3a] rounded flex items-center justify-center">
                <Paintbrush className="w-3 h-3 text-[#8e8e8e]" />
              </div>
            </div>
            
            {/* TOOL SELECTOR */}
            <div className="space-y-3 mb-6">
              <label className="text-xs font-medium text-[#8e8e8e] uppercase tracking-wider">Tool</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCurrentTool('brush')}
                  className={`py-3 px-3 text-sm font-medium rounded-lg transition-all duration-200 flex flex-col items-center space-y-1 ${
                    currentTool === 'brush' 
                      ? 'bg-[#0d99ff] text-white shadow-lg' 
                      : 'bg-[#2d2d2d] text-[#8e8e8e] hover:bg-[#3a3a3a] hover:text-white'
                  }`}
                >
                  <Paintbrush className="w-4 h-4" />
                  <span className="text-xs">Brush</span>
                </button>
                <button
                  onClick={() => setCurrentTool('grab')}
                  disabled={zoom <= 1}
                  className={`py-3 px-3 text-sm font-medium rounded-lg transition-all duration-200 flex flex-col items-center space-y-1 ${
                    currentTool === 'grab' 
                      ? 'bg-[#0d99ff] text-white shadow-lg' 
                      : zoom <= 1
                      ? 'bg-[#2d2d2d] text-[#666] cursor-not-allowed opacity-50'
                      : 'bg-[#2d2d2d] text-[#8e8e8e] hover:bg-[#3a3a3a] hover:text-white'
                  }`}
                  title={zoom <= 1 ? "Grab tool disabled at 100% zoom or smaller" : "Grab tool"}
                >
                  <MousePointer className="w-4 h-4" />
                  <span className="text-xs">Grab</span>
                </button>
                <button
                  onClick={() => setCurrentTool('lasso')}
                  className={`py-3 px-3 text-sm font-medium rounded-lg transition-all duration-200 flex flex-col items-center space-y-1 ${
                    currentTool === 'lasso' 
                      ? 'bg-[#0d99ff] text-white shadow-lg' 
                      : 'bg-[#2d2d2d] text-[#8e8e8e] hover:bg-[#3a3a3a] hover:text-white'
                  }`}
                >
                  <PenTool className="w-4 h-4" />
                  <span className="text-xs">Pen</span>
                </button>
                <button
                  onClick={() => {
                    setCurrentTool('eraser');
                  }}
                  className={`py-3 px-3 text-sm font-medium rounded-lg transition-all duration-200 flex flex-col items-center space-y-1 ${
                    currentTool === 'eraser' 
                      ? 'bg-[#0d99ff] text-white shadow-lg' 
                      : 'bg-[#2d2d2d] text-[#8e8e8e] hover:bg-[#3a3a3a] hover:text-white'
                  }`}
                >
                  <Eraser className="w-4 h-4" />
                  <span className="text-xs">Eraser {currentTool === 'eraser' ? '✓' : ''}</span>
                </button>
                <button
                  onClick={() => {
                    console.log('Clear all strokes clicked');
                    setBrushStrokes([]);
                  }}
                  className="py-3 px-3 text-sm font-medium rounded-lg transition-all duration-200 flex flex-col items-center space-y-1 bg-red-600 text-white hover:bg-red-700"
                >
                  <span className="text-xs">Clear All</span>
                </button>
              </div>
            </div>
            
            {/* BRUSH/LASSO/ERASER CONTROLS - Show when brush, lasso, or eraser tool is selected */}
            {(currentTool === 'brush' || currentTool === 'lasso' || currentTool === 'eraser') && (
              <>
                {/* MODE SELECTOR */}
                <div className="space-y-3 mb-6">
                  <label className="text-xs font-medium text-[#8e8e8e] uppercase tracking-wider">
                    Mode ({currentTool === 'brush' ? 'Brush' : currentTool === 'lasso' ? 'Pen' : 'Eraser'})
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setBrushColor('black')}
                      className={`py-3 px-4 text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 ${
                        brushColor === 'black' 
                          ? 'bg-[#0d99ff] text-white shadow-lg' 
                          : 'bg-[#2d2d2d] text-[#8e8e8e] hover:bg-[#3a3a3a] hover:text-white'
                      }`}
                    >
                      <div className="w-3 h-3 bg-black rounded-full"></div>
                      <span>Inpaint</span>
                    </button>
                    <button
                      onClick={() => setBrushColor('white')}
                      className={`py-3 px-4 text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 ${
                        brushColor === 'white' 
                          ? 'bg-[#0d99ff] text-white shadow-lg' 
                          : 'bg-[#2d2d2d] text-[#8e8e8e] hover:bg-[#3a3a3a] hover:text-white'
                      }`}
                    >
                      <div className="w-3 h-3 bg-white rounded-full border border-[#8e8e8e]"></div>
                      <span>Keep</span>
                    </button>
                  </div>
                </div>

                {/* BRUSH SIZE */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[#8e8e8e] uppercase tracking-wider">
                      {currentTool === 'brush' ? 'Brush Size' : currentTool === 'lasso' ? 'Pen Size' : 'Eraser Size'}
                    </label>
                    <span className="text-sm text-white font-semibold bg-[#2d2d2d] px-3 py-1 rounded-lg">{brushSize}px</span>
                  </div>
                  <div className="relative">
                    <input
                      type="range"
                      min="5"
                      max="50"
                      value={brushSize}
                      onChange={(e) => setBrushSize(parseInt(e.target.value))}
                      className="w-full h-2 bg-[#3a3a3a] rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #0d99ff 0%, #0d99ff ${((brushSize - 5) / 45) * 100}%, #3a3a3a ${((brushSize - 5) / 45) * 100}%, #3a3a3a 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-[#8e8e8e] mt-2">
                      <span>5px</span>
                      <span>50px</span>
                    </div>
                  </div>
                </div>

                {/* TOOL-SPECIFIC INSTRUCTIONS */}
                <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#2d2d2d] mb-6">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-4 h-4 bg-[#0d99ff] rounded-full flex items-center justify-center">
                      <span className="text-xs text-white">💡</span>
                    </div>
                    <p className="text-xs text-[#0d99ff] font-semibold">
                      {currentTool === 'brush' ? 'Brush Tool' : currentTool === 'lasso' ? 'Pen Tool' : 'Eraser Tool'}
                    </p>
                  </div>
                  <p className="text-xs text-[#8e8e8e]">
                    {currentTool === 'brush' 
                      ? `Click and drag to paint. ${brushColor === 'black' ? 'Black areas will be inpainted.' : 'White areas will be preserved.'}`
                      : currentTool === 'lasso'
                      ? `Click to place points and create shapes. Click near the first point to close and fill. ${brushColor === 'black' ? 'Drawn areas will be inpainted.' : 'White areas will be preserved.'}`
                      : currentTool === 'eraser'
                      ? `Click and drag to erase brush strokes, lasso selections, and pen shapes. Adjust eraser size with the slider above.`
                      : `Click and drag to erase brush strokes, lasso selections, and pen shapes.`
                    }
                  </p>
                </div>
              </>
            )}

          </div>
        </div>
      </div>
      
      {/* PROCESS BUTTONS - PINNED TO BOTTOM */}
      <div className="absolute bottom-0 left-0 w-80 bg-[#1e1e1e] border-t border-[#2d2d2d] p-6 space-y-3">
        <button
          onClick={handleComplete}
          disabled={isProcessing || !prompt.trim()}
          className={`w-full py-4 px-6 text-lg font-semibold rounded-lg transition-all duration-200 flex items-center justify-center space-x-3 ${
            isProcessing || !prompt.trim()
              ? 'bg-[#2d2d2d] text-[#8e8e8e] cursor-not-allowed'
              : 'bg-gradient-to-r from-[#0d99ff] to-[#00d4ff] text-white hover:from-[#00d4ff] hover:to-[#0d99ff] shadow-lg hover:shadow-xl'
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <Wand2 className="w-5 h-5" />
              <span>Generate Image</span>
            </>
          )}
        </button>
        
        {/* Finalize Button - Only show if we have generated images */}
        {generatedImages.length > 0 && onFinalize && (
          <button
            onClick={onFinalize}
            className="w-full py-3 px-6 text-base font-medium rounded-lg transition-all duration-200 flex items-center justify-center space-x-3 bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-500 shadow-lg hover:shadow-xl"
          >
            <Download className="w-4 h-4" />
            <span>Finalize & Download</span>
          </button>
        )}
      </div>

      {/* MAIN CANVAS AREA */}
      <div className="flex-1 bg-[#1a1a1a] relative overflow-hidden">
        {/* Canvas Container */}
        <div className="w-full h-full flex items-center justify-center bg-[#2d2d2d] relative">
          <canvas
            ref={canvasRef}
            className={`max-w-full max-h-full object-contain ${
              currentTool === 'eraser' ? 'cursor-crosshair' : 
              currentTool === 'grab' ? 'cursor-grab' : 
              'cursor-crosshair'
            }`}
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transformOrigin: 'center center'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={stopDrawing}
          />
          
          {/* Zoom Controls */}
          <div className="absolute top-4 right-4 flex flex-col space-y-2">
            <button
              onClick={handleZoomIn}
              className="w-10 h-10 bg-[#1e1e1e] border border-[#3a3a3a] rounded-lg flex items-center justify-center text-white hover:bg-[#2d2d2d] transition-all"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="w-10 h-10 bg-[#1e1e1e] border border-[#3a3a3a] rounded-lg flex items-center justify-center text-white hover:bg-[#2d2d2d] transition-all"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={resetView}
              className="w-10 h-10 bg-[#1e1e1e] border border-[#3a3a3a] rounded-lg flex items-center justify-center text-white hover:bg-[#2d2d2d] transition-all"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Undo/Redo Controls */}
          <div className="absolute top-4 left-4 flex space-x-2">
            <button
              onClick={undo}
              className="w-10 h-10 bg-[#1e1e1e] border border-[#3a3a3a] rounded-lg flex items-center justify-center text-white hover:bg-[#2d2d2d] transition-all"
              title="Undo"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              className="w-10 h-10 bg-[#1e1e1e] border border-[#3a3a3a] rounded-lg flex items-center justify-center text-white hover:bg-[#2d2d2d] transition-all"
              title="Redo"
            >
              <Redo className="w-4 h-4" />
            </button>
            <button
              onClick={clearCanvas}
              className="w-10 h-10 bg-[#1e1e1e] border border-[#3a3a3a] rounded-lg flex items-center justify-center text-white hover:bg-[#2d2d2d] transition-all"
              title="Clear Canvas"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR - IMAGE HISTORY */}
      <ImageHistorySidebar
        originalImage={originalImageUrl || imageUrl}
        generatedImages={generatedImages}
        onSelectImage={handleSelectImage}
        selectedImageIndex={selectedImageIndex}
        onResetToOriginal={handleResetToOriginal}
      />
    </div>
  );
};

export default InpaintEditor;