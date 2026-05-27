import { useState, useRef, type FormEvent } from 'react';
import type { PDFInfo } from '../types';

interface Props {
  onUploadComplete: (info: PDFInfo, totalPages: number) => void;
}

export default function UploadPage({ onUploadComplete }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }
    setUploading(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const blob = new Blob([buffer], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);

      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const numPages = pdf.numPages;
      pdf.destroy();

      const info: PDFInfo = { id: file.name, filename: file.name, url: blobUrl };
      onUploadComplete(info, numPages);
    } catch (e: any) {
      setError(e.message || 'Failed to load PDF');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (file) handleUpload(file);
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
              if (file) handleUpload(file);
            }}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <div className="uploading">
                <div className="spinner" />
                <p>Uploading...</p>
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
              if (file) handleUpload(file);
            }}
            hidden
          />
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </div>
  );
}
