import { useState, useRef } from 'react';
import type { PDFInfo } from '../types';

const pdfjsWorkerPromise = (async () => {
  const { GlobalWorkerOptions } = await import('pdfjs-dist');
  GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
})();

interface Props {
  onUpload: (info: PDFInfo, totalPages: number) => void;
  onClose: () => void;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export default function MarkSchemeModal({ onUpload, onClose }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFromBuffer = async (buffer: ArrayBuffer, filename: string) => {
    setLoading(true);
    setLoadingLabel('Loading mark scheme...');
    setError(null);

    try {
      await pdfjsWorkerPromise;
      const { getPDFPageCount } = await import('../utils/pdf');
      const blob = new Blob([buffer], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      const base64 = arrayBufferToBase64(buffer);
      const pages = await getPDFPageCount(blobUrl);
      const info: PDFInfo = { id: filename, filename, url: blobUrl, data: base64 };
      onUpload(info, pages);
    } catch (e: any) {
      setError(e.message || 'Failed to load mark scheme');
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      await loadFromBuffer(buffer, file.name);
    } catch (e: any) {
      setError(e.message || 'Failed to load mark scheme');
      setLoading(false);
    }
  };

  const handleUrl = async () => {
    const url = urlRef.current?.value?.trim();
    if (!url) {
      setError('Enter a mark scheme URL');
      return;
    }
    setLoading(true);
    setLoadingLabel('Downloading mark scheme...');
    setError(null);

    try {
      const res = await fetch(`/api/fetch-pdf?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to fetch PDF' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const buffer = await res.arrayBuffer();
      const filename = url.split('/').pop() || 'markscheme.pdf';
      await loadFromBuffer(buffer, filename);
    } catch (e: any) {
      setError(e.message || 'Failed to load mark scheme from URL');
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h2>Mark Scheme</h2>
        <p className="subtitle">Upload a mark scheme PDF to use for grading</p>

        <div
          className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          onClick={() => inputRef.current?.click()}
        >
          {loading ? (
            <div className="uploading">
              <div className="spinner" />
              <p>{loadingLabel}</p>
            </div>
          ) : (
            <>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="12" y2="12" />
                <line x1="15" y1="15" x2="12" y2="12" />
              </svg>
              <p>Drop your mark scheme PDF here or click to browse</p>
            </>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          onChange={() => {
            const file = inputRef.current?.files?.[0];
            if (file) handleFile(file);
          }}
          hidden
        />

        <div className="url-input-row">
          <div className="url-input-wrapper">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <input
              ref={urlRef}
              type="text"
              placeholder="Or paste a mark scheme PDF URL"
              onKeyDown={(e) => { if (e.key === 'Enter') handleUrl(); }}
            />
          </div>
          <button type="button" className="btn-url-load" onClick={handleUrl} disabled={loading}>
            Load
          </button>
        </div>

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}