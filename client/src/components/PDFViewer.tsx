import { useState, useEffect, useRef, useCallback } from 'react';
import type { PDFInfo, PageAnnotations, MarkResult, DrawingPath, TextBoxData } from '../types';
import DrawingCanvas from './DrawingCanvas';
import TextBoxes from './TextBoxes';
import MarkPanel from './MarkPanel';
import MarkSchemeModal from './MarkSchemeModal';

const pdfjsWorker = (async () => {
  const { GlobalWorkerOptions } = await import('pdfjs-dist');
  GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
})();

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
  onMark: (imageBase64: string, questionContext?: string, pageText?: string, textBoxesText?: string) => void;
  onReset: () => void;
  marking: boolean;
  markError: string | null;
  markResult: MarkResult | null;
  aiProvider: 'free' | 'hackclub';
  hackClubApiKey: string;
  onAiProviderChange: (provider: 'free' | 'hackclub') => void;
  onHackClubApiKeyChange: (key: string) => void;
  markingModel: string;
  parsingModel: string;
  onMarkingModelChange: (model: string) => void;
  onParsingModelChange: (model: string) => void;
  parsedMarkSchemeText: string | null;
  parsingMarkScheme: boolean;
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
  aiProvider, hackClubApiKey, onAiProviderChange, onHackClubApiKeyChange,
  markingModel, parsingModel, onMarkingModelChange, onParsingModelChange,
  parsedMarkSchemeText, parsingMarkScheme,
}: Props) {
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 });
  const [pageText, setPageText] = useState('');
  const [toolMode, setToolMode] = useState<ToolMode>('draw');
  const [drawColor, setDrawColor] = useState('#ef4444');
  const [zoom, setZoom] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showMsModal, setShowMsModal] = useState(false);
  const [pdfDocVersion, setPdfDocVersion] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const zoomIn = () => setZoom(z => Math.min(z + ZOOM_STEP, ZOOM_MAX));
  const zoomOut = () => setZoom(z => Math.max(z - ZOOM_STEP, ZOOM_MIN));
  const zoomReset = () => setZoom(1);

  // Load PDF document when URL changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await pdfjsWorker;
        const pdfjsLib = await import('pdfjs-dist');
        const res = await fetch(pdfInfo.url);
        const buffer = await res.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (cancelled) {
          pdf.destroy();
          return;
        }

        if (pdfDocRef.current) pdfDocRef.current.destroy();
        pdfDocRef.current = pdf;
        setPdfDocVersion(v => v + 1);
      } catch (err) {
        console.error('Failed to load PDF:', err);
      }
    })();
    return () => {
      cancelled = true;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [pdfInfo.url]);

  // Render the current PDF page to a canvas image and extract text
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdf = pdfDocRef.current;
      if (!pdf) return;

      try {
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

        // Extract text content from the page
        let extractedText = '';
        try {
          const textContent = await page.getTextContent();
          extractedText = textContent.items.map((item: any) => item.str).join(' ');
        } catch (textErr) {
          console.error('Failed to extract page text:', textErr);
        }

        if (!cancelled) {
          setPageImage(canvas.toDataURL());
          setPageDimensions({ width: viewport.width, height: viewport.height });
          setPageText(extractedText);
        }
      } catch (err) {
        console.error('Failed to render PDF page:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [currentPage, pdfDocVersion]);

  // Close settings dropdown on outside click
  useEffect(() => {
    if (!showSettings) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSettings]);

  const handleDrawingChange = useCallback((drawings: DrawingPath[]) => {
    onAnnotationsChange({ ...annotations, drawings });
  }, [annotations, onAnnotationsChange]);

  const handleTextBoxesChange = useCallback((textBoxes: TextBoxData[]) => {
    onAnnotationsChange({ ...annotations, textBoxes });
  }, [annotations, onAnnotationsChange]);

  const handleMsModalUpload = useCallback((info: PDFInfo, totalPages: number) => {
    onMarkSchemeUpload(info, totalPages);
    setShowMsModal(false);
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

          <button
            className={`btn-ms-upload ${markSchemeInfo ? 'active' : ''}`}
            onClick={() => setShowMsModal(true)}
            title={markSchemeInfo ? 'Replace mark scheme' : 'Upload mark scheme'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="12" y2="12" />
              <line x1="15" y1="15" x2="12" y2="12" />
            </svg>
            {markSchemeInfo ? `MS (${markSchemeTotalPages}p)` : 'MS'}
          </button>

          <div className="color-picker">
            <input
              type="color"
              value={drawColor}
              onChange={(e) => setDrawColor(e.target.value)}
              title="Drawing color"
            />
          </div>

          <div className="settings-container" ref={settingsRef}>
            <button
              className={`btn-settings ${showSettings ? 'active' : ''}`}
              onClick={() => setShowSettings(!showSettings)}
              title="AI Provider settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            {showSettings && (
              <div className="settings-dropdown">
                <div className="settings-header">AI Provider</div>
                <label className={`settings-option ${aiProvider === 'free' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="aiProvider"
                    value="free"
                    checked={aiProvider === 'free'}
                    onChange={() => onAiProviderChange('free')}
                  />
                  <span className="settings-option-label">Free endpoint</span>
                  <span className="settings-option-desc">Uses server-configured AI</span>
                </label>
                <label className={`settings-option ${aiProvider === 'hackclub' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="aiProvider"
                    value="hackclub"
                    checked={aiProvider === 'hackclub'}
                    onChange={() => onAiProviderChange('hackclub')}
                  />
                  <span className="settings-option-label">Hack Club AI</span>
                  <span className="settings-option-desc">Bring your own Hack Club AI API key</span>
                </label>
                {aiProvider === 'hackclub' && (
                  <div className="settings-api-key">
                    <input
                      type="password"
                      className="settings-key-input"
                      placeholder="Enter your Hack Club AI API key"
                      value={hackClubApiKey}
                      onChange={(e) => onHackClubApiKeyChange(e.target.value)}
                    />
                  </div>
                )}

                <div className="settings-divider" />

                {aiProvider === 'hackclub' && (
                  <>
                    <div className="settings-header">Models</div>
                    <div className="settings-field">
                      <label className="settings-field-label">Marking model</label>
                      <input
                        type="text"
                        className="settings-key-input"
                        placeholder="qwen/qwen3.6-flash"
                        value={markingModel}
                        onChange={(e) => onMarkingModelChange(e.target.value)}
                      />
                      <span className="settings-field-desc">Model used for marking answers</span>
                    </div>
                    <div className="settings-field">
                      <label className="settings-field-label">Parsing model</label>
                      <input
                        type="text"
                        className="settings-key-input"
                        placeholder="qwen/qwen3.6-flash"
                        value={parsingModel}
                        onChange={(e) => onParsingModelChange(e.target.value)}
                      />
                      <span className="settings-field-desc">Model used for extracting mark scheme text</span>
                    </div>
                  </>
                )}
              </div>
            )}
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
          onMark={(imageBase64, context) => {
            const textBoxesText = annotations.textBoxes
              .map(b => b.text)
              .filter(t => t.trim())
              .join('\n\n');
            onMark(imageBase64, context, pageText, textBoxesText || undefined);
          }}
          marking={marking}
          markError={markError}
          markResult={markResult}
          currentPage={currentPage}
          hasAnnotations={annotations.drawings.length > 0 || annotations.textBoxes.length > 0}
          markSchemeInfo={markSchemeInfo}
          markSchemeTotalPages={markSchemeTotalPages}
          parsedMarkSchemeText={parsedMarkSchemeText}
          parsingMarkScheme={parsingMarkScheme}
          pdfData={pdfInfo.data}
          pageDimensions={pageDimensions}
          drawings={annotations.drawings}
          textBoxes={annotations.textBoxes}
        />
      </div>

      {showMsModal && (
        <MarkSchemeModal
          onUpload={handleMsModalUpload}
          onClose={() => setShowMsModal(false)}
        />
      )}
    </div>
  );
}
