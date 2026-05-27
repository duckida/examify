import { useState, useCallback } from 'react';
import type { MarkResult, PDFInfo, DrawingPath } from '../types';

interface Props {
  onMark: (imageBase64: string, questionContext?: string) => void;
  marking: boolean;
  markError: string | null;
  markResult: MarkResult | null;
  currentPage: number;
  hasAnnotations: boolean;
  markSchemeInfo: PDFInfo | null;
  markSchemeTotalPages: number;
  parsedMarkSchemeText: string | null;
  parsingMarkScheme: boolean;
  pdfData?: string;
  pageDimensions: { width: number; height: number };
  drawings: DrawingPath[];
}

export default function MarkPanel({
  onMark, marking, markError, markResult,
  currentPage, hasAnnotations,
  markSchemeInfo, markSchemeTotalPages,
  parsedMarkSchemeText, parsingMarkScheme,
  pdfData, pageDimensions, drawings,
}: Props) {
  const [context, setContext] = useState('');
  const [capturing, setCapturing] = useState(false);

  const captureAndMark = useCallback(async () => {
    if (!pdfData) return;

    setCapturing(true);
    try {
      // Render the PDF page on the server
      const renderRes = await fetch('/api/render-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfData, pageNumber: currentPage }),
      });
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
        ctx.beginPath();
        ctx.strokeStyle = path.color;
        ctx.lineWidth = path.width * scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(path.points[0].x * scale, path.points[0].y * scale);
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(path.points[i].x * scale, path.points[i].y * scale);
        }
        ctx.stroke();
      }

      const base64 = canvas.toDataURL('image/png').split(',')[1];

      setCapturing(false);
      onMark(base64, context || undefined);
    } catch (err: any) {
      setCapturing(false);
      console.error('Capture failed:', err);
    }
  }, [pdfData, currentPage, pageDimensions, drawings, onMark, context]);

  const isLoading = marking || capturing || parsingMarkScheme;

  return (
    <div className="mark-panel">
      <div className="mark-controls">
        <textarea
          className="context-input"
          placeholder="Optional: add question context (e.g., 'This is a 5-mark question on photosynthesis')"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={2}
        />

        {markSchemeInfo && (
          <div className="ms-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            {parsingMarkScheme ? 'Parsing mark scheme...' : parsedMarkSchemeText ? 'Mark scheme loaded & parsed' : 'Mark scheme loaded'}
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
              Mark {hasAnnotations ? 'Annotations' : 'Page'} (Page {currentPage})
            </>
          )}
        </button>
      </div>

      {markError && (
        <div className="mark-error">
          <strong>Error:</strong> {markError}
          <br />
          <small>Make sure to set the GOOGLE_GENERATIVE_AI_API_KEY environment variable on the server.</small>
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

          <div className="result-feedback">
            <h4>Feedback</h4>
            <p>{markResult.feedback}</p>
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
  );
}