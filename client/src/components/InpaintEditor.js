import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RotateCcw, RotateCw, Send, Paintbrush, ZoomIn, ZoomOut, Download, Undo, Redo, Settings, MousePointer, Square, PenTool, Lightbulb, Wand2, Maximize2, X, Minus, Circle } from 'lucide-react';
import TabbedSidebar from './TabbedSidebar';
import ErrorModal from './ErrorModal';

const InpaintEditor = ({ imageUrl, originalImageUrl, generatedImages = [], selectedImageUrl, onComplete, isProcessing = false, onImageSelect, onSelectUpscaledImage, selectedUpscaledImageUrl, onClearMasks }) => {
  const [currentTool, setCurrentTool] = useState('brush'); // 'brush', 'grab', 'lasso', 'rectangle', 'circle', 'line'
  const [brushColor, setBrushColor] = useState('black'); // 'black' or 'white'
  const [brushSize, setBrushSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [initialPan, setInitialPan] = useState({ x: 0, y: 0 });
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const redrawStrokesAndSelectionsRef = useRef(null);
  const redrawCanvasRef = useRef(null);
  
  // Track brush strokes and pen paths
  const [brushStrokes, setBrushStrokes] = useState([]);
  const [penPaths, setPenPaths] = useState([]); // Completed pen tool paths
  const [currentPath, setCurrentPath] = useState(null); // Active path being drawn
  const [lineStrokes, setLineStrokes] = useState([]); // Line tool strokes
  const [currentLine, setCurrentLine] = useState(null); // Current line being drawn
  
  // No point editing for pen tool
  
  // Track current brush stroke being drawn
  const [currentBrushStroke, setCurrentBrushStroke] = useState(null);
  
  // Point editing for filled shapes
  const [editingPoint, setEditingPoint] = useState(null);
  const [isDraggingPoint, setIsDraggingPoint] = useState(false);
  
  // Track mouse position for anchor placement
  const [lastMousePosition, setLastMousePosition] = useState(null);
  
  // Tooltip state
  const [showTooltip, setShowTooltip] = useState(false);
  const [showPromptTooltip, setShowPromptTooltip] = useState(false);
  const [isRewritingPrompt, setIsRewritingPrompt] = useState(false);
  
  // Modal state
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [errorModal, setErrorModal] = useState({ isOpen: false, title: '', message: '', details: '' });

  // Note: Image history is managed by the parent component through generatedImages prop

  // Find point at position for editing
  const findPointAtPosition = (x, y) => {
    for (let pathIndex = 0; pathIndex < penPaths.length; pathIndex++) {
      const path = penPaths[pathIndex];
      if (!path || !path.points) continue;
      if (path.closed) { // Allow editing of ALL closed shapes (pen tool, rectangles, and circles)
        if (path.type === 'circle') {
          // For circles, check the 4 anchor points at cardinal directions
          const centerX = path.points[0].x + (path.points[16].x - path.points[0].x) / 2; // Center X
          const centerY = path.points[8].y + (path.points[24].y - path.points[8].y) / 2; // Center Y
          const radius = Math.sqrt(Math.pow(path.points[0].x - centerX, 2) + Math.pow(path.points[0].y - centerY, 2));
          
          const anchorPoints = [
            { x: centerX, y: centerY - radius }, // Top
            { x: centerX + radius, y: centerY }, // Right
            { x: centerX, y: centerY + radius }, // Bottom
            { x: centerX - radius, y: centerY }  // Left
          ];
          
          for (let pointIndex = 0; pointIndex < anchorPoints.length; pointIndex++) {
            const point = anchorPoints[pointIndex];
            const distance = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));
            const tolerance = 10;
            if (distance <= tolerance) {
              return { pathIndex, pointIndex };
            }
          }
        } else {
          // For rectangles and pen tool shapes, check all points
          for (let pointIndex = 0; pointIndex < path.points.length; pointIndex++) {
            const point = path.points[pointIndex];
            const distance = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));
            // Larger tolerance for closed shapes since they have bigger anchors (6px radius + 2px stroke = 8px total)
            const tolerance = 10; // Same tolerance for both rectangle and pen tool
            if (distance <= tolerance) {
              return { pathIndex, pointIndex };
            }
          }
        }
      }
    }
    return null;
  };

  // Update point position
  const updatePointPosition = (pathIndex, pointIndex, newX, newY) => {
    setPenPaths(prev => {
      const newPaths = [...prev];
      if (!newPaths[pathIndex] || !newPaths[pathIndex].points) return prev;
      
      if (newPaths[pathIndex].type === 'circle') {
        // For circles, update the entire circle based on the dragged anchor point
        const path = newPaths[pathIndex];
        const centerX = path.points[0].x + (path.points[16].x - path.points[0].x) / 2; // Center X
        const centerY = path.points[8].y + (path.points[24].y - path.points[8].y) / 2; // Center Y
        
        // Calculate new radius based on which anchor point was dragged
        let newRadius;
        if (pointIndex === 0) { // Top anchor
          newRadius = Math.abs(newY - centerY);
        } else if (pointIndex === 1) { // Right anchor
          newRadius = Math.abs(newX - centerX);
        } else if (pointIndex === 2) { // Bottom anchor
          newRadius = Math.abs(newY - centerY);
        } else if (pointIndex === 3) { // Left anchor
          newRadius = Math.abs(newX - centerX);
        }
        
        // Recreate circle points with new radius
        const newCirclePoints = [];
        const numPoints = 32;
        for (let i = 0; i < numPoints; i++) {
          const angle = (i / numPoints) * 2 * Math.PI;
          newCirclePoints.push({
            x: centerX + newRadius * Math.cos(angle),
            y: centerY + newRadius * Math.sin(angle)
          });
        }
        
        newPaths[pathIndex] = {
          ...newPaths[pathIndex],
          points: newCirclePoints
        };
      } else {
        // For rectangles and pen tool shapes, update individual point
        newPaths[pathIndex] = {
          ...newPaths[pathIndex],
          points: newPaths[pathIndex].points.map((point, idx) => 
            idx === pointIndex ? { x: newX, y: newY } : point
          )
        };
      }
      return newPaths;
    });
  };
  
  // Function to save current brush stroke
  const saveCurrentBrushStroke = () => {
    if (currentBrushStroke && currentBrushStroke.points.length > 1) {
      const newStrokes = [...brushStrokes, currentBrushStroke];
      setBrushStrokes(newStrokes);
      setCurrentBrushStroke(null);
      
      // Save to history with the new stroke
      setTimeout(() => {
        saveToHistory({
          brushStrokes: newStrokes,
          penPaths: penPaths
        });
      }, 0);
    }
  };
  
  // Helper function to get current complete state
  const getCurrentState = useCallback(() => {
    let allBrushStrokes = [...(brushStrokes || [])];
    
    // Include current brush stroke if it exists
    if (currentBrushStroke && currentBrushStroke.points && currentBrushStroke.points.length > 1) {
      allBrushStrokes = [...allBrushStrokes, currentBrushStroke];
    }
    
    return {
      brushStrokes: allBrushStrokes,
      penPaths: penPaths || [],
      lineStrokes: lineStrokes || [],
      currentPath: currentPath || null,
      currentLine: currentLine || null
    };
  }, [brushStrokes, currentBrushStroke, penPaths, lineStrokes, currentPath, currentLine]);
  

  
  // Undo system
  const [editHistory, setEditHistory] = useState([{
    brushStrokes: [],
    penPaths: []
  }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 }); // Reset pan - centering is handled by CSS positioning
  };

  const saveToHistory = (newState = null) => {
    const currentState = newState || {
      brushStrokes: [...brushStrokes],
      penPaths: [...penPaths],
      lineStrokes: [...lineStrokes]
    };
    
    // Remove any future history if we're not at the end
    const newHistory = editHistory.slice(0, historyIndex + 1);
    newHistory.push(currentState);
    

    
    setEditHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const previousState = editHistory[historyIndex - 1];
      
      setBrushStrokes(previousState.brushStrokes);
      setPenPaths(previousState.penPaths);
      setLineStrokes(previousState.lineStrokes || []);
      setCurrentPath(null);
      setCurrentLine(null);
      setHistoryIndex(historyIndex - 1);
      
      // Redraw canvas with previous state
      if (redrawCanvasRef.current) {
        redrawCanvasRef.current(previousState);
      }
    }
  }, [historyIndex, editHistory, setBrushStrokes, setPenPaths, setLineStrokes]);

  const redo = useCallback(() => {
    if (historyIndex < editHistory.length - 1) {
      const nextState = editHistory[historyIndex + 1];
      setBrushStrokes(nextState.brushStrokes);
      setPenPaths(nextState.penPaths);
      setLineStrokes(nextState.lineStrokes || []);
      setCurrentPath(null);
      setCurrentLine(null);
      setHistoryIndex(historyIndex + 1);
      
      // Redraw canvas with next state
      if (redrawCanvasRef.current) {
        redrawCanvasRef.current(nextState);
      }
    }
  }, [historyIndex, editHistory, setBrushStrokes, setPenPaths, setLineStrokes]);

  const redrawCanvas = useCallback((state) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Clear and redraw original image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Use selectedImageUrl if available, otherwise fall back to imageUrl
    const displayImageUrl = selectedImageUrl || imageUrl;
    
    // Check if we need to load a new image (different from what's currently loaded)
    const currentImageUrl = imgRef.current ? imgRef.current.src : null;
    const needsNewImage = !imgRef.current || currentImageUrl !== displayImageUrl;
    
    if (needsNewImage && displayImageUrl) {
      // Load new image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imgRef.current = img;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Redraw strokes and selections after image loads
        if (redrawStrokesAndSelectionsRef.current) {
          redrawStrokesAndSelectionsRef.current(ctx, state);
        }
      };
      img.src = displayImageUrl;
      return; // Exit early, will redraw when image loads
    } else if (imgRef.current) {
      // Use existing image
      ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);
    }
    
    // Redraw strokes and selections
    if (redrawStrokesAndSelectionsRef.current) {
      redrawStrokesAndSelectionsRef.current(ctx, state);
    }
  }, [selectedImageUrl, imageUrl]);

  // Keep a stable reference to redrawCanvas to avoid TDZ issues in callbacks
  useEffect(() => {
    redrawCanvasRef.current = redrawCanvas;
  }, [redrawCanvas]);

  // Keep a stable reference to redrawStrokesAndSelections to avoid TDZ issues in callbacks
  useEffect(() => {
    redrawStrokesAndSelectionsRef.current = redrawStrokesAndSelections;
  });

  // Draw pen paths properly
  const drawPenPath = useCallback((ctx, path) => {
    if (!path || !path.points || path.points.length === 0) return;
    
    if (path.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      
      if (path.closed) {
        // FILL the closed shape
        ctx.closePath();
        ctx.fillStyle = path.color === 'black' ? 'rgba(0, 0, 0, 1)' : 'rgba(255, 255, 255, 1)';
        ctx.fill();
      } else {
        // Just draw lines for open path
        ctx.strokeStyle = path.color === 'black' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    
    // Draw anchor points for ALL paths (open and closed)
    if (path.type === 'circle') {
      // For circles, only show 4 anchor points at cardinal directions
      const centerX = path.points[0].x + (path.points[16].x - path.points[0].x) / 2; // Center X
      const centerY = path.points[8].y + (path.points[24].y - path.points[8].y) / 2; // Center Y
      const radius = Math.sqrt(Math.pow(path.points[0].x - centerX, 2) + Math.pow(path.points[0].y - centerY, 2));
      
      // Create 4 anchor points at cardinal directions
      const anchorPoints = [
        { x: centerX, y: centerY - radius }, // Top
        { x: centerX + radius, y: centerY }, // Right
        { x: centerX, y: centerY + radius }, // Bottom
        { x: centerX - radius, y: centerY }  // Left
      ];
      
      anchorPoints.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#0d99ff'; // Blue fill
        ctx.fill();
        ctx.strokeStyle = 'white'; // White outline
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    } else {
      path.points.forEach((point, index) => {
        ctx.beginPath();
        
        if (path.type === 'rectangle') {
          // Rectangle handles - same as pen tool (blue with white outline)
          ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
          ctx.fillStyle = '#0d99ff'; // Blue fill
          ctx.fill();
          ctx.strokeStyle = 'white'; // White outline
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          // Pen tool shapes - circle handles for all points
          if (!path.closed) {
            // Open path - make first point bigger for easier closing
            const radius = index === 0 && path.points.length >= 3 ? 8 : 4;
            ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = path.color === 'black' ? 'black' : 'white';
            ctx.fill();
            ctx.strokeStyle = path.color === 'black' ? 'white' : 'black';
            ctx.lineWidth = index === 0 && path.points.length >= 3 ? 3 : 1;
            ctx.stroke();
          } else {
            // Closed path - bigger, blue editing anchors with white outline
            ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#0d99ff'; // Blue fill
            ctx.fill();
            ctx.strokeStyle = 'white'; // White outline
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      });
    }
  }, []);

  // Draw line paths (filled lines between two points)
  const drawLinePath = useCallback((ctx, line) => {
    if (!line || !line.points || line.points.length === 0) return;
    
    // Draw the filled line if we have 2 points
    if (line.points.length >= 2) {
      ctx.lineWidth = 2; // Thin line, not brush size
      ctx.lineCap = 'round';
      ctx.strokeStyle = line.color === 'black' ? 'rgba(0, 0, 0, 1)' : 'rgba(255, 255, 255, 1)';
      
      ctx.beginPath();
      ctx.moveTo(line.points[0].x, line.points[0].y);
      ctx.lineTo(line.points[1].x, line.points[1].y);
      ctx.stroke();
    }
    
    // Draw anchor points
    line.points.forEach((point, index) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = '#0d99ff'; // Blue fill
      ctx.fill();
      ctx.strokeStyle = 'white'; // White outline
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, []);

  const redrawStrokesAndSelections = useCallback((ctx, state) => {
    // Redraw brush strokes
    state.brushStrokes.forEach(stroke => {
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.strokeStyle = stroke.color === 'black' ? 'rgba(0, 0, 0, 1)' : 'rgba(255, 255, 255, 1)';
      
      if (stroke.type === 'line') {
        // Draw straight line
        ctx.beginPath();
        ctx.moveTo(stroke.start.x, stroke.start.y);
        ctx.lineTo(stroke.end.x, stroke.end.y);
        ctx.stroke();
      } else if (stroke.type === 'path') {
        // Draw complete path
        if (stroke.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          
          ctx.stroke();
        }
      } else if (stroke.type === 'segment') {
        // Legacy segment support - draw as individual points
        ctx.beginPath();
        ctx.moveTo(stroke.point.x, stroke.point.y);
        ctx.lineTo(stroke.point.x, stroke.point.y);
        ctx.stroke();
      }
    });
    
    // Draw completed line strokes
    if (state.lineStrokes) {
      state.lineStrokes.forEach(line => {
        if (line && line.points && line.points.length > 0) {
          drawLinePath(ctx, line);
        }
      });
    }
    
    // Draw completed pen paths
    if (state.penPaths) {
      state.penPaths.forEach(path => {
        if (path && path.points && path.points.length > 0) {
          drawPenPath(ctx, path);
        }
      });
    }
    
    // Draw current path being drawn (including anchor points)
    if (state.currentPath && state.currentPath.points && state.currentPath.points.length > 0) {
      drawPenPath(ctx, state.currentPath);
    }
    
    // Draw current line being drawn
    if (state.currentLine && state.currentLine.points && state.currentLine.points.length > 0) {
      drawLinePath(ctx, state.currentLine);
    }
  }, [drawPenPath, drawLinePath]);

  useEffect(() => {
    if (imageUrl && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Store the loaded image in ref for use by other functions
        imgRef.current = img;
        
        // Set canvas size to match the actual image dimensions
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        
        // Draw image at its natural size
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
        
        // Reset view to center the image at 100% zoom
        resetView();
      };
      img.onerror = () => {
        console.warn('Failed to load image with crossOrigin, trying without...');
        // Fallback: try without crossOrigin if it fails
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          imgRef.current = fallbackImg;
          
          // Set canvas size to match the actual image dimensions
          canvas.width = fallbackImg.naturalWidth;
          canvas.height = fallbackImg.naturalHeight;
          
          // Draw image at its natural size
          ctx.drawImage(fallbackImg, 0, 0, fallbackImg.naturalWidth, fallbackImg.naturalHeight);
          
          // Reset view to center the image at 100% zoom
          resetView();
        };
        fallbackImg.src = imageUrl;
      };
      img.src = imageUrl;
    }
  }, [imageUrl]);

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
  }, [undo, redo]);



  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // Calculate the scale factor between display size and actual canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Convert mouse coordinates to canvas coordinates, accounting for zoom and pan
    const rawX = (e.clientX - rect.left) * scaleX;
    const rawY = (e.clientY - rect.top) * scaleY;
    
    // Apply inverse transform for zoom and pan
    const x = (rawX - pan.x) / zoom;
    const y = (rawY - pan.y) / zoom;
    
    return { x, y };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    
    // Check for point editing FIRST (works for all tools)
    const pointToEdit = findPointAtPosition(x, y);
    if (pointToEdit) {
      setEditingPoint(pointToEdit);
      setIsDraggingPoint(true);
      return;
    }
    
    if (currentTool === 'grab') {
      // Grab tool - start panning (only when zoomed in)
      if (zoom > 1) {
        setStartPoint({ x: e.clientX, y: e.clientY });
        // Store the initial pan position when starting to grab
        setInitialPan({ x: pan.x, y: pan.y });
      }
      return;
    }
    
    if (currentTool === 'brush') {
      // Brush tool - start drawing path
      setStartPoint({ x, y });
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else if (currentTool === 'line') {
      // LINE TOOL - place first anchor point
      if (!currentLine) {
        // Start new line with first point
        const newLine = {
          points: [{ x, y }],
          color: brushColor,
          size: brushSize
        };
        setCurrentLine(newLine);
        
        // IMMEDIATE redraw with first anchor point
        redrawCanvasWithExplicitState({
          brushStrokes,
          penPaths,
          lineStrokes,
          currentPath: null,
          currentLine: newLine
        });
      } else {
        // Complete the line with second point
        const completedLine = {
          ...currentLine,
          points: [...currentLine.points, { x, y }]
        };
        
        // Add to line strokes
        const newLineStrokes = [...lineStrokes, completedLine];
        setLineStrokes(newLineStrokes);
        setCurrentLine(null);
        
        // IMMEDIATE redraw with the new line
        redrawCanvasWithExplicitState({
          brushStrokes,
          penPaths,
          lineStrokes: newLineStrokes,
          currentPath: null,
          currentLine: null
        });
        
        // Save to history
        saveToHistory({
          brushStrokes: brushStrokes,
          penPaths: penPaths,
          lineStrokes: newLineStrokes
        });
      }
    } else if (currentTool === 'lasso') {
      // PEN TOOL
      
      // If current path is closed, clear it to start a new shape
      if (currentPath && currentPath.closed) {
        setCurrentPath(null);
      }
      
      // Store click position for mouse up
      setStartPoint({ x, y });
      

    } else if (currentTool === 'rectangle') {
      // RECTANGLE TOOL - ONLY SET START POINT, NO PATHS
      setStartPoint({ x, y });
      setIsDrawing(true);
      // DO NOT create any paths or currentPath
      return; // Exit immediately
    } else if (currentTool === 'circle') {
      // CIRCLE TOOL - ONLY SET START POINT, NO PATHS
      setStartPoint({ x, y });
      setIsDrawing(true);
      // DO NOT create any paths or currentPath
      return; // Exit immediately
    }
    
    if (isShiftPressed) {
      setStartPoint({ x, y });
    }
  };

      const stopDrawing = () => {
          // RECTANGLE/CIRCLE TOOL - DO NOTHING
      if (currentTool === 'rectangle' || currentTool === 'circle') {
        // But still handle point dragging completion
        if (isDraggingPoint && editingPoint) {
          setIsDraggingPoint(false);
          setEditingPoint(null);
          
          // Save edited shape to history
          saveToHistory({
            brushStrokes: brushStrokes,
            penPaths: penPaths
          });
        }
        return;
      }
    
    setIsDrawing(false);

    // Handle point editing completion
    if (isDraggingPoint && editingPoint) {
      setIsDraggingPoint(false);
      setEditingPoint(null);
      
      // Save edited shape to history
      saveToHistory({
        brushStrokes: brushStrokes,
        penPaths: penPaths
      });
      return;
    }

    // PEN TOOL - Place anchor on mouse up (where we finished, not started)
    if (currentTool === 'lasso' && startPoint) {
      let x, y;
      
      if (lastMousePosition) {
        // Use last mouse position (where we finished dragging)
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        const rawX = (lastMousePosition.x - rect.left) * scaleX;
        const rawY = (lastMousePosition.y - rect.top) * scaleY;
        
        // Apply inverse transform for zoom and pan
        x = (rawX - pan.x) / zoom;
        y = (rawY - pan.y) / zoom;
      } else {
        // Fallback to start point if no mouse movement
        x = startPoint.x;
        y = startPoint.y;
      }
      
      // Check for closing FIRST (highest priority)
      if (currentPath && currentPath.points.length >= 3) {
        const firstPoint = currentPath.points[0];
        const distance = Math.sqrt(Math.pow(x - firstPoint.x, 2) + Math.pow(y - firstPoint.y, 2));
        
        if (distance <= 40) { // BIG closing tolerance
          // CLOSE AND FILL - don't add point!
          const closedPath = { 
            ...currentPath, 
            closed: true,
            points: [...currentPath.points]
          };
          const newPenPaths = [...penPaths, closedPath];
          
          setPenPaths(newPenPaths);
          setCurrentPath(null); // CLEAR current path for next shape
          
          // IMMEDIATE redraw
          redrawCanvasWithExplicitState({ 
            brushStrokes, 
            penPaths: newPenPaths, 
            lineStrokes,
            currentPath: null 
          });
          
          saveToHistory({
            brushStrokes: brushStrokes,
            penPaths: newPenPaths
          });
          setStartPoint(null);
          setLastMousePosition(null); // CLEAR mouse position too
          return;
        }
      }
      
      // Add point if NOT closing
      if (currentPath && !currentPath.closed) {
        // Add to existing path (only if not closed)
        const newPath = {
          ...currentPath,
          points: [...currentPath.points, { x, y }]
        };
        setCurrentPath(newPath);
        
        // IMMEDIATE redraw with new point
        redrawCanvasWithExplicitState({
          brushStrokes,
          penPaths,
          lineStrokes,
          currentPath: newPath
        });
              } else if (currentTool !== 'rectangle' && currentTool !== 'circle') {
          // Start new path (either no current path or current path is closed)
          // ONLY for non-rectangle/non-circle tools
          const newPath = {
            points: [{ x, y }],
            color: brushColor,
            closed: false
          };
          setCurrentPath(newPath);
          
          // IMMEDIATE redraw with first point
          redrawCanvasWithExplicitState({
            brushStrokes,
            penPaths,
            lineStrokes,
            currentPath: newPath
          });
        }
      
      // Clear mouse position after placing anchor
      setLastMousePosition(null);
    }

    // Save complete brush stroke if one was being drawn
    if (currentBrushStroke && currentBrushStroke.points.length > 1) {
      const newStrokes = [...brushStrokes, currentBrushStroke];
      setBrushStrokes(newStrokes);

      // Save to history with the new stroke
      setTimeout(() => {
        saveToHistory({
          brushStrokes: newStrokes,
          penPaths: penPaths
        });
      }, 0);

      setCurrentBrushStroke(null);
    }

    setStartPoint(null);
  };

  // Pen tool doesn't need point editing


  const draw = (e) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Track mouse position for pen tool anchor placement
    setLastMousePosition({ x: e.clientX, y: e.clientY });
    
    // Fix coordinate scaling
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const rawX = (e.clientX - rect.left) * scaleX;
    const rawY = (e.clientY - rect.top) * scaleY;
    
    // Apply inverse transform for zoom and pan
    const x = (rawX - pan.x) / zoom;
    const y = (rawY - pan.y) / zoom;
    
    // Handle point dragging FIRST (works for all tools)
    if (isDraggingPoint && editingPoint) {
      updatePointPosition(editingPoint.pathIndex, editingPoint.pointIndex, x, y);
      redrawCanvasWithStrokes();
      return;
    }
    
    // Handle grab tool panning
    if (currentTool === 'grab' && startPoint && zoom > 1) {
      const deltaX = e.clientX - startPoint.x;
      const deltaY = e.clientY - startPoint.y;
      
      // Calculate new pan position based on initial pan + total mouse movement
      setPan({
        x: initialPan.x + deltaX,
        y: initialPan.y + deltaY
      });
      
      return;
    }
    
    if (currentTool === 'brush') {
      // Brush tool - draw with current color
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.strokeStyle = brushColor === 'black' ? 'rgba(0, 0, 0, 1)' : 'rgba(255, 255, 255, 1)';
      
      if (isShiftPressed && startPoint) {
        // Draw straight line from start point to current point
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        
        // Track this stroke
        setBrushStrokes(prev => {
          const newStrokes = [...prev, {
            type: 'line',
            start: { x: startPoint.x, y: startPoint.y },
            end: { x, y },
            color: brushColor,
            size: brushSize
          }];
          
          return newStrokes;
        });
      } else {
        // Normal freehand drawing - add point to current stroke
        if (!currentBrushStroke && startPoint) {
          // Start a new stroke
          setCurrentBrushStroke({
            type: 'path',
            points: [{ x: startPoint.x, y: startPoint.y }, { x, y }],
            color: brushColor,
            size: brushSize
          });
        } else if (currentBrushStroke) {
          // Add point to existing stroke
          setCurrentBrushStroke(prev => ({
            ...prev,
            points: [...prev.points, { x, y }]
          }));
        }
        
        // Draw the line
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    } else if (currentTool === 'line') {
      // Line tool - show preview line from first anchor to current mouse position
      if (currentLine && currentLine.points.length === 1) {
        // Clear and redraw to show preview
        redrawCanvasWithStrokes();
        
        // Draw preview line
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = brushColor === 'black' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)';
        ctx.setLineDash([5, 5]);
        
        ctx.beginPath();
        ctx.moveTo(currentLine.points[0].x, currentLine.points[0].y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (currentTool === 'lasso') {
      // CLEAN SINGLE DOTTED LINE PREVIEW
      if (currentPath && currentPath.points.length > 0) {
        // CLEAR previous preview first
        redrawCanvasWithStrokes();
        
        const lastPoint = currentPath.points[currentPath.points.length - 1];
        
        // Draw ONE clean dotted preview line
        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = brushColor === 'black' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.restore();
      }
    } else if (currentTool === 'rectangle') {
      // Rectangle tool - draw rectangle preview
      if (startPoint) {
        // Clear canvas and redraw everything
        redrawCanvasWithStrokes();
        
        // Draw rectangle preview with dotted line
        ctx.lineWidth = 2;
        ctx.strokeStyle = brushColor === 'black' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)';
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(startPoint.x, startPoint.y, x - startPoint.x, y - startPoint.y);
        ctx.setLineDash([]);
      }
    } else if (currentTool === 'circle') {
      // Circle tool - draw circle preview
      if (startPoint) {
        // Clear canvas and redraw everything
        redrawCanvasWithStrokes();
        
        // Calculate circle parameters
        const radius = Math.sqrt(Math.pow(x - startPoint.x, 2) + Math.pow(y - startPoint.y, 2));
        
        // Draw circle preview with dotted line
        ctx.lineWidth = 2;
        ctx.strokeStyle = brushColor === 'black' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)';
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.arc(startPoint.x, startPoint.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  };

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Use selectedImageUrl if available, otherwise fall back to imageUrl
    const displayImageUrl = selectedImageUrl || imageUrl;
    
    console.log('clearCanvas called with:', {
      selectedImageUrl,
      imageUrl,
      displayImageUrl,
      currentImageUrl: imgRef.current ? imgRef.current.src : null
    });
    
    // Check if we need to load a new image (different from what's currently loaded)
    const currentImageUrl = imgRef.current ? imgRef.current.src : null;
    const needsNewImage = !imgRef.current || currentImageUrl !== displayImageUrl;
    
    if (needsNewImage && displayImageUrl) {
      console.log('Loading new image:', displayImageUrl);
      // Load new image
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Add this to allow canvas operations
      img.onload = () => {
        console.log('Image loaded successfully:', displayImageUrl);
        imgRef.current = img;
        
        // Limit canvas size to 1024x1024 maximum at 100% zoom
        const maxSize = 1024;
        let canvasWidth, canvasHeight;
        
        if (img.naturalWidth > img.naturalHeight) {
          // Landscape or square image
          canvasWidth = Math.min(img.naturalWidth, maxSize);
          canvasHeight = (img.naturalHeight / img.naturalWidth) * canvasWidth;
        } else {
          // Portrait image
          canvasHeight = Math.min(img.naturalHeight, maxSize);
          canvasWidth = (img.naturalWidth / img.naturalHeight) * canvasHeight;
        }
        
        // Ensure neither dimension exceeds maxSize
        if (canvasWidth > maxSize) {
          canvasWidth = maxSize;
          canvasHeight = (img.naturalHeight / img.naturalWidth) * maxSize;
        }
        if (canvasHeight > maxSize) {
          canvasHeight = maxSize;
          canvasWidth = (img.naturalWidth / img.naturalHeight) * maxSize;
        }
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
        // Reset view to center the image
        resetView();
      };
      img.onerror = () => {
        console.warn('Failed to load image with crossOrigin, trying without...');
        // Fallback: try without crossOrigin if it fails
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          console.log('Fallback image loaded successfully:', displayImageUrl);
          imgRef.current = fallbackImg;
          
          // Limit canvas size to 1024x1024 maximum at 100% zoom
          const maxSize = 1024;
          let canvasWidth, canvasHeight;
          
          if (fallbackImg.naturalWidth > fallbackImg.naturalHeight) {
            // Landscape or square image
            canvasWidth = Math.min(fallbackImg.naturalWidth, maxSize);
            canvasHeight = (fallbackImg.naturalHeight / fallbackImg.naturalWidth) * canvasWidth;
          } else {
            // Portrait image
            canvasHeight = Math.min(fallbackImg.naturalHeight, maxSize);
            canvasWidth = (fallbackImg.naturalWidth / fallbackImg.naturalHeight) * canvasHeight;
          }
          
          // Ensure neither dimension exceeds maxSize
          if (canvasWidth > maxSize) {
            canvasWidth = maxSize;
            canvasHeight = (fallbackImg.naturalHeight / fallbackImg.naturalWidth) * maxSize;
          }
          if (canvasHeight > maxSize) {
            canvasHeight = maxSize;
            canvasWidth = (fallbackImg.naturalWidth / fallbackImg.naturalHeight) * maxSize;
          }
          
          canvas.width = canvasWidth;
          canvas.height = canvasHeight;
          ctx.drawImage(fallbackImg, 0, 0, canvasWidth, canvasHeight);
          // Reset view to center the image
          resetView();
        };
        fallbackImg.src = displayImageUrl;
      };
      img.src = displayImageUrl;
    } else if (imgRef.current) {
      console.log('Using existing image:', currentImageUrl);
      // Use existing image
      ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);
    }
  }, [selectedImageUrl, imageUrl]);

  // Separate function for redrawing canvas with strokes (used for undo/redo and tool changes)
  const redrawCanvasWithStrokes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the base image
    if (imgRef.current) {
      ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);
    }
    
    // Get current state and ensure lineStrokes are included
    const currentState = getCurrentState();
    
    // Redraw all strokes and selections
    if (redrawStrokesAndSelectionsRef.current) {
      redrawStrokesAndSelectionsRef.current(ctx, currentState);
    }
  }, [getCurrentState]);

  // Alternative function that takes explicit state to avoid timing issues
  const redrawCanvasWithExplicitState = useCallback((explicitState) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the base image
    if (imgRef.current) {
      ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);
    }
    
    // Redraw all strokes and selections with explicit state
    if (redrawStrokesAndSelectionsRef.current) {
      redrawStrokesAndSelectionsRef.current(ctx, explicitState);
    }
  }, []);

  // Function to clear all masks and reset to clean state
  const clearAllMasks = useCallback(() => {
    setBrushStrokes([]);
    setPenPaths([]);
    setCurrentPath(null);
    setLineStrokes([]);
    setCurrentLine(null);
    setCurrentBrushStroke(null);
    setEditingPoint(null);
    setIsDraggingPoint(false);
    setStartPoint(null);
    
    // Reset history to clean state
    const cleanState = {
      brushStrokes: [],
      penPaths: [],
      lineStrokes: []
    };
    setEditHistory([cleanState]);
    setHistoryIndex(0);
    
    // Redraw canvas with clean state
    redrawCanvasWithStrokes();
  }, [setBrushStrokes, setPenPaths, setCurrentPath, setLineStrokes, setCurrentLine, redrawCanvasWithStrokes]);

  // Redraw canvas when image changes (when user selects a different image)
  useEffect(() => {
    if (imageUrl || selectedImageUrl) {
      clearCanvas();
      // Don't call redrawCanvas here - clearCanvas already handles drawing the image
    }
  }, [imageUrl, selectedImageUrl, clearCanvas]);

  // Expose clearAllMasks function to parent component
  useEffect(() => {
    if (onClearMasks) {
      onClearMasks(clearAllMasks);
    }
  }, [onClearMasks, clearAllMasks]);



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

  const rewritePromptWithAI = async () => {
    if (!prompt.trim()) {
      setErrorModal({
        isOpen: true,
        title: 'Prompt Required',
        message: 'Please enter a prompt first before using AI assistance.',
        details: ''
      });
      return;
    }

    setIsRewritingPrompt(true);
    
    try {
      console.log('Sending prompt rewrite request:', { originalPrompt: prompt });
      
      const response = await fetch('/api/rewrite-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalPrompt: prompt
        })
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error(`Failed to rewrite prompt: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Received rewritten prompt:', data);
      setPrompt(data.rewrittenPrompt);
    } catch (error) {
      console.error('Error rewriting prompt:', error);
      setErrorModal({
        isOpen: true,
        title: 'AI Assistant Error',
        message: 'Failed to rewrite prompt. Please try again.',
        details: error.message
      });
    } finally {
      setIsRewritingPrompt(false);
    }
  };

  const handleComplete = () => {
    if (!prompt.trim()) {
      setErrorModal({
        isOpen: true,
        title: 'Prompt Required',
        message: 'Please enter a prompt describing what you want to add or modify.',
        details: ''
      });
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check if user has actually drawn anything using tools
    const hasUserDrawing = brushStrokes.length > 0 || penPaths.length > 0 || lineStrokes.length > 0;
    
    console.log('User drawing detection:', {
      brushStrokes: brushStrokes.length,
      penPaths: penPaths.length, 
      lineStrokes: lineStrokes.length,
      hasUserDrawing
    });

    if (!hasUserDrawing) {
      // No user drawing - use edit workflow (no mask)
      console.log('No user drawing detected - using edit workflow');
      console.log('Calling onComplete with:', { imageUrl, maskUrl: null, prompt });
      onComplete(imageUrl, null, prompt);
      return;
    }

    // User has drawn something - use inpaint workflow
    // Need to get canvas data for mask creation
    let imageData;
    try {
      imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    } catch (error) {
      console.error('Cross-origin error when accessing canvas data:', error);
      setErrorModal({
        isOpen: true,
        title: 'Canvas Error',
        message: 'Unable to process canvas data due to cross-origin restrictions. Please try refreshing the page or uploading the image again.',
        details: error.message
      });
      return;
    }
    
    let hasMask = false;
    let blackPixelCount = 0;
    const totalPixels = imageData.data.length / 4;
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      
      // Check if pixel is black (inpaint area) - more strict threshold
      if (r < 30 && g < 30 && b < 30) {
        blackPixelCount++;
      }
    }
    
    // Only consider it a mask if there are enough black pixels (more than 1% of total pixels)
    const blackPixelPercentage = (blackPixelCount / totalPixels) * 100;
    hasMask = blackPixelPercentage > 1;
    
    console.log(`Mask detection: ${blackPixelCount} black pixels out of ${totalPixels} total pixels (${blackPixelPercentage.toFixed(2)}%)`);

    if (hasMask) {
      // User has drawn a mask - use inpaint workflow
      console.log('Mask detected - using inpaint workflow');
      console.log('Calling onComplete with:', { imageUrl, maskUrl: 'will be created', prompt });
      
      // Create mask canvas
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
      const maskCtx = maskCanvas.getContext('2d');
      
      // Create black/white mask
      const maskData = maskCtx.createImageData(canvas.width, canvas.height);
      
      for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        
        // If pixel is black (inpaint area), make it black in mask
        if (r < 50 && g < 50 && b < 50) {
          maskData.data[i] = 0;     // R
          maskData.data[i + 1] = 0; // G
          maskData.data[i + 2] = 0; // B
          maskData.data[i + 3] = 255; // A
        } else {
          maskData.data[i] = 255;     // R
          maskData.data[i + 1] = 255; // G
          maskData.data[i + 2] = 255; // B
          maskData.data[i + 3] = 255; // A
        }
      }
      
      maskCtx.putImageData(maskData, 0, 0);
      
      // Convert to blob for upload
      maskCanvas.toBlob((blob) => {
        const maskUrl = URL.createObjectURL(blob);
        onComplete(imageUrl, maskUrl, prompt);
      }, 'image/png');
    } else {
      // No mask - use image edit workflow
      console.log('No mask detected - using image edit workflow');
      console.log('Calling onComplete with:', { imageUrl, maskUrl: null, prompt });
      onComplete(imageUrl, null, prompt);
    }
  };

  return (
    <div className="h-screen bg-[#1a1a1a] flex">
      {/* LEFT SIDEBAR - TOOLS */}
      <div className="w-80 bg-[#1e1e1e] border-r border-[#2d2d2d] flex flex-col shadow-xl">
        
        {/* SIDEBAR HEADER */}
        <div className="h-16 bg-[#2d2d2d] border-b border-[#3a3a3a] flex items-center px-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[#0d99ff] rounded-lg flex items-center justify-center">
              <Paintbrush className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">Decora.ai</h1>
              <p className="text-xs text-[#8e8e8e]">AI-Powered Inpainting</p>
            </div>
          </div>
        </div>

        {/* TOOLS PANEL */}
        <div className="flex-1 overflow-y-auto">
          
          {/* AI PROMPT SECTION */}
          <div className="p-6 border-b border-[#2d2d2d]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-[#3a3a3a] rounded flex items-center justify-center">
                  <Send className="w-3 h-3 text-[#8e8e8e]" />
                </div>
                <h3 className="text-sm font-semibold text-white">AI Prompt</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsPromptModalOpen(true)}
                  className="w-6 h-6 rounded flex items-center justify-center transition-all duration-200 border-2 bg-[#3a3a3a] border-transparent hover:bg-[#4a4a4a] hover:border-[#5a5a5a]"
                  title="Expand to full screen"
                >
                  <Maximize2 className="w-3 h-3 text-[#8e8e8e] hover:text-white" />
                </button>
                <button
                  onClick={() => setShowPromptTooltip(!showPromptTooltip)}
                  className={`w-6 h-6 rounded flex items-center justify-center transition-all duration-200 border-2 ${
                    showPromptTooltip 
                      ? 'bg-[#0d99ff]/20 border-[#0d99ff] hover:bg-[#0d99ff]/30 hover:border-[#0b87e6]' 
                      : 'bg-[#0d99ff]/10 border-transparent hover:bg-[#0d99ff]/20 hover:border-[#0d99ff]/50'
                  }`}
                >
                  <Lightbulb className={`w-3 h-3 transition-colors ${
                    showPromptTooltip ? 'text-white' : 'text-[#0d99ff] hover:text-white'
                  }`} />
                </button>
              </div>
            </div>
            
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you want to add, remove, or modify..."
                className="w-full h-32 px-4 py-3 bg-[#2d2d2d] border border-[#3a3a3a] rounded-lg text-sm text-white placeholder-[#8e8e8e] focus:outline-none focus:border-[#0d99ff] focus:ring-1 focus:ring-[#0d99ff] resize-none"
                disabled={isProcessing}
              />
              <button
                onClick={rewritePromptWithAI}
                disabled={isRewritingPrompt || !prompt.trim()}
                className={`absolute bottom-3 right-2 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl ${
                  isRewritingPrompt || !prompt.trim()
                    ? 'bg-gradient-to-br from-gray-400/30 via-gray-400/30 to-gray-400/30 cursor-not-allowed'
                    : 'bg-gradient-to-br from-purple-500/30 via-pink-500/30 to-blue-500/30 hover:from-purple-500 hover:via-pink-500 hover:to-blue-500 cursor-pointer'
                }`}
                title={isRewritingPrompt ? "Rewriting prompt..." : !prompt.trim() ? "Enter a prompt first" : "AI Assistant - Rewrite prompt for Flux"}
              >
                {isRewritingPrompt ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                ) : (
                  <Wand2 className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
            
            {/* AI Prompt Rewriting Status */}
            {isRewritingPrompt && (
              <div className="mt-3 p-3 bg-[#1a1a1a] rounded-lg border border-[#2d2d2d]">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#0d99ff] border-t-transparent"></div>
                  <p className="text-sm text-[#0d99ff] font-medium">
                    Optimizing your prompt for better results...
                  </p>
                </div>
                <p className="text-xs text-[#8e8e8e] mt-1 ml-6">
                  Our AI is enhancing your description to work better with Flux's image editing capabilities
                </p>
              </div>
            )}
            
            {/* PROMPT TOOLTIP */}
            {showPromptTooltip && (
              <div className="mt-4 p-4 bg-[#1a1a1a] rounded-lg border border-[#2d2d2d]">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-5 h-5 bg-[#0d99ff] rounded-full flex items-center justify-center">
                    <span className="text-xs text-white">💡</span>
                  </div>
                  <p className="text-xs text-[#0d99ff] font-semibold">Pro Tips</p>
                </div>
                <ul className="text-xs text-[#8e8e8e] space-y-1">
                  <li>• Be specific about materials and colors</li>
                  <li>• Mention lighting and style preferences</li>
                  <li>• Include positioning details</li>
                </ul>
              </div>
            )}
          </div>

          {/* TOOLS SECTION */}
          <div className="p-6 border-b border-[#2d2d2d]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-[#3a3a3a] rounded flex items-center justify-center">
                  <Paintbrush className="w-3 h-3 text-[#8e8e8e]" />
                </div>
                <h3 className="text-sm font-semibold text-white">Tools</h3>
              </div>
              <button
                onClick={() => setShowTooltip(!showTooltip)}
                className={`w-6 h-6 rounded flex items-center justify-center transition-all duration-200 border-2 ${
                  showTooltip 
                    ? 'bg-[#0d99ff]/20 border-[#0d99ff] hover:bg-[#0d99ff]/30 hover:border-[#0b87e6]' 
                    : 'bg-[#0d99ff]/10 border-transparent hover:bg-[#0d99ff]/20 hover:border-[#0d99ff]/50'
                }`}
              >
                <Lightbulb className={`w-3 h-3 transition-colors ${
                  showTooltip ? 'text-white' : 'text-[#0d99ff] hover:text-white'
                }`} />
              </button>
            </div>
            
            {/* TOOL SELECTOR */}
            <div className="space-y-3 mb-6">
              <label className="text-xs font-medium text-[#8e8e8e] uppercase tracking-wider">Tool</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    saveCurrentBrushStroke();
                    setCurrentTool('brush');
                    // Clear any current path when switching tools
                    setCurrentPath(null);
                  }}
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
                  onClick={() => {
                    saveCurrentBrushStroke();
                    setCurrentTool('grab');
                    // Clear any current path when switching tools
                    setCurrentPath(null);
                  }}
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
                  onClick={() => {
                    saveCurrentBrushStroke();
                    setCurrentTool('lasso');
                    // Clear any current path when switching to pen tool
                    setCurrentPath(null);
                  }}
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
                    saveCurrentBrushStroke();
                    setCurrentTool('rectangle');
                    // Clear any current path when switching tools
                    setCurrentPath(null);
                    setCurrentLine(null);
                  }}
                  className={`py-3 px-3 text-sm font-medium rounded-lg transition-all duration-200 flex flex-col items-center space-y-1 ${
                    currentTool === 'rectangle' 
                      ? 'bg-[#0d99ff] text-white shadow-lg' 
                      : 'bg-[#2d2d2d] text-[#8e8e8e] hover:bg-[#3a3a3a] hover:text-white'
                  }`}
                >
                  <Square className="w-4 h-4" />
                  <span className="text-xs">Rectangle</span>
                </button>
                <button
                  onClick={() => {
                    saveCurrentBrushStroke();
                    setCurrentTool('circle');
                    // Clear any current path when switching tools
                    setCurrentPath(null);
                    setCurrentLine(null);
                  }}
                  className={`py-3 px-3 text-sm font-medium rounded-lg transition-all duration-200 flex flex-col items-center space-y-1 ${
                    currentTool === 'circle' 
                      ? 'bg-[#0d99ff] text-white shadow-lg' 
                      : 'bg-[#2d2d2d] text-[#8e8e8e] hover:bg-[#3a3a3a] hover:text-white'
                  }`}
                >
                  <Circle className="w-4 h-4" />
                  <span className="text-xs">Circle</span>
                </button>
                <button
                  onClick={() => {
                    saveCurrentBrushStroke();
                    setCurrentTool('line');
                    // Clear any current path when switching tools
                    setCurrentPath(null);
                    setCurrentLine(null);
                  }}
                  className={`py-3 px-3 text-sm font-medium rounded-lg transition-all duration-200 flex flex-col items-center space-y-1 ${
                    currentTool === 'line' 
                      ? 'bg-[#0d99ff] text-white shadow-lg' 
                      : 'bg-[#2d2d2d] text-[#8e8e8e] hover:bg-[#3a3a3a] hover:text-white'
                  }`}
                >
                  <Minus className="w-4 h-4" />
                  <span className="text-xs">Line</span>
                </button>

              </div>
            </div>
            
            {/* TOOL-SPECIFIC INSTRUCTIONS */}
            {showTooltip && (
              <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#2d2d2d] mb-6">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-4 h-4 bg-[#0d99ff] rounded-full flex items-center justify-center">
                    <span className="text-xs text-white">💡</span>
                  </div>
                  <p className="text-xs text-[#0d99ff] font-semibold">
                    {currentTool === 'brush' ? 'Brush Tool' : currentTool === 'lasso' ? 'Anchor Tool' : currentTool === 'rectangle' ? 'Rectangle Tool' : currentTool === 'circle' ? 'Circle Tool' : 'Line Tool'}
                  </p>
                </div>
                <p className="text-xs text-[#8e8e8e]">
                  {currentTool === 'brush' 
                    ? `Click and drag to paint. ${brushColor === 'black' ? 'Black removes things from the image.' : 'White adds things to the image.'}`
                    : currentTool === 'lasso'
                    ? `Click to place anchor points. Click near the first point to close and fill the shape. Blue anchor points appear when shape is complete - click and drag to resize. ${brushColor === 'black' ? 'Drawn areas will be removed from the image.' : 'Drawn areas will be added to the image.'}`
                    : currentTool === 'rectangle'
                    ? `Click and drag to create a rectangle. Blue anchor points appear when complete - click and drag to resize. ${brushColor === 'black' ? 'Rectangle area will be removed from the image.' : 'Rectangle area will be added to the image.'}`
                    : currentTool === 'circle'
                    ? `Click and drag to create a circle. Blue anchor points appear when complete - click and drag to resize. ${brushColor === 'black' ? 'Circle area will be removed from the image.' : 'Circle area will be added to the image.'}`
                    : `Click to place first anchor, then click again to place second anchor and complete the line. ${brushColor === 'black' ? 'Line area will be removed from the image.' : 'Line area will be added to the image.'}`
                  }
                </p>
              </div>
            )}
            
            {/* BRUSH/LASSO/RECTANGLE/CIRCLE/LINE CONTROLS - Show when brush, lasso, rectangle, circle, or line tool is selected */}
            {(currentTool === 'brush' || currentTool === 'lasso' || currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'line') && (
              <>
                {/* MODE SELECTOR */}
                <div className="space-y-3 mb-6">
                  <label className="text-xs font-medium text-[#8e8e8e] uppercase tracking-wider">
                    Mode
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
                      <div className="w-4 h-4 bg-black rounded"></div>
                      <span>Remove</span>
                    </button>
                    <button
                      onClick={() => setBrushColor('white')}
                      className={`py-3 px-4 text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 ${
                        brushColor === 'white' 
                          ? 'bg-[#0d99ff] text-white shadow-lg' 
                          : 'bg-[#2d2d2d] text-[#8e8e8e] hover:bg-[#3a3a3a] hover:text-white'
                      }`}
                    >
                      <div className="w-4 h-4 bg-white rounded"></div>
                      <span>Keep</span>
                    </button>
                  </div>
                </div>

                {/* BRUSH SIZE */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between">
                                      <label className="text-xs font-medium text-[#8e8e8e] uppercase tracking-wider">
                    {currentTool === 'brush' ? 'Brush Size' : currentTool === 'lasso' ? 'Anchor Size' : currentTool === 'rectangle' ? 'Rectangle Size' : currentTool === 'circle' ? 'Circle Size' : 'Line Width'}
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


              </>
            )}

            {/* UNDO/REDO BUTTONS */}
            <div className="space-y-3 mb-6">
              <label className="text-xs font-medium text-[#8e8e8e] uppercase tracking-wider">History</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={undo}
                  disabled={historyIndex <= 0}
                  className={`py-3 px-3 text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 ${
                    historyIndex <= 0
                      ? 'bg-[#2d2d2d] text-[#666] cursor-not-allowed opacity-50'
                      : 'bg-[#2d2d2d] text-[#8e8e8e] hover:bg-[#3a3a3a] hover:text-white'
                  }`}
                  title="Undo (Ctrl+Z)"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Undo</span>
                </button>
                <button
                  onClick={redo}
                  disabled={historyIndex >= editHistory.length - 1}
                  className={`py-3 px-3 text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 ${
                    historyIndex >= editHistory.length - 1
                      ? 'bg-[#2d2d2d] text-[#666] cursor-not-allowed opacity-50'
                      : 'bg-[#2d2d2d] text-[#8e8e8e] hover:bg-[#3a3a3a] hover:text-white'
                  }`}
                  title="Redo (Ctrl+Y)"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>Redo</span>
                </button>
              </div>
            </div>

            {/* CLEAR BUTTON */}
            <button
              onClick={clearCanvas}
              className="w-full py-3 px-4 bg-[#2d2d2d] text-[#8e8e8e] rounded-lg text-sm font-medium hover:bg-[#3a3a3a] hover:text-white transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Clear Canvas</span>
            </button>
          </div>
        </div>

        {/* GENERATE BUTTON */}
        <div className="p-6 border-t border-[#2d2d2d] bg-[#1e1e1e]">
          <button
            onClick={handleComplete}
            disabled={isProcessing || !prompt.trim()}
            className={`w-full py-4 px-6 rounded-lg text-sm font-semibold transition-all duration-200 ${
              isProcessing || !prompt.trim()
                ? 'bg-[#2d2d2d] text-[#8e8e8e] cursor-not-allowed'
                : 'bg-gradient-to-r from-[#0d99ff] to-[#0b87e6] text-white hover:from-[#0b87e6] hover:to-[#0d99ff] shadow-lg hover:shadow-xl transform hover:scale-105'
            }`}
          >
            {isProcessing ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                <span>Processing with AI...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <Send className="w-4 h-4" />
                <span>Generate with ComfyUI</span>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* MAIN CANVAS AREA */}
      <div className="flex-1 flex flex-col bg-[#1a1a1a]">
        
        {/* TOP TOOLBAR */}
        <div className="h-16 bg-[#1e1e1e] border-b border-[#2d2d2d] flex items-center justify-between px-6">
          <div className="flex items-center space-x-6">
            <h2 className="text-lg font-semibold text-white">Canvas Editor</h2>
            <div className="h-6 w-px bg-[#2d2d2d]"></div>
            <div className="text-sm text-[#8e8e8e]">
              Tool: <span className="text-white font-medium capitalize">{currentTool}</span>
              {(currentTool === 'brush' || currentTool === 'lasso' || currentTool === 'rectangle' || currentTool === 'circle') ? (
                <>
                  {' • '}
                  Mode: <span className="text-white font-medium">
                    {brushColor === 'black' ? 'Remove' : 'Keep'}
                  </span>
                  {' • '}
                  Size: <span className="text-white font-medium">{brushSize}px</span>
                  {isShiftPressed && (
                    <>
                      {' • '}
                      <span className="text-[#0d99ff] font-medium">Straight Line</span>
                    </>
                  )}
                </>
              ) : null}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button 
              onClick={handleZoomOut}
              className="p-2 text-[#8e8e8e] hover:text-white hover:bg-[#2d2d2d] rounded-lg transition-all duration-200"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className={`text-sm font-medium px-2 ${
              pan.x !== 0 || pan.y !== 0 ? 'text-[#0d99ff]' : 'text-white'
            }`}>
              {Math.round(zoom * 100)}%
              {(pan.x !== 0 || pan.y !== 0) && <span className="text-xs ml-1">•</span>}
            </span>
            <button 
              onClick={handleZoomIn}
              className="p-2 text-[#8e8e8e] hover:text-white hover:bg-[#2d2d2d] rounded-lg transition-all duration-200"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button 
              onClick={resetView}
              className={`p-2 rounded-lg transition-all duration-200 ${
                zoom === 1 && pan.x === 0 && pan.y === 0
                  ? 'text-[#8e8e8e] bg-[#2d2d2d] cursor-not-allowed'
                  : 'text-[#0d99ff] hover:text-white hover:bg-[#2d2d2d]'
              }`}
              title={zoom === 1 && pan.x === 0 && pan.y === 0 ? "Already centered" : "Reset to center"}
              disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-[#2d2d2d] mx-2"></div>
            <button 
              onClick={undo}
              disabled={historyIndex <= 0}
              className={`p-2 rounded-lg transition-all duration-200 ${
                historyIndex <= 0
                  ? 'text-[#666] cursor-not-allowed'
                  : 'text-[#8e8e8e] hover:text-white hover:bg-[#2d2d2d]'
              }`}
              title={historyIndex <= 0 ? "Nothing to undo" : "Undo last edit"}
            >
              <Undo className="w-4 h-4" />
            </button>
            <button 
              onClick={redo}
              disabled={historyIndex >= editHistory.length - 1}
              className={`p-2 rounded-lg transition-all duration-200 ${
                historyIndex >= editHistory.length - 1
                  ? 'text-[#666] cursor-not-allowed'
                  : 'text-[#8e8e8e] hover:text-white hover:bg-[#2d2d2d]'
              }`}
              title={historyIndex >= editHistory.length - 1 ? "Nothing to redo" : "Redo last undone edit"}
            >
              <Redo className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-[#2d2d2d] mx-2"></div>
            <button className="p-2 text-[#8e8e8e] hover:text-white hover:bg-[#2d2d2d] rounded-lg transition-all duration-200">
              <Download className="w-4 h-4" />
            </button>
            <button className="p-2 text-[#8e8e8e] hover:text-white hover:bg-[#2d2d2d] rounded-lg transition-all duration-200">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CANVAS CONTAINER */}
        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
          <div className="bg-[#1e1e1e] rounded-xl border border-[#2d2d2d] overflow-hidden shadow-2xl w-full h-full relative">
            <div className="relative w-full h-full flex items-center justify-center">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseUp={(e) => {
                  if ((currentTool === 'rectangle' || currentTool === 'circle') && startPoint && !isDraggingPoint) {
                    // Check if there was actual dragging (not just a click)
                    const { x, y } = getCoordinates(e);
                    const distance = Math.sqrt(Math.pow(x - startPoint.x, 2) + Math.pow(y - startPoint.y, 2));
                    
                    if (distance > 5) { // Only create shape if dragged more than 5 pixels
                      if (currentTool === 'rectangle') {
                        // Complete rectangle
                        const newRectangle = {
                          points: [
                            { x: startPoint.x, y: startPoint.y },
                            { x: x, y: startPoint.y },
                            { x: x, y: y },
                            { x: startPoint.x, y: y }
                          ],
                          color: brushColor,
                          closed: true,
                          type: 'rectangle' // Mark as rectangle to hide anchors
                        };
                        
                        // Add rectangle as a filled shape
                        const newPenPaths = [...penPaths, newRectangle];
                        setPenPaths(newPenPaths);
                        
                        // IMMEDIATE redraw with the new rectangle
                        redrawCanvasWithExplicitState({
                          brushStrokes,
                          penPaths: newPenPaths,
                          lineStrokes,
                          currentPath: null
                        });
                        
                        // Save to history with the updated state
                        saveToHistory({
                          brushStrokes: brushStrokes,
                          penPaths: newPenPaths
                        });
                      } else if (currentTool === 'circle') {
                        // Complete circle
                        const radius = Math.sqrt(Math.pow(x - startPoint.x, 2) + Math.pow(y - startPoint.y, 2));
                        
                        // Create smooth circle with 32 points for drawing, but only 4 anchor points for editing
                        const circlePoints = [];
                        const numPoints = 32;
                        for (let i = 0; i < numPoints; i++) {
                          const angle = (i / numPoints) * 2 * Math.PI;
                          circlePoints.push({
                            x: startPoint.x + radius * Math.cos(angle),
                            y: startPoint.y + radius * Math.sin(angle)
                          });
                        }
                        
                        const newCircle = {
                          points: circlePoints,
                          color: brushColor,
                          closed: true,
                          type: 'circle' // Mark as circle
                        };
                        
                        // Add circle as a filled shape
                        const newPenPaths = [...penPaths, newCircle];
                        setPenPaths(newPenPaths);
                        
                        // IMMEDIATE redraw with the new circle
                        redrawCanvasWithExplicitState({
                          brushStrokes,
                          penPaths: newPenPaths,
                          lineStrokes,
                          currentPath: null
                        });
                        
                        // Save to history with the updated state
                        saveToHistory({
                          brushStrokes: brushStrokes,
                          penPaths: newPenPaths
                        });
                      }
                    }
                    
                    // Clear shape state
                    setIsDrawing(false);
                    setStartPoint(null);
                  } else {
                    // Call stopDrawing for all other tools (including when dragging anchor points)
                    stopDrawing();
                  }
                }}
                onMouseOut={(e) => {
                  if (currentTool !== 'rectangle' && currentTool !== 'circle') {
                    stopDrawing();
                  } else {
                    // Just reset drawing state for rectangle/circle tool
                    setIsDrawing(false);
                  }
                }}
                onMouseMove={draw}
                onDoubleClick={(e) => {
                  // Double-click functionality removed - pen tool uses single clicks
                }}
                className={`block ${
                  currentTool === 'brush' ? 'cursor-crosshair' :
                  currentTool === 'line' ? 'cursor-crosshair' :
                  currentTool === 'grab' && zoom > 1 ? 'cursor-grab' :
                  currentTool === 'grab' && zoom <= 1 ? 'cursor-not-allowed' :
                  currentTool === 'lasso' && isDraggingPoint ? 'cursor-grab' :
                  currentTool === 'lasso' ? 'cursor-crosshair' :
                  currentTool === 'rectangle' ? 'cursor-crosshair' :
                  currentTool === 'circle' ? 'cursor-crosshair' : 'cursor-default'
                }`}
                style={{ 
                  width: `${canvasRef.current?.width || 1024}px`, 
                  height: `${canvasRef.current?.height || 1024}px`,
                  transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease-in-out',
                  cursor: currentTool === 'grab' ? 'grab' : 'crosshair'
                }}
              />
            </div>
            
            {/* EMPTY STATE */}
            {!imageUrl && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]">
                <div className="text-center">
                  <div className="w-16 h-16 bg-[#2d2d2d] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Paintbrush className="w-8 h-8 text-[#8e8e8e]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Upload an Image</h3>
                  <p className="text-sm text-[#8e8e8e]">Start by uploading a room image to begin editing</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR - IMAGE HISTORY */}
      <TabbedSidebar
        originalImage={originalImageUrl}
        generatedImages={generatedImages}
        onSelectImage={(index) => {
          // Convert index to URL: -1 = original, 0+ = generated image
          const selectedUrl = index === -1 ? originalImageUrl : generatedImages[index]?.url;
          if (selectedUrl && onImageSelect) {
            onImageSelect(selectedUrl);
          }
        }}
        selectedImageIndex={selectedImageUrl === originalImageUrl ? -1 : generatedImages.findIndex(img => img.url === selectedImageUrl)}
        onResetToOriginal={() => onImageSelect && onImageSelect(originalImageUrl)}
        onSelectUpscaledImage={onSelectUpscaledImage}
        selectedUpscaledImageUrl={selectedUpscaledImageUrl}
      />
      
      {/* AI PROMPT MODAL */}
      {isPromptModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#2d2d2d]">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-[#0d99ff] rounded-lg flex items-center justify-center">
                  <Send className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">AI Prompt Editor</h2>
                  <p className="text-sm text-[#8e8e8e]">Write detailed instructions for your image transformation</p>
                </div>
              </div>
              <button
                onClick={() => setIsPromptModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#2d2d2d] hover:bg-[#3a3a3a] transition-colors"
              >
                <X className="w-4 h-4 text-[#8e8e8e] hover:text-white" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 p-6 overflow-hidden">
              <div className="h-full flex flex-col">
                {/* Prompt Input */}
                <div className="flex-1 mb-4">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe what you want to add, remove, or modify in detail. Be specific about materials, colors, lighting, positioning, and style preferences..."
                    className="w-full h-96 px-4 py-3 bg-[#2d2d2d] border border-[#3a3a3a] rounded-lg text-sm text-white placeholder-[#8e8e8e] focus:outline-none focus:border-[#0d99ff] focus:ring-1 focus:ring-[#0d99ff] resize-none"
                    disabled={isProcessing}
                  />
                </div>
                
                {/* AI Assistant Button */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={rewritePromptWithAI}
                    disabled={isRewritingPrompt || !prompt.trim()}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                      isRewritingPrompt || !prompt.trim()
                        ? 'bg-[#2d2d2d] text-[#8e8e8e] cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white cursor-pointer'
                    }`}
                    title={isRewritingPrompt ? "Rewriting prompt..." : !prompt.trim() ? "Enter a prompt first" : "AI Assistant - Rewrite prompt for Flux"}
                  >
                    {isRewritingPrompt ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    ) : (
                      <Wand2 className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">
                      {isRewritingPrompt ? "Optimizing..." : "AI Assistant"}
                    </span>
                  </button>
                  
                  <div className="text-xs text-[#8e8e8e]">
                    {prompt.length} characters
                  </div>
                </div>
                
                {/* AI Prompt Rewriting Status */}
                {isRewritingPrompt && (
                  <div className="mt-4 p-3 bg-[#0d99ff]/10 rounded-lg border border-[#0d99ff]/20">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#0d99ff] border-t-transparent"></div>
                      <p className="text-sm text-[#0d99ff] font-medium">
                        Optimizing your prompt for better results...
                      </p>
                    </div>
                    <p className="text-xs text-[#8e8e8e] mt-1 ml-6">
                      Our AI is enhancing your description to work better with Flux's image editing capabilities
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="flex items-center justify-between p-6 border-t border-[#2d2d2d]">
              <div className="text-sm text-[#8e8e8e]">
                💡 <strong>Pro Tips:</strong> Be specific about materials, colors, lighting, positioning, and style preferences
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setIsPromptModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-[#8e8e8e] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setIsPromptModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#0d99ff] hover:bg-[#0b87e6] rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

export default InpaintEditor;