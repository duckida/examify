const pdfjsWorkerPromise = (async () => {
  const { GlobalWorkerOptions } = await import('pdfjs-dist');
  GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
})();

export async function getPDFPageCount(url: string): Promise<number> {
  await pdfjsWorkerPromise;
  const pdfjsLib = await import('pdfjs-dist');

  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const numPages = pdf.numPages;
  pdf.destroy();
  return numPages;
}

export async function getPDFPageCountFromBuffer(buffer: ArrayBuffer): Promise<number> {
  await pdfjsWorkerPromise;
  const pdfjsLib = await import('pdfjs-dist');
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const numPages = pdf.numPages;
  pdf.destroy();
  return numPages;
}

export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}


