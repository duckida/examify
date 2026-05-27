import { useState, useCallback } from 'react';
import type { PDFInfo, PageAnnotations, MarkResult, MarkRecord } from './types';
import UploadPage from './components/UploadPage';
import PDFViewer from './components/PDFViewer';
import './App.css';

export default function App() {
  const [pdfInfo, setPDFInfo] = useState<PDFInfo | null>(null);
  const [markSchemeInfo, setMarkSchemeInfo] = useState<PDFInfo | null>(null);
  const [markSchemeTotalPages, setMarkSchemeTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [annotations, setAnnotations] = useState<Record<number, PageAnnotations>>({});
  const [marks, setMarks] = useState<MarkRecord[]>([]);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  const handleUploadComplete = useCallback((info: PDFInfo, pages: number) => {
    setPDFInfo(info);
    setTotalPages(pages);
    setCurrentPage(1);
    setMarkSchemeInfo(null);
    setMarkSchemeTotalPages(0);
    setAnnotations({});
    setMarks([]);
  }, []);

  const handleReset = useCallback(() => {
    setPDFInfo(null);
    setMarkSchemeInfo(null);
    setMarkSchemeTotalPages(0);
    setCurrentPage(1);
    setTotalPages(0);
    setAnnotations({});
    setMarks([]);
    setMarkError(null);
  }, []);

  const updateAnnotations = useCallback((page: number, ann: PageAnnotations) => {
    setAnnotations(prev => ({ ...prev, [page]: ann }));
  }, []);

  const handleMarkSchemeUpload = useCallback((info: PDFInfo, totalPages: number) => {
    setMarkSchemeInfo(info);
    setMarkSchemeTotalPages(totalPages);
  }, []);

  const handleMark = useCallback(
    async (imageBase64: string, questionContext?: string, markSchemeImages?: string[]) => {
      setMarking(true);
      setMarkError(null);
      try {
        const res = await fetch('/api/mark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: imageBase64,
            questionContext,
            markSchemeImages,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Marking failed');
        }
        const result: MarkResult = await res.json();
        const record: MarkRecord = { pageNumber: currentPage, result, timestamp: Date.now() };
        setMarks(prev => [...prev.filter(m => m.pageNumber !== currentPage), record]);
      } catch (e: any) {
        setMarkError(e.message);
      } finally {
        setMarking(false);
      }
    },
    [currentPage],
  );

  const currentMark = marks.find(m => m.pageNumber === currentPage)?.result ?? null;

  if (!pdfInfo) {
    return <UploadPage onUploadComplete={handleUploadComplete} />;
  }

  return (
    <PDFViewer
      pdfInfo={pdfInfo}
      markSchemeInfo={markSchemeInfo}
      markSchemeTotalPages={markSchemeTotalPages}
      onMarkSchemeUpload={handleMarkSchemeUpload}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={setCurrentPage}
      annotations={annotations[currentPage] || { drawings: [], textBoxes: [] }}
      onAnnotationsChange={(ann) => updateAnnotations(currentPage, ann)}
      onMark={handleMark}
      onReset={handleReset}
      marking={marking}
      markError={markError}
      markResult={currentMark}
    />
  );
}
