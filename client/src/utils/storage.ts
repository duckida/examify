import type { PDFInfo, PageAnnotations, MarkRecord } from '../types';

const PREFIX = 'examify_';
const DB_NAME = 'examify';
const DB_VERSION = 1;
const DB_STORE = 'pdfs';

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

// --- IndexedDB helpers for large PDF data ---

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function idbGet(key: string): Promise<string | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// --- Save session ---

export function saveSession(session: SavedSession): boolean {
  try {
    const key = getStorageKey(session.pdfInfo);

    // Store large base64 data in IndexedDB (async, fire-and-forget)
    if (session.pdfInfo.data) {
      idbSet(key + ':pdfData', session.pdfInfo.data).catch(() => {});
    }
    if (session.markSchemeInfo?.data) {
      idbSet(key + ':msData', session.markSchemeInfo.data).catch(() => {});
    }

    // Store metadata in localStorage (sync)
    const msMeta = session.markSchemeInfo
      ? { id: session.markSchemeInfo.id, filename: session.markSchemeInfo.filename }
      : null;
    const pdfMeta = { id: session.pdfInfo.id, filename: session.pdfInfo.filename };

    const payload = JSON.stringify({
      pdfInfo: pdfMeta,
      totalPages: session.totalPages,
      currentPage: session.currentPage,
      annotations: session.annotations,
      marks: session.marks,
      markSchemeInfo: msMeta,
      markSchemeTotalPages: session.markSchemeTotalPages,
      parsedMarkSchemeText: session.parsedMarkSchemeText,
    });
    localStorage.setItem(key, payload);
    localStorage.setItem(PREFIX + 'lastKey', key);
    return true;
  } catch (e) {
    console.warn('Failed to save session:', e);
    return false;
  }
}

// --- Load session metadata from localStorage (sync) ---

interface SessionMeta {
  key: string;
  pdfInfo: { id: string; filename: string };
  totalPages: number;
  currentPage: number;
  annotations: Record<number, PageAnnotations>;
  marks: MarkRecord[];
  markSchemeInfo: { id: string; filename: string } | null;
  markSchemeTotalPages: number;
  parsedMarkSchemeText: string | null;
}

function loadSessionMeta(key: string): SessionMeta | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.pdfInfo) return null;
    return data as SessionMeta;
  } catch {
    return null;
  }
}

// --- Load full session (async, rebuilds PDF from IndexedDB) ---

export async function loadSessionAsync(key?: string): Promise<SavedSession | null> {
  const storageKey = key || localStorage.getItem(PREFIX + 'lastKey');
  if (!storageKey) return null;

  const meta = loadSessionMeta(storageKey);
  if (!meta) return null;

  try {
    // Load base64 data from IndexedDB
    const [pdfData, msData] = await Promise.all([
      idbGet(storageKey + ':pdfData'),
      meta.markSchemeInfo ? idbGet(storageKey + ':msData') : Promise.resolve(undefined),
    ]);

    // Rebuild PDFInfo with blob URLs
    const pdfInfo: PDFInfo = {
      id: meta.pdfInfo.id,
      filename: meta.pdfInfo.filename,
      url: '', // will be set below
      data: pdfData,
    };
    if (pdfData) {
      const blob = new Blob([Uint8Array.from(atob(pdfData), c => c.charCodeAt(0))], { type: 'application/pdf' });
      pdfInfo.url = URL.createObjectURL(blob);
    }

    let markSchemeInfo: PDFInfo | null = null;
    if (meta.markSchemeInfo) {
      markSchemeInfo = {
        id: meta.markSchemeInfo.id,
        filename: meta.markSchemeInfo.filename,
        url: '',
        data: msData,
      };
      if (msData) {
        const blob = new Blob([Uint8Array.from(atob(msData), c => c.charCodeAt(0))], { type: 'application/pdf' });
        markSchemeInfo.url = URL.createObjectURL(blob);
      }
    }

    return {
      pdfInfo,
      totalPages: meta.totalPages,
      currentPage: meta.currentPage,
      annotations: meta.annotations,
      marks: meta.marks,
      markSchemeInfo,
      markSchemeTotalPages: meta.markSchemeTotalPages,
      parsedMarkSchemeText: meta.parsedMarkSchemeText,
    };
  } catch {
    return null;
  }
}

// --- Legacy sync loader (for initial React state) ---

export function loadLastSessionMeta(): SessionMeta | null {
  const key = localStorage.getItem(PREFIX + 'lastKey');
  if (!key) return null;
  return loadSessionMeta(key);
}

// --- List all saved sessions ---

export function getAllSavedSessionKeys(): { key: string; filename: string }[] {
  const sessions: { key: string; filename: string }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX) && k !== PREFIX + 'lastKey') {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const data = JSON.parse(raw);
        if (data.pdfInfo?.filename) {
          sessions.push({ key: k, filename: data.pdfInfo.filename });
        }
      } catch {
        // skip corrupt entries
      }
    }
  }
  return sessions;
}

export async function deleteSession(key: string): Promise<void> {
  localStorage.removeItem(key);
  await idbDelete(key + ':pdfData').catch(() => {});
  await idbDelete(key + ':msData').catch(() => {});
}

export function clearLastSessionKey(): void {
  localStorage.removeItem(PREFIX + 'lastKey');
}
