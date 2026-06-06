export type AnalyticsEvent =
  | 'pdf_uploaded'
  | 'featured_paper_opened'
  | 'mark_scheme_uploaded'
  | 'mark_scheme_parsed'
  | 'mark_requested'
  | 'mark_completed'
  | 'mark_failed'
  | 'session_exported'
  | 'session_imported';

declare global {
  interface Window {
    sa_event?: (name: string, metadata?: Record<string, unknown>) => void;
  }
}

export function track(event: AnalyticsEvent, metadata?: Record<string, unknown>) {
  try {
    if (typeof window !== 'undefined' && typeof window.sa_event === 'function') {
      window.sa_event(event, metadata);
    }
  } catch {
    // swallow — analytics must never break the app
  }
}
