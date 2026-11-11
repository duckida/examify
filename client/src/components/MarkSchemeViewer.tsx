import { useEffect, useState } from 'react';

const pdfjsWorker = (async () => {
  const { GlobalWorkerOptions } = await import('pdfjs-dist');
  GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
})();

interface Props {
  url: string;
}

/**
 * Renders every page of a PDF as a stacked image, so the panel doesn't show
 * the browser's built-in PDF toolbar.
 */
export default function MarkSchemeViewer({ url }: Props) {
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setPageImages([]);
    setLoading(true);
    setError(null);

    (async () => {
      try {
        await pdfjsWorker;
        const pdfjsLib = await import('pdfjs-dist');
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Could not load mark scheme (HTTP ${res.status})`);
        const buffer = await res.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

        // Render at ~2x the panel width so the text stays sharp when scaled down.
        const targetWidth = 620;
        const images: string[] = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: targetWidth / baseViewport.width });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas is not supported in this browser');
          await page.render({ canvasContext: ctx, viewport }).promise;
          images.push(canvas.toDataURL('image/png'));
          if (!cancelled) setPageImages([...images]);
        }

        pdf.destroy();
        if (!cancelled) setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load mark scheme');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="ms-pdf-viewer">
      {loading && (
        <div className="ms-pdf-status">
          <div className="ms-spinner" />
          Rendering mark scheme...
        </div>
      )}

      {error && (
        <div className="ms-pdf-status ms-pdf-status-error">
          {error}
        </div>
      )}

      {pageImages.map((src, index) => (
        <img
          key={index}
          src={src}
          alt={`Mark scheme page ${index + 1}`}
          className="ms-pdf-page"
        />
      ))}
    </div>
  );
}
