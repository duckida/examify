import { useState, useEffect, useRef, useCallback } from 'react';
import type { PDFInfo, PageAnnotations, MarkResult, DrawingPath, TextBoxData } from '../types';
import DrawingCanvas from './DrawingCanvas';
import TextBoxes from './TextBoxes';
import MarkPanel from './MarkPanel';

interface Props {
  pdfInfo: PDFInfo;
  markSchemeInfo: PDFInfo | null;
  markSchemeTotalPages: number;
  onMarkSchemeUpload: (info: PDFInfo, totalPages: number) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  annotations: PageAnnotations;
  onAnnotationsChange: (ann: PageAnnotations) => void;
  onMark: (imageBase64: string, questionContext?: string, markSchemeImages?: string[]) => void;
  onReset: () => void;
  marking: boolean;
  markError: string | null;
  markResult: MarkResult | null;
}

type ToolMode = 'draw' | 'text' | 'select';

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;

export default function PDFViewer({
  pdfInfo, markSchemeInfo, markSchemeTotalPages, onMarkSchemeUpload,
  currentPage, totalPages, onPageChange,
  annotations, onAnnotationsChange,
  onMark, onReset, marking, markError, markResult,
}: Props) {
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 });
  const [toolMode, setToolMode] = useState<ToolMode>('draw');
  const [drawColor, setDrawColor] = useState('#ef4444');
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const msInputRef = useRef<HTMLInputElement>(null);

  const zoomIn = () => setZoom(z => Math.min(z + ZOOM_STEP, ZOOM_MAX));
  const zoomOut = () => setZoom(z => Math.max(z - ZOOM_STEP, ZOOM_MIN));
  const zoomReset = () => setZoom(1);

  // Render the current PDF page to a canvas image
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const res = await fetch(pdfInfo.url);
        const buffer = await res.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        const page = await pdf.getPage(currentPage);

        const container = containerRef.current;
        const maxWidth = container ? container.clientWidth - 48 : 800;
        const scale = maxWidth / page.getViewport({ scale: 1 }).width;
        const viewport = page.getViewport({ scale });

        if (cancelled) return;

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width * 2;
        canvas.height = viewport.height * 2;
        const ctx = canvas.getContext('2d')!;
        ctx.scale(2, 2);
        await page.render({ canvasContext: ctx, viewport }).promise;

        if (!cancelled) {
          setPageImage(canvas.toDataURL());
          setPageDimensions({ width: viewport.width, height: viewport.height });
        }
      } catch (err) {
        console.error('Failed to render PDF page:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [pdfInfo.url, currentPage]);

  const handleDrawingChange = useCallback((drawings: DrawingPath[]) => {
    onAnnotationsChange({ ...annotations, drawings });
  }, [annotations, onAnnotationsChange]);

  const handleTextBoxesChange = useCallback((textBoxes: TextBoxData[]) => {
    onAnnotationsChange({ ...annotations, textBoxes });
  }, [annotations, onAnnotationsChange]);

  const handleMarkSchemeFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const info: PDFInfo = await res.json();

      const { getPDFPageCount } = await import('../utils/pdf');
      const pages = await getPDFPageCount(info.url);
      onMarkSchemeUpload(info, pages);
    } catch (err) {
      console.error('Failed to upload mark scheme:', err);
    }
  }, [onMarkSchemeUpload]);

  return (
    <div className="pdf-viewer-layout">
      <div className="toolbar">
        <div className="toolbar-left">
          <button className="btn-icon" onClick={onReset} title="Upload new PDF">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </button>
          <span className="file-name">{pdfInfo.filename}</span>

          <div className="toolbar-divider" />

          <div className="zoom-controls">
            <button className="btn-zoom" onClick={zoomOut} title="Zoom out" disabled={zoom <= ZOOM_MIN}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <button className="btn-zoom-label" onClick={zoomReset} title="Reset zoom">
              {Math.round(zoom * 100)}%
            </button>
            <button className="btn-zoom" onClick={zoomIn} title="Zoom in" disabled={zoom >= ZOOM_MAX}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="toolbar-center">
          <button
            className={`btn-page ${currentPage <= 1 ? 'disabled' : ''}`}
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            ←
          </button>
          <span className="page-indicator">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className={`btn-page ${currentPage >= totalPages ? 'disabled' : ''}`}
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            →
          </button>
        </div>

        <div className="toolbar-right">
          <div className="tool-group">
            <button
              className={`btn-tool ${toolMode === 'draw' ? 'active' : ''}`}
              onClick={() => setToolMode('draw')}
              title="Draw"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="M2 2l7.586 7.586" />
                <circle cx="11" cy="11" r="2" />
              </svg>
            </button>
            <button
              className={`btn-tool ${toolMode === 'text' ? 'active' : ''}`}
              onClick={() => setToolMode('text')}
              title="Add text box"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="4 7 4 4 20 4 20 7" />
                <line x1="9" y1="20" x2="15" y2="20" />
                <line x1="12" y1="4" x2="12" y2="20" />
              </svg>
            </button>
            <button
              className={`btn-tool ${toolMode === 'select' ? 'active' : ''}`}
              onClick={() => setToolMode('select')}
              title="Select / move"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                <path d="M13 13l6 6" />
              </svg>
            </button>
          </div>

          <div className="toolbar-divider" />

          {!markSchemeInfo ? (
            <button
              className="btn-ms-upload"
              onClick={() => msInputRef.current?.click()}
              title="Upload mark scheme"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="12" y2="12" />
                <line x1="15" y1="15" x2="12" y2="12" />
              </svg>
              Mark Scheme
            </button>
          ) : (
            <div className="ms-loaded-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              MS ({markSchemeTotalPages}p)
              <button
                className="ms-replace"
                onClick={() => msInputRef.current?.click()}
                title="Replace mark scheme"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </button>
            </div>
          )}
          <input
            ref={msInputRef}
            type="file"
            accept=".pdf"
            onChange={handleMarkSchemeFile}
            hidden
          />

          <div className="color-picker">
            <input
              type="color"
              value={drawColor}
              onChange={(e) => setDrawColor(e.target.value)}
              title="Drawing color"
            />
          </div>
        </div>
      </div>

      <div className="pdf-content">
        <div className="page-container" ref={containerRef}>
          {pageImage && (
            <div
              style={{
                width: pageDimensions.width * zoom,
                height: pageDimensions.height * zoom,
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <div
                className="page-wrapper"
                style={{
                  width: pageDimensions.width,
                  height: pageDimensions.height,
                  position: 'relative',
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                }}
              >
                <img
                  src={pageImage}
                  alt={`Page ${currentPage}`}
                  style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
                />
                <DrawingCanvas
                  width={pageDimensions.width}
                  height={pageDimensions.height}
                  drawings={annotations.drawings}
                  onDrawingsChange={handleDrawingChange}
                  enabled={toolMode === 'draw'}
                  color={drawColor}
                />
                <TextBoxes
                  width={pageDimensions.width}
                  height={pageDimensions.height}
                  textBoxes={annotations.textBoxes}
                  onTextBoxesChange={handleTextBoxesChange}
                  enabled={toolMode === 'text' || toolMode === 'select'}
                  addMode={toolMode === 'text'}
                  drawMode={toolMode === 'draw'}
                />
              </div>
            </div>
          )}
        </div>

        <MarkPanel
          onMark={(imageBase64, context, msImages) => onMark(imageBase64, context, msImages)}
          marking={marking}
          markError={markError}
          markResult={markResult}
          pageRef={containerRef}
          currentPage={currentPage}
          hasAnnotations={annotations.drawings.length > 0 || annotations.textBoxes.length > 0}
          markSchemeInfo={markSchemeInfo}
          markSchemeTotalPages={markSchemeTotalPages}
        />
      </div>
    </div>
  );
}
