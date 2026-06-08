import { useState, useCallback, useRef, useEffect } from 'react';
import type { PDFInfo, PageAnnotations, MarkResult, MarkRecord } from './types';
import UploadPage from './components/UploadPage';
import PDFViewer from './components/PDFViewer';
import { saveSession, loadSessionAsync, clearLastSessionKey } from './utils/storage';
import { arrayBufferToBase64, getPDFPageCountFromBuffer } from './utils/pdf';
import { track } from './utils/analytics';
import './App.css';

const PARSE_TIMEOUT_MS = 130000;

export default function App() {
  const [loading, setLoading] = useState(true);
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
  const [enableReasoning, setEnableReasoning] = useState(
    () => localStorage.getItem('enableReasoning') !== 'false',
  );
  const [darkMode, setDarkMode] = useState<'light' | 'dark'>(
    () => {
      const saved = localStorage.getItem('darkMode');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    },
  );
  const [parsedMarkSchemeText, setParsedMarkSchemeText] = useState<string | null>(null);
  const [parsingMarkScheme, setParsingMarkScheme] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Apply dark mode class and update theme-color meta tag
  useEffect(() => {
    const html = document.documentElement;
    if (darkMode === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', darkMode === 'dark' ? '#111111' : '#FEE500');
  }, [darkMode]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const saved = localStorage.getItem('darkMode');
      if (!saved) {
        setDarkMode(e.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleDarkModeChange = useCallback((mode: 'light' | 'dark') => {
    setDarkMode(mode);
    localStorage.setItem('darkMode', mode);
  }, []);

  const pdfUrlRef = useRef<string | null>(null);
  const msUrlRef = useRef<string | null>(null);
  const parseAbortRef = useRef<AbortController | null>(null);

  // Handle /import?qp=...&ms=... route
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qp = params.get('qp');
    const ms = params.get('ms');
    if (!window.location.pathname.startsWith('/import') || !qp) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const fetches: Promise<Response>[] = [
          fetch(`/api/fetch-pdf?url=${encodeURIComponent(qp)}`),
        ];
        if (ms) fetches.push(fetch(`/api/fetch-pdf?url=${encodeURIComponent(ms)}`));
        const [qpRes, msRes] = await Promise.all(fetches);

        if (!qpRes.ok) {
          const err = await qpRes.json().catch(() => ({ error: 'Failed to fetch PDF' }));
          throw new Error(err.error || `HTTP ${qpRes.status}`);
        }

        const [qpBuffer, msBuffer] = await Promise.all([
          qpRes.arrayBuffer(),
          msRes?.ok ? msRes.arrayBuffer() : Promise.resolve(null),
        ]);

        if (cancelled) return;

        // Load question paper
        const qpBlob = new Blob([qpBuffer], { type: 'application/pdf' });
        const qpUrl = URL.createObjectURL(qpBlob);
        const qpBase64 = arrayBufferToBase64(qpBuffer);
        const qpFilename = qp.split('/').pop() || 'question-paper.pdf';
        const qpPages = await getPDFPageCountFromBuffer(qpBuffer);
        const qpInfo: PDFInfo = { id: qpFilename, filename: qpFilename, url: qpUrl, data: qpBase64 };

        if (cancelled) return;

        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
        if (msUrlRef.current) URL.revokeObjectURL(msUrlRef.current);
        if (parseAbortRef.current) parseAbortRef.current.abort();
        pdfUrlRef.current = qpUrl;
        msUrlRef.current = null;
        setPDFInfo(qpInfo);
        setTotalPages(qpPages);
        setCurrentPage(1);
        setAnnotations({});
        setMarks([]);
        setParsedMarkSchemeText(null);
        setParseError(null);

        // Load mark scheme if provided
        if (ms && msBuffer) {
          const msBlob = new Blob([msBuffer], { type: 'application/pdf' });
          const msUrl = URL.createObjectURL(msBlob);
          const msBase64 = arrayBufferToBase64(msBuffer);
          const msPages = await getPDFPageCountFromBuffer(msBuffer);
          const msFilename = ms.split('/').pop() || 'mark-scheme.pdf';
          const msInfo: PDFInfo = { id: msFilename, filename: msFilename, url: msUrl, data: msBase64 };

          if (cancelled) return;
          msUrlRef.current = msUrl;
          setMarkSchemeInfo(msInfo);
          setMarkSchemeTotalPages(msPages);
        }

        // Clean up URL
        window.history.replaceState({}, '', '/');
        setLoading(false);
      } catch (e: any) {
        setMarkError(`Import failed: ${e.message}`);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Restore session from IndexedDB on mount
  useEffect(() => {
    // If we're on the /import route, skip session restore — import effect handles it
    if (window.location.pathname.startsWith('/import')) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('qp')) {
        return; // import effect will set loading
      }
    }
    let cancelled = false;
    (async () => {
      try {
        const saved = await loadSessionAsync();
        if (cancelled || !saved) {
          setLoading(false);
          return;
        }
        if (saved.pdfInfo.url) {
          pdfUrlRef.current = saved.pdfInfo.url;
          setPDFInfo(saved.pdfInfo);
          setTotalPages(saved.totalPages);
          setCurrentPage(saved.currentPage);
          setAnnotations(saved.annotations);
          setMarks(saved.marks);
          setParsedMarkSchemeText(saved.parsedMarkSchemeText);
          if (saved.markSchemeInfo?.url) {
            msUrlRef.current = saved.markSchemeInfo.url;
            setMarkSchemeInfo(saved.markSchemeInfo);
            setMarkSchemeTotalPages(saved.markSchemeTotalPages);
          }
        }
      } catch {
        // ignore, will show upload page
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Track current blob URLs for cleanup
  useEffect(() => {
    if (pdfInfo?.url) pdfUrlRef.current = pdfInfo.url;
    if (markSchemeInfo?.url) msUrlRef.current = markSchemeInfo.url;
  });

  // Auto-save session whenever key state changes (skip while loading initial state)
  useEffect(() => {
    if (loading || !pdfInfo) return;
    saveSession({
      pdfInfo,
      totalPages,
      currentPage,
      annotations,
      marks,
      markSchemeInfo,
      markSchemeTotalPages,
      parsedMarkSchemeText,
    });
  }, [loading, pdfInfo, totalPages, currentPage, annotations, marks, markSchemeInfo, markSchemeTotalPages, parsedMarkSchemeText]);

  // Re-trigger parse on reload if mark scheme exists but text is missing
  useEffect(() => {
    if (loading) return;
    if (markSchemeInfo?.data && !parsedMarkSchemeText && !parsingMarkScheme) {
      triggerParse(markSchemeInfo);
    }
  }, [loading, markSchemeInfo]);

  const triggerParse = useCallback(async (info: PDFInfo) => {
    if (!info.data) return;
    if (parseAbortRef.current) parseAbortRef.current.abort();
    const controller = new AbortController();
    parseAbortRef.current = controller;

    setParsingMarkScheme(true);
    setParseError(null);
    setParsedMarkSchemeText(null);
    try {
      const timeoutId = setTimeout(() => controller.abort(), PARSE_TIMEOUT_MS);
      const res = await fetch('/api/parse-mark-scheme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markSchemePdf: info.data,
          aiProvider,
          hackClubApiKey: aiProvider === 'hackclub' ? hackClubApiKey : undefined,
          model: parsingModel || undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        setParsedMarkSchemeText(data.text);
        setParseError(null);
        track('mark_scheme_parsed', { provider: aiProvider });
      } else {
        const err = await res.json();
        const msg = err.error || 'Failed to parse mark scheme';
        setParseError(msg);
        console.error('Failed to parse mark scheme:', msg);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setParseError('Mark scheme parsing timed out');
      } else {
        setParseError('Failed to parse mark scheme');
        console.error('Failed to parse mark scheme:', err);
      }
    } finally {
      setParsingMarkScheme(false);
    }
  }, [aiProvider, hackClubApiKey, parsingModel]);

  const handleUploadComplete = useCallback((info: PDFInfo, pages: number) => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    if (msUrlRef.current) URL.revokeObjectURL(msUrlRef.current);
    if (parseAbortRef.current) parseAbortRef.current.abort();
    pdfUrlRef.current = info.url;
    msUrlRef.current = null;
    setPDFInfo(info);
    setTotalPages(pages);
    setCurrentPage(1);
    setMarkSchemeInfo(null);
    setMarkSchemeTotalPages(0);
    setParsedMarkSchemeText(null);
    setParseError(null);
    setAnnotations({});
    setMarks([]);
    track('pdf_uploaded', { pages });
  }, []);

  const handleRestoreSession = useCallback((session: {
    pdfInfo: PDFInfo;
    totalPages: number;
    currentPage: number;
    annotations: Record<number, PageAnnotations>;
    marks: MarkRecord[];
    markSchemeInfo: PDFInfo | null;
    markSchemeTotalPages: number;
    parsedMarkSchemeText: string | null;
  }) => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    if (msUrlRef.current) URL.revokeObjectURL(msUrlRef.current);
    if (parseAbortRef.current) parseAbortRef.current.abort();
    pdfUrlRef.current = session.pdfInfo.url;
    msUrlRef.current = session.markSchemeInfo?.url ?? null;
    setPDFInfo(session.pdfInfo);
    setTotalPages(session.totalPages);
    setCurrentPage(session.currentPage);
    setAnnotations(session.annotations);
    setMarks(session.marks);
    setMarkSchemeInfo(session.markSchemeInfo);
    setMarkSchemeTotalPages(session.markSchemeTotalPages);
    setParsedMarkSchemeText(session.parsedMarkSchemeText);
    setParseError(null);
    setMarkError(null);
  }, []);

  const handleRename = useCallback((filename: string) => {
    setPDFInfo(prev => prev ? { ...prev, filename } : prev);
  }, []);

  const handleReset = useCallback(() => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    if (msUrlRef.current) URL.revokeObjectURL(msUrlRef.current);
    if (parseAbortRef.current) parseAbortRef.current.abort();
    pdfUrlRef.current = null;
    msUrlRef.current = null;
    clearLastSessionKey();
    setPDFInfo(null);
    setMarkSchemeInfo(null);
    setMarkSchemeTotalPages(0);
    setParsedMarkSchemeText(null);
    setParseError(null);
    setCurrentPage(1);
    setTotalPages(0);
    setAnnotations({});
    setMarks([]);
    setMarkError(null);
  }, []);

  const handleExport = useCallback(() => {
    if (!pdfInfo) return;
    const exportData = {
      version: 1,
      pdfInfo,
      markSchemeInfo,
      markSchemeTotalPages,
      totalPages,
      currentPage,
      annotations,
      marks,
      parsedMarkSchemeText,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pdfInfo.filename.replace(/\.[^.]+$/, '')}.examify`;
    a.click();
    URL.revokeObjectURL(url);
    track('session_exported', { marks: marks.length });
  }, [pdfInfo, markSchemeInfo, markSchemeTotalPages, totalPages, currentPage, annotations, marks, parsedMarkSchemeText]);

  const handleImport = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.version !== 1) throw new Error('Invalid .examify file version');

      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      if (msUrlRef.current) URL.revokeObjectURL(msUrlRef.current);
      if (parseAbortRef.current) parseAbortRef.current.abort();

      // Recreate blob URLs from base64 data
      if (data.pdfInfo?.data) {
        const blob = new Blob([Uint8Array.from(atob(data.pdfInfo.data), c => c.charCodeAt(0))], { type: 'application/pdf' });
        data.pdfInfo.url = URL.createObjectURL(blob);
      }
      if (data.markSchemeInfo?.data) {
        const blob = new Blob([Uint8Array.from(atob(data.markSchemeInfo.data), c => c.charCodeAt(0))], { type: 'application/pdf' });
        data.markSchemeInfo.url = URL.createObjectURL(blob);
      }

      pdfUrlRef.current = data.pdfInfo.url;
      msUrlRef.current = data.markSchemeInfo?.url ?? null;
      setPDFInfo(data.pdfInfo);
      setTotalPages(data.totalPages);
      setCurrentPage(data.currentPage);
      setAnnotations(data.annotations ?? {});
      setMarks(data.marks ?? []);
      setMarkSchemeInfo(data.markSchemeInfo ?? null);
      setMarkSchemeTotalPages(data.markSchemeTotalPages ?? 0);
      setParsedMarkSchemeText(data.parsedMarkSchemeText ?? null);
      setParseError(null);
      setMarkError(null);
      setCurrentPage(1);
      track('session_imported', { marks: (data.marks ?? []).length });
    } catch (e: any) {
      setMarkError(`Import failed: ${e.message}`);
    }
  }, []);

  const updateAnnotations = useCallback((page: number, ann: PageAnnotations) => {
    setAnnotations(prev => ({ ...prev, [page]: ann }));
  }, []);

  const handleMarkSchemeUpload = useCallback(async (info: PDFInfo, totalPages: number) => {
    if (msUrlRef.current) URL.revokeObjectURL(msUrlRef.current);
    msUrlRef.current = info.url;
    setMarkSchemeInfo(info);
    setMarkSchemeTotalPages(totalPages);
    track('mark_scheme_uploaded', { pages: totalPages });
    triggerParse(info);
  }, [triggerParse]);

  const handleMark = useCallback(
    async (imageBase64: string, questionContext?: string, pageText?: string, textBoxesText?: string) => {
      setMarking(true);
      setMarkError(null);
      track('mark_requested', { provider: aiProvider });
      try {
        const res = await fetch('/api/mark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: imageBase64,
            pageText,
            textBoxesText,
            questionContext,
            parsedMarkSchemeText,
            aiProvider,
            hackClubApiKey: aiProvider === 'hackclub' ? hackClubApiKey : undefined,
            markingModel: markingModel || undefined,
            enableReasoning: aiProvider === 'hackclub' ? enableReasoning : undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Marking failed');
        }
        const result: MarkResult = await res.json();
        const record: MarkRecord = { pageNumber: currentPage, result, timestamp: Date.now() };
        setMarks(prev => [...prev.filter(m => m.pageNumber !== currentPage), record]);
        track('mark_completed', { provider: aiProvider });
      } catch (e: any) {
        setMarkError(e.message);
        track('mark_failed', { provider: aiProvider, error: e.message });
      } finally {
        setMarking(false);
      }
    },
    [currentPage, aiProvider, hackClubApiKey, parsedMarkSchemeText, markingModel, enableReasoning],
  );

  const currentMark = marks.find(m => m.pageNumber === currentPage)?.result ?? null;

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span>Loading your session...</span>
      </div>
    );
  }

  if (!pdfInfo) {
    return (
      <UploadPage
        onUploadComplete={handleUploadComplete}
        onMarkSchemeUpload={handleMarkSchemeUpload}
        onRestoreSession={handleRestoreSession}
        onImport={handleImport}
      />
    );
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
      onExport={handleExport}
      onRename={handleRename}
      marking={marking || parsingMarkScheme}
      markError={markError}
      markResult={currentMark}
      marks={marks}
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
      enableReasoning={enableReasoning}
      onEnableReasoningChange={(v) => {
        setEnableReasoning(v);
        localStorage.setItem('enableReasoning', String(v));
      }}
      parsedMarkSchemeText={parsedMarkSchemeText}
      parsingMarkScheme={parsingMarkScheme}
      parseError={parseError}
      darkMode={darkMode}
      onDarkModeChange={handleDarkModeChange}
    />
  );
}
