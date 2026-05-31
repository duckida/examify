import { useRef, useCallback, useState } from 'react';
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleAddBox = useCallback((e: React.MouseEvent) => {
    if (!addMode) return;
    const container = containerRef.current;
    if (!container) return;

    // .page-wrapper is an ancestor element, climb up to find it
    const pageWrapper = container.closest('.page-wrapper');
    // The inner content container is the overflow-hidden div wrapping .page-wrapper
    const innerContainer = pageWrapper?.parentElement;
    if (!innerContainer) return;
    const innerRect = innerContainer.getBoundingClientRect();

    const newBox: TextBoxData = {
      id: `text-${Date.now()}-${idCounter++}`,
      x: ((e.clientX - innerRect.left) / innerRect.width) * width,
      y: ((e.clientY - innerRect.top) / innerRect.height) * height,
      width: 200,
      height: 60,
      text: '',
      fontSize: 16,
      color: '#1e293b',
    };
    onTextBoxesChange([...textBoxes, newBox]);
    setSelectedId(newBox.id);
  }, [addMode, textBoxes, width, height, onTextBoxesChange]);

  const updateBox = useCallback((id: string, updates: Partial<TextBoxData>) => {
    onTextBoxesChange(
      textBoxes.map(b => (b.id === id ? { ...b, ...updates } : b))
    );
  }, [textBoxes, onTextBoxesChange]);

  const deleteBox = useCallback((id: string) => {
    onTextBoxesChange(textBoxes.filter(b => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [textBoxes, onTextBoxesChange, selectedId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, id: string) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId === id) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' && (target as HTMLTextAreaElement).value) {
        return;
      }
      e.preventDefault();
      deleteBox(id);
    }
  }, [deleteBox, selectedId]);

  const handleRndClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
  }, []);

  const handleSelectNone = useCallback(() => {
    setSelectedId(null);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        cursor: addMode ? 'crosshair' : 'default',
        pointerEvents: drawMode ? 'none' : 'auto',
      }}
      onClick={addMode ? handleAddBox : handleSelectNone}
    >
      {textBoxes.map((box) => {
        const isSelected = selectedId === box.id;
        return (
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
              border: isSelected ? '2px solid var(--color-primary)' : '2px solid transparent',
              borderRadius: 4,
              padding: 4,
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e: React.MouseEvent) => {
              if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)';
            }}
            onMouseLeave={(e: React.MouseEvent) => {
              if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
            }}
            onClick={(e: React.MouseEvent) => handleRndClick(e, box.id)}
          >
            <div
              style={{ position: 'relative', width: '100%', height: '100%' }}
              onKeyDown={(e) => handleKeyDown(e, box.id)}
            >
              <textarea
                value={box.text}
                onChange={(e) => updateBox(box.id, { text: e.target.value })}
                onFocus={() => setSelectedId(box.id)}
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
              <button
                onClick={(e) => { e.stopPropagation(); deleteBox(box.id); }}
                title="Delete text box"
                style={{
                  position: 'absolute',
                  top: -10,
                  right: -10,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: 'none',
                  background: '#ef4444',
                  color: 'white',
                  fontSize: 16,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  opacity: isSelected ? 1 : 0.6,
                  transition: 'opacity 0.15s, transform 0.15s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = '1';
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = isSelected ? '1' : '0.6';
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                }}
              >
                ×
              </button>
            </div>
          </Rnd>
        );
      })}
    </div>
  );
}
