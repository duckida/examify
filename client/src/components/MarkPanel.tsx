import { useState, useCallback } from 'react';
import type { MarkResult, MarkRecord, PDFInfo, DrawingPath, TextBoxData } from '../types';
import Markdown from 'react-markdown';
import ScoreSection from './ScoreSection';

interface Props {
  onMark: (imageBase64: string, questionContext?: string) => void;
  marking: boolean;
  markError: string | null;
  markResult: MarkResult | null;
  marks: MarkRecord[];
  currentPage: number;
  hasAnnotations: boolean;
  markSchemeInfo: PDFInfo | null;
  markSchemeTotalPages: number;
  parsedMarkSchemeText: string | null;
  parsingMarkScheme: boolean;
  parseError: string | null;
  onRetryParse: () => void;
  onAddMarkScheme: () => void;
  pdfData?: string;
  pageDimensions: { width: number; height: number };
  drawings: DrawingPath[];
  textBoxes: TextBoxData[];
}

type PanelTab = 'mark' | 'scheme';

export default function MarkPanel({
  onMark, marking, markError, markResult, marks,
  currentPage, hasAnnotations,
  markSchemeInfo, markSchemeTotalPages,
  parsedMarkSchemeText, parsingMarkScheme, parseError, onRetryParse, onAddMarkScheme,
  pdfData, pageDimensions, drawings, textBoxes,
}: Props) {
  const [activeTab, setActiveTab] = useState<PanelTab>('mark');
  const [showMarkScheme, setShowMarkScheme] = useState(false);
  const [context, setContext] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const captureAndMark = useCallback(async () => {
    if (!pdfData) return;

    setCapturing(true);
    setCaptureError(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      // Render the PDF page on the server
      const renderRes = await fetch('/api/render-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfData, pageNumber: currentPage }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!renderRes.ok) {
        const err = await renderRes.json();
        throw new Error(err.error || 'Failed to render page');
      }
      const { image: renderedBase64 } = await renderRes.json();

      // Load the rendered image onto a canvas and composite drawings
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load rendered image'));
        img.src = `data:image/png;base64,${renderedBase64}`;
      });

      // Scale factor: pdf-to-img renders at scale 2, so image is 2x page dimensions
      const scale = img.width / pageDimensions.width;
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      // Replay drawings scaled to match the rendered image size
      for (const path of drawings) {
        if (path.points.length < 2) continue;
        for (let i = 1; i < path.points.length; i++) {
          const from = path.points[i - 1];
          const to = path.points[i];
          ctx.beginPath();
          ctx.strokeStyle = path.color;
          ctx.lineWidth = (to.w ?? from.w ?? path.width) * scale;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.moveTo(from.x * scale, from.y * scale);
          ctx.lineTo(to.x * scale, to.y * scale);
          ctx.stroke();
        }
      }

      // Render text boxes onto the image
      for (const box of textBoxes) {
        if (!box.text.trim()) continue;
        const bx = box.x * scale;
        const by = box.y * scale;
        const bw = box.width * scale;
        const bh = box.height * scale;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 2 * scale;
        ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle = box.color;
        ctx.font = `${box.fontSize * scale}px sans-serif`;
        ctx.textBaseline = 'top';
        const pad = 4 * scale;
        const lineH = box.fontSize * scale * 1.4;
        const lines = box.text.split('\n');
        let lineY = by + pad;
        for (const line of lines) {
          ctx.fillText(line, bx + pad, lineY);
          lineY += lineH;
        }
      }

      const base64 = canvas.toDataURL('image/png').split(',')[1];

      setCapturing(false);
      onMark(base64, context || undefined);
    } catch (err: any) {
      setCapturing(false);
      const msg = err.name === 'AbortError'
        ? 'Rendering timed out. The PDF page may be too complex or the server is overloaded.'
        : err.message || 'Failed to render page';
      setCaptureError(msg);
      console.error('Capture failed:', err);
    }
  }, [pdfData, currentPage, pageDimensions, drawings, textBoxes, onMark, context]);

  const isLoading = marking || capturing || parsingMarkScheme;

  return (
    <div className="mark-panel">
      <div className="mark-tabs" role="tablist" aria-label="Marking panel">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'mark'}
          className={`mark-tab ${activeTab === 'mark' ? 'active' : ''}`}
          onClick={() => setActiveTab('mark')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 11 12 14 22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          Mark for me
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'scheme'}
          className={`mark-tab ${activeTab === 'scheme' ? 'active' : ''}`}
          onClick={() => setActiveTab('scheme')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          View mark scheme
        </button>
      </div>

      {activeTab === 'mark' ? (
        <div className="mark-tab-content">
          <ScoreSection marks={marks} />

          <div className="mark-controls">
            <textarea
              className="context-input"
              placeholder="Optional: add question context (e.g., 'This is a 5-mark question on photosynthesis')"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={2}
            />

            {markSchemeInfo && (
              <div className={`ms-badge ${parseError ? 'ms-badge-error' : ''}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {parsingMarkScheme
                  ? 'Parsing mark scheme...'
                  : parsedMarkSchemeText
                    ? 'Using mark scheme'
                    : parseError
                      ? `Parse failed: ${parseError}`
                      : 'Mark scheme loaded (not parsed)'}
              </div>
            )}

            {!parsedMarkSchemeText && markSchemeInfo && !parsingMarkScheme && (
              <div className="ms-warning">
                <span>
                  Mark scheme not parsed — marking will run without it.
                  {parseError ? '' : ' Click MS to re-upload.'}
                </span>
                <button type="button" className="ms-retry-btn" onClick={onRetryParse}>
                  Retry parsing
                </button>
              </div>
            )}

            <button
              className="btn-mark"
              onClick={captureAndMark}
              disabled={isLoading || !pdfData}
            >
              {isLoading ? (
                <>
                  <div className="spinner-small" />
                  {capturing ? 'Rendering page...' : 'Marking...'}
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  Mark page
                </>
              )}
            </button>
          </div>

          {markError && (
            <div className="mark-error">
              <strong>Error:</strong> {markError}
            </div>
          )}

          {captureError && (
            <div className="mark-error">
              <strong>Render Error:</strong> {captureError}
            </div>
          )}

          {markResult && (
            <div className="mark-result">
              <div className="result-header">
                <div className="result-score">
                  <span className="score-value">{markResult.score}</span>
                  <span className="score-divider">/</span>
                  <span className="score-total">{markResult.totalMarks}</span>
                </div>
                <div className="result-label">Marks Awarded</div>
              </div>

              {markResult.howToGainMarks && (
                <div className="result-how-to-gain">
                  <h4>How to gain the marks you missed</h4>
                  <Markdown>{markResult.howToGainMarks}</Markdown>
                </div>
              )}
              <div className="result-feedback">
                <h4>Feedback</h4>
                <Markdown>{markResult.feedback}</Markdown>
              </div>

              {markResult.breakdown && markResult.breakdown.length > 0 && (
                <div className="result-breakdown">
                  <h4>Breakdown</h4>
                  {markResult.breakdown.map((item, i) => (
                    <div key={i} className={`breakdown-item ${item.awarded ? 'awarded' : 'not-awarded'}`}>
                      <span className="breakdown-icon">{item.awarded ? '✓' : '✗'}</span>
                      <span className="breakdown-criterion">{item.criterion}</span>
                      <span className="breakdown-marks">{item.marks}/{item.marks}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="mark-tab-content mark-scheme-tab">
          {markSchemeInfo ? (
            <>
              <div className="ms-view-header">
                <div className="ms-view-meta">
                  <span className="ms-view-filename" title={markSchemeInfo.filename}>
                    {markSchemeInfo.filename}
                  </span>
                  {markSchemeTotalPages > 0 && (
                    <span className="ms-view-pages">{markSchemeTotalPages} pages</span>
                  )}
                </div>
                <button
                  type="button"
                  className={`btn-ms-toggle ${showMarkScheme ? 'active' : ''}`}
                  onClick={() => setShowMarkScheme(v => !v)}
                  aria-expanded={showMarkScheme}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {showMarkScheme ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                  {showMarkScheme ? 'Hide' : 'Show'} mark scheme
                </button>
              </div>

              {showMarkScheme && (
                <iframe
                  src={markSchemeInfo.url}
                  title="Mark scheme PDF"
                  className="ms-pdf-frame"
                />
              )}
            </>
          ) : (
            <div className="ms-empty">
              <p>No mark scheme added for this paper yet.</p>
              <button type="button" className="btn-mark" onClick={onAddMarkScheme}>
                Add mark scheme
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
