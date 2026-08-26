/**
 * Utility to extract text content from PDF or Text files on client side
 */

function joinPdfTextItems(items: Array<{ str?: string }>): string {
  let out = '';
  for (const item of items) {
    const s = String(item?.str ?? '');
    if (!s) continue;
    if (!out) {
      out = s;
      continue;
    }
    const glueDigits = /\d$/.test(out) && /^[-–]?\d/.test(s);
    const glueHyphen = /[-–]$/.test(out) && /^\d/.test(s);
    if (glueDigits || glueHyphen) {
      out += s.replace(/^\s+/, '');
    } else if (/\s$/.test(out) || /^\s/.test(s)) {
      out += s;
    } else {
      out += ` ${s}`;
    }
  }
  return out
    .replace(/(\d{3})\s*[-–]\s*(\d{6,13})\b/g, '$1-$2')
    .replace(/(\d{3})\s+(\d{6,13})\b/g, '$1-$2');
}

export async function extractTextFromPdf(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();

    // Dynamically load pdf.js from CDN if not already loaded
    if (!(window as any).pdfjsLib) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load PDF parser'));
        document.head.appendChild(script);
      });
      if ((window as any).pdfjsLib) {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
    }

    if ((window as any).pdfjsLib) {
      const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += joinPdfTextItems(textContent.items) + '\n';
      }
      if (fullText.trim().length > 10) {
        return fullText;
      }
    }
  } catch (err) {
    console.warn('PDFjs extraction fallback to text:', err);
  }

  // Fallback to text reading
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.readAsText(file);
  });
}

async function ensurePdfJs(): Promise<any> {
  if (!(window as any).pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load PDF parser'));
      document.head.appendChild(script);
    });
    if ((window as any).pdfjsLib) {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }
  return (window as any).pdfjsLib;
}

export async function renderPdfPagesAsJpeg(file: File, maxPages = 4): Promise<Blob[]> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) return [];
  try {
    const pdfjsLib = await ensurePdfJs();
    if (!pdfjsLib) return [];
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = Math.min(pdf.numPages, maxPages);
    const blobs: Blob[] = [];
    const MAX_W = 1800;
    const MAX_PIXELS = 1800 * 2400;
    for (let i = 1; i <= pages; i++) {
      const page = await pdf.getPage(i);
      const base = page.getViewport({ scale: 1 });
      let scale = 2;
      if (base.width * scale > MAX_W) scale = MAX_W / base.width;
      if (base.width * base.height * scale * scale > MAX_PIXELS) {
        scale = Math.sqrt(MAX_PIXELS / (base.width * base.height));
      }
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85),
      );
      if (blob) blobs.push(blob);
    }
    return blobs;
  } catch (err) {
    console.warn('PDF page render skipped:', err);
    return [];
  }
}

export async function prepareTicketParseFormData(file: File): Promise<FormData> {
  const formData = new FormData();
  formData.append('ticketFile', file);
  const text = await extractTextFromPdf(file);
  formData.append('textContent', text);
  const pages = await renderPdfPagesAsJpeg(file, 4);
  pages.forEach((blob, i) => formData.append('pageImages', blob, `page-${i + 1}.jpg`));
  return formData;
}
