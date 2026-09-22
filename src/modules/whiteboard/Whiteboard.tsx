import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  ButtonGroup,
  Button,
  Typography,
  Chip,
  useTheme,
} from '@mui/material';
import {
  Brush,
  CropSquare,
  RadioButtonUnchecked,
  HorizontalRule,
  TextFields,
  DeleteOutline,
  Undo,
  Download,
  ColorLens,
} from '@mui/icons-material';

interface Point {
  x: number;
  y: number;
}

interface Shape {
  id: string;
  type: 'brush' | 'rectangle' | 'circle' | 'line' | 'text';
  points: Point[];
  color: string;
  lineWidth: number;
  text?: string;
}

export const Whiteboard: React.FC<{ noteId?: string }> = ({ noteId }) => {
  const theme = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<'brush' | 'rectangle' | 'circle' | 'line'>('brush');
  const [color, setColor] = useState('#6366F1');
  const [lineWidth, setLineWidth] = useState(3);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [renderTick, setRenderTick] = useState(0);

  // Use refs for drawing state so native event handlers always see current values
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<Point[]>([]);
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const lineWidthRef = useRef(lineWidth);
  const shapesRef = useRef(shapes);

  // Keep refs in sync with state
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { lineWidthRef.current = lineWidth; }, [lineWidth]);
  useEffect(() => { shapesRef.current = shapes; }, [shapes]);

  const colors = ['#6366F1', '#A855F7', '#EC4899', '#10B981', '#F59E0B', '#F8FAFC'];

  // Redraw all shapes on canvas
  const redrawFn = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw subtle grid pattern
    ctx.strokeStyle = theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
    ctx.lineWidth = 1;
    const gridSize = 24;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw saved shapes
    shapesRef.current.forEach((shape) => {
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (shape.type === 'brush' && shape.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }
        ctx.stroke();
      } else if (shape.type === 'rectangle' && shape.points.length >= 2) {
        const start = shape.points[0];
        const end = shape.points[1];
        ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
      } else if (shape.type === 'circle' && shape.points.length >= 2) {
        const start = shape.points[0];
        const end = shape.points[1];
        const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
        ctx.beginPath();
        ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (shape.type === 'line' && shape.points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        ctx.lineTo(shape.points[1].x, shape.points[1].y);
        ctx.stroke();
      }
    });

    // Draw active drawing shape
    const cp = currentPointsRef.current;
    if (isDrawingRef.current && cp.length > 0) {
      ctx.strokeStyle = colorRef.current;
      ctx.lineWidth = lineWidthRef.current;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (toolRef.current === 'brush') {
        ctx.beginPath();
        ctx.moveTo(cp[0].x, cp[0].y);
        for (let i = 1; i < cp.length; i++) {
          ctx.lineTo(cp[i].x, cp[i].y);
        }
        ctx.stroke();
      } else if (toolRef.current === 'rectangle' && cp.length >= 2) {
        const start = cp[0];
        const end = cp[cp.length - 1];
        ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
      } else if (toolRef.current === 'circle' && cp.length >= 2) {
        const start = cp[0];
        const end = cp[cp.length - 1];
        const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
        ctx.beginPath();
        ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (toolRef.current === 'line' && cp.length >= 2) {
        const start = cp[0];
        const end = cp[cp.length - 1];
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }
    }
  }, [theme.palette.mode]);

  useEffect(() => {
    redrawFn();
  }, [shapes, renderTick, redrawFn]);

  // Adjust canvas size to parent container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = canvas.parentElement?.clientHeight || 550;
      redrawFn();
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [redrawFn]);

  // --- Shared drawing logic ---
  const startDrawing = (point: Point) => {
    isDrawingRef.current = true;
    currentPointsRef.current = [point];
    setRenderTick((t) => t + 1);
  };

  const continueDrawing = (point: Point) => {
    if (!isDrawingRef.current) return;
    if (toolRef.current === 'brush') {
      currentPointsRef.current = [...currentPointsRef.current, point];
    } else {
      currentPointsRef.current = [currentPointsRef.current[0], point];
    }
    setRenderTick((t) => t + 1);
  };

  const finishDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const cp = currentPointsRef.current;
    if (cp.length > 1) {
      setShapes((prev) => [
        ...prev,
        {
          id: `shape-${Date.now()}`,
          type: toolRef.current,
          points: cp,
          color: colorRef.current,
          lineWidth: lineWidthRef.current,
        },
      ]);
    }
    currentPointsRef.current = [];
    setRenderTick((t) => t + 1);
  };

  // --- Mouse event handlers (React synthetic — fine for desktop) ---
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    startDrawing({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    continueDrawing({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseUp = () => {
    finishDrawing();
  };

  // --- Native touch event listeners with { passive: false } ---
  // React synthetic onTouch* events are registered as passive by default,
  // which silently ignores preventDefault() — the browser scrolls instead of drawing.
  // Native listeners with passive:false fix this.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getCoordsFromTouch = (e: TouchEvent): Point => {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0] || e.changedTouches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const point = getCoordsFromTouch(e);
      startDrawing(point);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const point = getCoordsFromTouch(e);
      continueDrawing(point);
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      finishDrawing();
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  const handleUndo = () => {
    setShapes((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setShapes([]);
  };

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '550px', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${theme.palette.divider}`, bgcolor: theme.palette.mode === 'dark' ? '#090D16' : '#FFFFFF' }}>
      {/* Floating Canvas Toolbar */}
      <Paper
        elevation={3}
        sx={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 0.8,
          borderRadius: '12px',
          backdropFilter: 'blur(16px)',
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(15, 22, 38, 0.85)' : 'rgba(255, 255, 255, 0.9)',
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <ButtonGroup size="small" variant="text">
          <Tooltip title="Freehand Brush">
            <IconButton
              size="small"
              color={tool === 'brush' ? 'primary' : 'default'}
              onClick={() => setTool('brush')}
            >
              <Brush fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Rectangle">
            <IconButton
              size="small"
              color={tool === 'rectangle' ? 'primary' : 'default'}
              onClick={() => setTool('rectangle')}
            >
              <CropSquare fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Circle">
            <IconButton
              size="small"
              color={tool === 'circle' ? 'primary' : 'default'}
              onClick={() => setTool('circle')}
            >
              <RadioButtonUnchecked fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Line">
            <IconButton
              size="small"
              color={tool === 'line' ? 'primary' : 'default'}
              onClick={() => setTool('line')}
            >
              <HorizontalRule fontSize="small" />
            </IconButton>
          </Tooltip>
        </ButtonGroup>

        <Box sx={{ width: '1px', height: 24, bgcolor: theme.palette.divider }} />

        {/* Color Palette Picker */}
        <Box sx={{ display: 'flex', gap: 0.6 }}>
          {colors.map((c) => (
            <Box
              key={c}
              onClick={() => setColor(c)}
              sx={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                bgcolor: c,
                cursor: 'pointer',
                border: color === c ? '2px solid #FFFFFF' : '1px solid rgba(255,255,255,0.2)',
                transform: color === c ? 'scale(1.2)' : 'none',
                transition: 'all 0.15s ease',
              }}
            />
          ))}
        </Box>

        <Box sx={{ width: '1px', height: 24, bgcolor: theme.palette.divider }} />

        <Tooltip title="Undo">
          <IconButton size="small" onClick={handleUndo}>
            <Undo fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Clear Canvas">
          <IconButton size="small" color="error" onClick={handleClear}>
            <DeleteOutline fontSize="small" />
          </IconButton>
        </Tooltip>
      </Paper>

      {/* HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block', touchAction: 'none' }}
      />
    </Box>
  );
};
