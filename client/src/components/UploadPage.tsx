import { useState, useRef, type FormEvent } from 'react';
import type { PDFInfo } from '../types';

interface Props {
  onUploadComplete: (info: PDFInfo, totalPages: number) => void;
}

const pdfjsWorkerPromise = (async () => {
  const { GlobalWorkerOptions } = await import('pdfjs-dist');
  GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
})();

async function getPDFPageCountFromBuffer(buffer: ArrayBuffer): Promise<number> {
  await pdfjsWorkerPromise;
  const pdfjsLib = await import('pdfjs-dist');
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const numPages = pdf.numPages;
  pdf.destroy();
  return numPages;
}

export default function UploadPage({ onUploadComplete }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('Loading...');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  const loadPDFFromBuffer = async (buffer: ArrayBuffer, filename: string) => {
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    const numPages = await getPDFPageCountFromBuffer(buffer);
    const info: PDFInfo = { id: filename, filename, url: blobUrl };
    onUploadComplete(info, numPages);
  };

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }
    setLoading(true);
    setLoadingLabel('Loading PDF...');
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      await loadPDFFromBuffer(buffer, file.name);
    } catch (e: any) {
      setError(e.message || 'Failed to load PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleURL = async () => {
    const url = urlRef.current?.value?.trim();
    if (!url) {
      setError('Enter a PDF URL');
      return;
    }
    setLoading(true);
    setLoadingLabel('Downloading PDF...');
    setError(null);

    try {
      const res = await fetch(`/api/fetch-pdf?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to fetch PDF' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const buffer = await res.arrayBuffer();
      const filename = url.split('/').pop() || 'document.pdf';
      await loadPDFFromBuffer(buffer, filename);
    } catch (e: any) {
      setError(e.message || 'Failed to load PDF from URL');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (file) handleFile(file);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleURL();
  };

  return (
    <div className="upload-page">
      <div className="upload-card">
        <h1>Examify</h1>
        <p className="subtitle">AI-powered past paper marking</p>
        <form onSubmit={onSubmit}>
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
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="12" y2="12" />
                  <line x1="15" y1="15" x2="12" y2="12" />
                </svg>
                <p>Drop your PDF here or click to browse</p>
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
                placeholder="Or paste a PDF URL and press Enter"
                onKeyDown={handleKeyDown}
              />
            </div>
            <button type="button" className="btn-url-load" onClick={handleURL} disabled={loading}>
              Load
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </div>
  );
}
