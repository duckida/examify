export async function getPDFPageCount(url: string): Promise<number> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  return pdf.numPages;
}

export async function renderPDFPageToBase64(
  url: string,
  pageNum: number,
  maxWidth: number,
): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const scale = maxWidth / viewport.width;
  const scaledViewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = scaledViewport.width * 2;
  canvas.height = scaledViewport.height * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);
  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

  return canvas.toDataURL('image/png').split(',')[1];
}
