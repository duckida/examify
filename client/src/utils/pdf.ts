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


