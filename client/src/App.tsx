import { useState, useCallback, useRef } from 'react';
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
  const [aiProvider, setAiProvider] = useState<'free' | 'hackclub'>(
    () => (localStorage.getItem('aiProvider') as 'free' | 'hackclub') || 'free',
  );
  const [hackClubApiKey, setHackClubApiKey] = useState(
    () => localStorage.getItem('hackClubApiKey') || '',
  );

  const [markingModel, setMarkingModel] = useState(
    () => localStorage.getItem('markingModel') || '',
  );
  const [parsingModel, setParsingModel] = useState(
    () => localStorage.getItem('parsingModel') || '',
  );

  const [parsedMarkSchemeText, setParsedMarkSchemeText] = useState<string | null>(null);
  const [parsingMarkScheme, setParsingMarkScheme] = useState(false);

  const pdfUrlRef = useRef<string | null>(null);
  const msUrlRef = useRef<string | null>(null);

  const handleUploadComplete = useCallback((info: PDFInfo, pages: number) => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    if (msUrlRef.current) URL.revokeObjectURL(msUrlRef.current);
    pdfUrlRef.current = info.url;
    msUrlRef.current = null;
    setPDFInfo(info);
    setTotalPages(pages);
    setCurrentPage(1);
    setMarkSchemeInfo(null);
    setMarkSchemeTotalPages(0);
    setParsedMarkSchemeText(null);
    setAnnotations({});
    setMarks([]);
  }, []);

  const handleReset = useCallback(() => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    if (msUrlRef.current) URL.revokeObjectURL(msUrlRef.current);
    pdfUrlRef.current = null;
    msUrlRef.current = null;
    setPDFInfo(null);
    setMarkSchemeInfo(null);
    setMarkSchemeTotalPages(0);
    setParsedMarkSchemeText(null);
    setCurrentPage(1);
    setTotalPages(0);
    setAnnotations({});
    setMarks([]);
    setMarkError(null);
  }, []);

  const updateAnnotations = useCallback((page: number, ann: PageAnnotations) => {
    setAnnotations(prev => ({ ...prev, [page]: ann }));
  }, []);

  const handleMarkSchemeUpload = useCallback(async (info: PDFInfo, totalPages: number) => {
    if (msUrlRef.current) URL.revokeObjectURL(msUrlRef.current);
    msUrlRef.current = info.url;
    setMarkSchemeInfo(info);
    setMarkSchemeTotalPages(totalPages);

    if (info.data) {
      setParsingMarkScheme(true);
      setParsedMarkSchemeText(null);
      try {
        const res = await fetch('/api/parse-mark-scheme', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            markSchemePdf: info.data,
            aiProvider,
            hackClubApiKey: aiProvider === 'hackclub' ? hackClubApiKey : undefined,
            model: parsingModel || undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setParsedMarkSchemeText(data.text);
        } else {
          const err = await res.json();
          console.error('Failed to parse mark scheme:', err.error);
        }
      } catch (err) {
        console.error('Failed to parse mark scheme:', err);
      } finally {
        setParsingMarkScheme(false);
      }
    }
  }, [aiProvider, hackClubApiKey, parsingModel]);

  const handleMark = useCallback(
    async (imageBase64: string, questionContext?: string, pageText?: string) => {
      setMarking(true);
      setMarkError(null);
      try {
        const res = await fetch('/api/mark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: imageBase64,
            pageText,
            questionContext,
            parsedMarkSchemeText,
            aiProvider,
            hackClubApiKey: aiProvider === 'hackclub' ? hackClubApiKey : undefined,
            markingModel: markingModel || undefined,
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
    [currentPage, aiProvider, hackClubApiKey, parsedMarkSchemeText, markingModel],
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
      marking={marking || parsingMarkScheme}
      markError={markError}
      markResult={currentMark}
      aiProvider={aiProvider}
      hackClubApiKey={hackClubApiKey}
      onAiProviderChange={(p) => {
        setAiProvider(p);
        localStorage.setItem('aiProvider', p);
      }}
      onHackClubApiKeyChange={(key) => {
        setHackClubApiKey(key);
        localStorage.setItem('hackClubApiKey', key);
      }}
      markingModel={markingModel}
      parsingModel={parsingModel}
      onMarkingModelChange={(m) => {
        setMarkingModel(m);
        localStorage.setItem('markingModel', m);
      }}
      onParsingModelChange={(m) => {
        setParsingModel(m);
        localStorage.setItem('parsingModel', m);
      }}
      parsedMarkSchemeText={parsedMarkSchemeText}
      parsingMarkScheme={parsingMarkScheme}
    />
  );
}
