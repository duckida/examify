import { useRef, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import type { TextBoxData } from '../types';

interface Props {
  width: number;
  height: number;
  textBoxes: TextBoxData[];
  onTextBoxesChange: (boxes: TextBoxData[]) => void;
  enabled: boolean;
  addMode: boolean;
  drawMode: boolean;
}

let idCounter = 0;

export default function TextBoxes({
  width, height, textBoxes, onTextBoxesChange, enabled, addMode, drawMode,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleAddBox = useCallback((e: React.MouseEvent) => {
    if (!addMode) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const newBox: TextBoxData = {
      id: `text-${Date.now()}-${idCounter++}`,
      x: ((e.clientX - rect.left) / rect.width) * width,
      y: ((e.clientY - rect.top) / rect.height) * height,
      width: 200,
      height: 60,
      text: '',
      fontSize: 16,
      color: '#1e293b',
    };
    onTextBoxesChange([...textBoxes, newBox]);
  }, [addMode, textBoxes, width, height, onTextBoxesChange]);

  const updateBox = useCallback((id: string, updates: Partial<TextBoxData>) => {
    onTextBoxesChange(
      textBoxes.map(b => (b.id === id ? { ...b, ...updates } : b))
    );
  }, [textBoxes, onTextBoxesChange]);

  const deleteBox = useCallback((id: string) => {
    onTextBoxesChange(textBoxes.filter(b => b.id !== id));
  }, [textBoxes, onTextBoxesChange]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        cursor: addMode ? 'crosshair' : (drawMode ? 'default' : 'default'),
        pointerEvents: drawMode ? 'none' : 'auto',
      }}
      onClick={handleAddBox}
    >
      {textBoxes.map((box) => (
        <Rnd
          key={box.id}
          size={{ width: box.width, height: box.height }}
          position={{ x: box.x, y: box.y }}
          onDragStop={(_, d) => updateBox(box.id, { x: d.x, y: d.y })}
          onResizeStop={(_, dir, ref, delta, position) => {
            updateBox(box.id, {
              width: ref.offsetWidth,
              height: ref.offsetHeight,
              x: position.x,
              y: position.y,
            });
          }}
          disableDragging={!enabled}
          enableResizing={enabled}
          bounds="parent"
          style={{
            background: 'rgba(255, 255, 255, 0.85)',
            border: '2px solid var(--primary)',
            borderRadius: 4,
            padding: 4,
          }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <textarea
              value={box.text}
              onChange={(e) => updateBox(box.id, { text: e.target.value })}
              placeholder="Type answer..."
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                resize: 'none',
                background: 'transparent',
                fontSize: box.fontSize,
                color: box.color,
                padding: 2,
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.4,
              }}
            />
            {enabled && (
              <button
                onClick={(e) => { e.stopPropagation(); deleteBox(box.id); }}
                style={{
                  position: 'absolute',
                  top: -10,
                  right: -10,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: '1px solid var(--error)',
                  background: 'white',
                  color: 'var(--error)',
                  fontSize: 12,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            )}
          </div>
        </Rnd>
      ))}
    </div>
  );
}
