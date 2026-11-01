import { useRef, useEffect, useCallback } from 'react';
import type { DrawingPath, DrawingPoint } from '../types';

interface Props {
  width: number;
  height: number;
  drawings: DrawingPath[];
  onDrawingsChange: (drawings: DrawingPath[]) => void;
  enabled: boolean;
  color: string;
  erasing?: boolean;
}

const BASE_WIDTH = 3;
const MIN_PRESSURE_WIDTH = 0.6;
const MAX_PRESSURE_WIDTH = 10;

function findStrokeAt(drawings: DrawingPath[], x: number, y: number, threshold = 12): number | null {
  for (let i = drawings.length - 1; i >= 0; i--) {
    const path = drawings[i];
    for (const pt of path.points) {
      // Wider (high-pressure) strokes get a wider hit area.
      const radius = Math.max(threshold, (pt.w ?? path.width) / 2 + 4);
      if (Math.hypot(pt.x - x, pt.y - y) <= radius) return i;
    }
  }
  return null;
}

/** A finger pans the page; pen, mouse and unknown pointers draw. */
function isFinger(e: React.PointerEvent): boolean {
  return e.pointerType === 'touch';
}

/**
 * Stylus erasing: a held barrel button (bit 2), a dedicated eraser tip
 * (bit 32), or a device reporting the `eraser` pointer type.
 */
function isEraseGesture(e: React.PointerEvent): boolean {
  // React's typings omit "eraser" even though browsers report it.
  const pointerType: string = e.pointerType;
  if (pointerType === 'eraser') return true;
  if (pointerType !== 'pen') return false;
  return (e.buttons & 2) !== 0 || (e.buttons & 32) !== 0;
}

/**
 * Map stylus pressure (0–1) onto a stroke width. Mouse and touch report a
 * constant pressure, so they keep the base width.
 */
function widthForPressure(pointerType: string, pressure: number): number {
  if (pointerType !== 'pen') return BASE_WIDTH;
  if (pressure <= 0) return BASE_WIDTH;
  const scaled = BASE_WIDTH * (0.35 + 1.3 * pressure);
  return Math.min(MAX_PRESSURE_WIDTH, Math.max(MIN_PRESSURE_WIDTH, scaled));
}

function strokeSegment(
  ctx: CanvasRenderingContext2D,
  from: DrawingPoint,
  to: DrawingPoint,
  color: string,
) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = to.w ?? from.w ?? BASE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function redrawAll(
  ctx: CanvasRenderingContext2D,
  drawings: DrawingPath[],
  width: number,
  height: number,
) {
  ctx.clearRect(0, 0, width, height);
  for (const path of drawings) {
    if (path.points.length < 2) continue;
    for (let i = 1; i < path.points.length; i++) {
      strokeSegment(ctx, path.points[i - 1], path.points[i], path.color);
    }
  }
}

export default function DrawingCanvas({
  width, height, drawings, onDrawingsChange, enabled, color, erasing,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPath = useRef<DrawingPoint[]>([]);
  const pathId = useRef(0);
  // Latched on pointerdown so a barrel press mid-stroke can't flip modes.
  const strokeMode = useRef<'draw' | 'erase' | null>(null);
  // One-finger pan state for touch input.
  const pan = useRef<{ x: number; y: number; el: HTMLElement } | null>(null);
  const drawingsRef = useRef(drawings);
  drawingsRef.current = drawings;

  // Repaint when the committed drawings change. Skipped during an in-progress
  // ink stroke so a parent re-render can't wipe the live segments.
  useEffect(() => {
    if (strokeMode.current === 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    redrawAll(ctx, drawings, width, height);
  }, [drawings, width, height]);

  const toPagePoint = useCallback((
    clientX: number,
    clientY: number,
    pointerType: string,
    pressure: number,
  ): DrawingPoint => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (width / rect.width),
      y: (clientY - rect.top) * (height / rect.height),
      w: widthForPressure(pointerType, pressure),
    };
  }, [width, height]);

  const eraseAt = useCallback((x: number, y: number) => {
    const current = drawingsRef.current;
    const idx = findStrokeAt(current, x, y);
    if (idx === null) return;
    const next = current.filter((_, i) => i !== idx);
    drawingsRef.current = next;
    onDrawingsChange(next);
  }, [onDrawingsChange]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!enabled) return;

    // A finger pans the page rather than leaving ink; a pen or mouse draws.
    if (isFinger(e)) {
      const el = e.currentTarget.closest('.page-container') as HTMLElement | null;
      if (el) {
        pan.current = { x: e.clientX, y: e.clientY, el };
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      return;
    }

    // Only the primary button starts an ink stroke; barrelled pen presses erase.
    if (e.pointerType !== 'pen' && e.button !== 0) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const pos = toPagePoint(e.clientX, e.clientY, e.pointerType, e.pressure);

    if (erasing || isEraseGesture(e)) {
      strokeMode.current = 'erase';
      eraseAt(pos.x, pos.y);
      return;
    }

    strokeMode.current = 'draw';
    currentPath.current = [pos];
  }, [enabled, erasing, toPagePoint, eraseAt]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!enabled) return;

    if (isFinger(e)) {
      const p = pan.current;
      if (!p) return;
      p.el.scrollLeft -= e.clientX - p.x;
      p.el.scrollTop -= e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      return;
    }

    if (!strokeMode.current) return;
    e.preventDefault();

    if (strokeMode.current === 'erase') {
      const pos = toPagePoint(e.clientX, e.clientY, e.pointerType, e.pressure);
      eraseAt(pos.x, pos.y);
      return;
    }

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // Stylus samples arrive in coalesced batches. Replaying each one keeps fast
    // handwriting smooth instead of polygonal.
    const native = e.nativeEvent;
    const coalesced: PointerEvent[] | undefined =
      typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : undefined;
    const batch = coalesced && coalesced.length > 0 ? coalesced : [native];

    const pts = currentPath.current;
    for (const sample of batch) {
      const pos = toPagePoint(
        sample.clientX,
        sample.clientY,
        sample.pointerType || e.pointerType,
        sample.pressure,
      );
      const prev = pts[pts.length - 1];
      if (prev && Math.hypot(pos.x - prev.x, pos.y - prev.y) < 0.5) continue;
      if (prev) strokeSegment(ctx, prev, pos, color);
      pts.push(pos);
    }
  }, [enabled, color, toPagePoint, eraseAt]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (pan.current) {
      pan.current = null;
      return;
    }

    const mode = strokeMode.current;
    if (mode === null) return;
    strokeMode.current = null;

    if (mode === 'erase') {
      // Repaint so cleared strokes disappear immediately.
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) redrawAll(ctx, drawingsRef.current, width, height);
      return;
    }

    if (currentPath.current.length < 2) {
      currentPath.current = [];
      return;
    }

    const points = currentPath.current;
    const newPath: DrawingPath = {
      id: `draw-${Date.now()}-${pathId.current++}`,
      points,
      color,
      width: points[0].w ?? BASE_WIDTH,
    };
    onDrawingsChange([...drawingsRef.current, newPath]);
    currentPath.current = [];
  }, [color, width, height, onDrawingsChange]);

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
          cursor: enabled ? (erasing ? 'cell' : 'crosshair') : 'default',
          // Touch panning is handled manually while drawing is active so a pen
          // is never mistaken for a scroll gesture. Otherwise let the browser
          // scroll the page normally.
          touchAction: enabled ? 'none' : 'auto',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
        onContextMenu={(e) => {
          // A stylus barrel click also fires contextmenu; don't pop the menu.
          if (enabled) e.preventDefault();
        }}
      />
      {drawings.length > 0 && enabled && !erasing && (
        <button
          onClick={handleUndo}
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 12,
            color: 'var(--color-text-secondary)',
          }}
          title="Undo last stroke"
        >
          Undo
        </button>
      )}
    </div>
  );
}
