import React, { useRef, useState, useEffect } from 'react';
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
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);

  const colors = ['#6366F1', '#A855F7', '#EC4899', '#10B981', '#F59E0B', '#F8FAFC'];

  // Redraw all shapes on canvas
  const redraw = () => {
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
    shapes.forEach((shape) => {
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
    if (isDrawing && currentPoints.length > 0) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (tool === 'brush') {
        ctx.beginPath();
        ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
        for (let i = 1; i < currentPoints.length; i++) {
          ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
        }
        ctx.stroke();
      } else if (tool === 'rectangle' && currentPoints.length >= 2) {
        const start = currentPoints[0];
        const end = currentPoints[currentPoints.length - 1];
        ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
      } else if (tool === 'circle' && currentPoints.length >= 2) {
        const start = currentPoints[0];
        const end = currentPoints[currentPoints.length - 1];
        const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
        ctx.beginPath();
        ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (tool === 'line' && currentPoints.length >= 2) {
        const start = currentPoints[0];
        const end = currentPoints[currentPoints.length - 1];
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }
    }
  };

  useEffect(() => {
    redraw();
  }, [shapes, isDrawing, currentPoints, theme.palette.mode]);

  // Adjust canvas size to parent container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = canvas.parentElement?.clientHeight || 550;
      redraw();
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasCoords(e);
    setIsDrawing(true);
    setCurrentPoints([point]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const point = getCanvasCoords(e);
    if (tool === 'brush') {
      setCurrentPoints((prev) => [...prev, point]);
    } else {
      setCurrentPoints((prev) => [prev[0], point]);
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPoints.length > 1) {
      setShapes((prev) => [
        ...prev,
        {
          id: `shape-${Date.now()}`,
          type: tool,
          points: currentPoints,
          color,
          lineWidth,
        },
      ]);
    }
    setCurrentPoints([]);
  };

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
        style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block' }}
      />
    </Box>
  );
};
