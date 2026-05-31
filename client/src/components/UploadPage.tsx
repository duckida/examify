import { useState, useRef, useEffect, type FormEvent } from 'react';
import type { PDFInfo } from '../types';
import { getAllSavedSessionKeys, deleteSession, loadSessionAsync } from '../utils/storage';

interface Props {
  onUploadComplete: (info: PDFInfo, totalPages: number) => void;
  onRestoreSession: (session: {
    pdfInfo: PDFInfo;
    totalPages: number;
    currentPage: number;
    annotations: Record<number, any>;
    marks: any[];
    markSchemeInfo: PDFInfo | null;
    markSchemeTotalPages: number;
    parsedMarkSchemeText: string | null;
  }) => void;
  onImport: (file: File) => void;
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

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export default function UploadPage({ onUploadComplete, onRestoreSession, onImport }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('Loading...');
  const [error, setError] = useState<string | null>(null);
  const [savedPapers, setSavedPapers] = useState<{ key: string; filename: string }[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => importRef.current?.click();

  useEffect(() => {
    setSavedPapers(getAllSavedSessionKeys());
  }, []);

  const loadPDFFromBuffer = async (buffer: ArrayBuffer, filename: string) => {
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    const base64 = arrayBufferToBase64(buffer);
    const numPages = await getPDFPageCountFromBuffer(buffer);
    const info: PDFInfo = { id: filename, filename, url: blobUrl, data: base64 };
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

  const handleReopen = async (key: string) => {
    setOpening(key);
    setError(null);
    try {
      const session = await loadSessionAsync(key);
      if (session) {
        onRestoreSession(session);
      } else {
        setError('Failed to load saved session');
      }
    } catch {
      setError('Failed to load saved session');
    } finally {
      setOpening(null);
    }
  };

  const handleDelete = async (key: string, filename: string) => {
    if (!confirm(`Delete "${filename}"?`)) return;
    setDeleting(key);
    try {
      await deleteSession(key);
      setSavedPapers(prev => prev.filter(p => p.key !== key));
    } catch {
      setError('Failed to delete');
    } finally {
      setDeleting(null);
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

        <div className="upload-divider" />

        <div className="import-section">
          <h2>Import Session</h2>
          <button className="btn-import" onClick={handleImportClick}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Open .examify file
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".examify,application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImport(file);
              e.target.value = '';
            }}
          />
        </div>

        {savedPapers.length > 0 && (
          <div className="saved-papers">
            <h2>Saved Papers</h2>
            <ul className="saved-list">
              {savedPapers.map((paper) => (
                <li key={paper.key} className="saved-item">
                  <button
                    className="saved-name"
                    onClick={() => handleReopen(paper.key)}
                    disabled={opening === paper.key || deleting === paper.key}
                    title="Open this paper"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    {opening === paper.key ? 'Loading...' : paper.filename}
                  </button>
                  <button
                    className="saved-delete"
                    onClick={() => handleDelete(paper.key, paper.filename)}
                    disabled={opening === paper.key || deleting === paper.key}
                    title="Delete this paper"
                  >
                    {deleting === paper.key ? (
                      <div className="spinner-tiny" />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
