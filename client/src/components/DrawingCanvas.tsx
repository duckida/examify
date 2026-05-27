import { useRef, useEffect, useCallback, useState } from 'react';
import type { DrawingPath } from '../types';

interface Props {
  width: number;
  height: number;
  drawings: DrawingPath[];
  onDrawingsChange: (drawings: DrawingPath[]) => void;
  enabled: boolean;
  color: string;
}

export default function DrawingCanvas({
  width, height, drawings, onDrawingsChange, enabled, color,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentPath = useRef<{ x: number; y: number }[]>([]);
  const pathId = useRef(0);

  // Redraw all paths whenever they change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    for (const path of drawings) {
      if (path.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    }
  }, [drawings, width, height]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (width / rect.width),
      y: (e.clientY - rect.top) * (height / rect.height),
    };
  };

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!enabled) return;
    setIsDrawing(true);
    currentPath.current = [getPos(e)];
  }, [enabled]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !enabled) return;
    const pos = getPos(e);
    currentPath.current.push(pos);

    // Draw incrementally
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pts = currentPath.current;
    if (pts.length < 2) return;
    const last = pts[pts.length - 2];
    const curr = pts[pts.length - 1];
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
  }, [isDrawing, enabled, color]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPath.current.length < 2) return;

    const newPath: DrawingPath = {
      id: `draw-${Date.now()}-${pathId.current++}`,
      points: currentPath.current,
      color,
      width: 3,
    };
    onDrawingsChange([...drawings, newPath]);
    currentPath.current = [];
  }, [isDrawing, drawings, color, onDrawingsChange]);

  const handleUndo = useCallback(() => {
    if (drawings.length === 0) return;
    onDrawingsChange(drawings.slice(0, -1));
  }, [drawings, onDrawingsChange]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width, height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: enabled ? 'crosshair' : 'default',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      {drawings.length > 0 && enabled && (
        <button
          onClick={handleUndo}
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}
          title="Undo last stroke"
        >
          Undo
        </button>
      )}
    </div>
  );
}
