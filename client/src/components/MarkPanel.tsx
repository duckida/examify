import { useState, useCallback, type RefObject } from 'react';
import type { MarkResult, PDFInfo } from '../types';

interface Props {
  onMark: (imageBase64: string, questionContext?: string, markSchemeImages?: string[]) => void;
  marking: boolean;
  markError: string | null;
  markResult: MarkResult | null;
  pageRef: RefObject<HTMLDivElement | null>;
  currentPage: number;
  hasAnnotations: boolean;
  markSchemeInfo: PDFInfo | null;
  markSchemeTotalPages: number;
}

export default function MarkPanel({
  onMark, marking, markError, markResult, pageRef,
  currentPage, hasAnnotations,
  markSchemeInfo, markSchemeTotalPages,
}: Props) {
  const [context, setContext] = useState('');
  const [capturing, setCapturing] = useState(false);

  const captureAndMark = useCallback(async () => {
    const wrapper = pageRef.current?.querySelector('.page-wrapper') as HTMLElement | null;
    if (!wrapper) return;

    setCapturing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(wrapper, {
        useCORS: true,
        scale: 2,
        backgroundColor: '#ffffff',
      });
      const base64 = canvas.toDataURL('image/png').split(',')[1];

      // If mark scheme is loaded, render ALL pages
      let msImages: string[] | undefined;
      if (markSchemeInfo && markSchemeTotalPages > 0) {
        msImages = [];
        const { renderPDFPageToBase64 } = await import('../utils/pdf');
        const maxWidth = 800;
        for (let p = 1; p <= markSchemeTotalPages; p++) {
          try {
            const img = await renderPDFPageToBase64(markSchemeInfo.url, p, maxWidth);
            msImages.push(img);
          } catch (err) {
            console.error(`Failed to render mark scheme page ${p}:`, err);
          }
        }
        if (msImages.length === 0) msImages = undefined;
      }

      setCapturing(false);
      onMark(base64, context || undefined, msImages);
    } catch (err: any) {
      setCapturing(false);
      console.error('Capture failed:', err);
    }
  }, [pageRef, onMark, context, markSchemeInfo, markSchemeTotalPages]);

  const isLoading = marking || capturing;

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
            Mark scheme loaded ({markSchemeTotalPages} pages)
          </div>
        )}

        <button
          className="btn-mark"
          onClick={captureAndMark}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <div className="spinner-small" />
              {capturing ? 'Capturing page...' : 'Marking...'}
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
