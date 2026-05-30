import type { PDFInfo, PageAnnotations, MarkRecord } from '../types';

const PREFIX = 'examify_';

interface SavedSession {
  pdfInfo: PDFInfo;
  totalPages: number;
  currentPage: number;
  annotations: Record<number, PageAnnotations>;
  marks: MarkRecord[];
  markSchemeInfo: PDFInfo | null;
  markSchemeTotalPages: number;
  parsedMarkSchemeText: string | null;
}

function getStorageKey(pdfInfo: PDFInfo): string {
  if (pdfInfo.filename && pdfInfo.filename !== 'remote.pdf') {
    return PREFIX + pdfInfo.filename;
  }
  if (pdfInfo.data) {
    return PREFIX + 'pdf_' + btoa(pdfInfo.data.slice(0, 64)).replace(/[/+=]/g, '_');
  }
  return PREFIX + 'unknown';
}

export function saveSession(session: SavedSession): boolean {
  try {
    const key = getStorageKey(session.pdfInfo);
    const payload = JSON.stringify({
      pdfInfo: session.pdfInfo,
      totalPages: session.totalPages,
      currentPage: session.currentPage,
      annotations: session.annotations,
      marks: session.marks,
      markSchemeInfo: session.markSchemeInfo,
      markSchemeTotalPages: session.markSchemeTotalPages,
      parsedMarkSchemeText: session.parsedMarkSchemeText,
    });
    localStorage.setItem(key, payload);
    localStorage.setItem(PREFIX + 'lastKey', key);
    return true;
  } catch (e) {
    console.warn('Failed to save session to localStorage:', e);
    return false;
  }
}

export function loadLastSession(): SavedSession | null {
  try {
    const key = localStorage.getItem(PREFIX + 'lastKey');
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as SavedSession;
    if (!data.pdfInfo) return null;
    return data;
  } catch {
    return null;
  }
}

export function loadSessionByKey(key: string): SavedSession | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as SavedSession;
    if (!data.pdfInfo) return null;
    return data;
  } catch {
    return null;
  }
}

export function getAllSavedSessions(): { key: string; pdfInfo: PDFInfo; savedAt: number }[] {
  const sessions: { key: string; pdfInfo: PDFInfo; savedAt: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX) && k !== PREFIX + 'lastKey') {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const data = JSON.parse(raw) as SavedSession;
        if (data.pdfInfo) {
          const lastMark = data.marks?.length
            ? Math.max(...data.marks.map(m => m.timestamp))
            : 0;
          sessions.push({ key: k, pdfInfo: data.pdfInfo, savedAt: lastMark || 0 });
        }
      } catch {
        // skip corrupt entries
      }
    }
  }
  return sessions;
}

export function deleteSession(key: string): void {
  localStorage.removeItem(key);
}

export function clearLastSessionKey(): void {
  localStorage.removeItem(PREFIX + 'lastKey');
}
