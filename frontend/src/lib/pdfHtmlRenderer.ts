import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * WHY THIS EXISTS (not just jsPDF's own .text()):
 *
 * jsPDF's built-in fonts (helvetica, times, courier) contain only
 * Latin glyphs, and even with a custom Arabic font embedded,
 * jsPDF's .text() draws whatever characters you hand it in
 * ISOLATED form — it does not perform Arabic contextual letter
 * shaping (initial/medial/final/isolated forms) or bidi
 * reordering. The result would be technically "Arabic characters
 * on a page" but visually broken and unreadable to anyone who
 * actually reads Arabic.
 *
 * Every browser's own text engine already does this shaping
 * correctly (this is exactly why the on-screen UI's Arabic mode
 * already renders correctly) — so this renders the document as a
 * real styled HTML element with `dir="rtl"`, rasterizes it via
 * html2canvas, and embeds that image into the PDF. The trade-off,
 * disclosed clearly: the resulting PDF is image-based for this
 * path — not selectable/searchable text — unlike the existing
 * English generator's pure-vector output, which is untouched and
 * still produces selectable text.
 */
export async function renderHtmlToPdf(buildContent: () => HTMLElement, filename: string): Promise<void> {
  const container = buildContent();
  container.style.position = 'fixed';
  container.style.top = '-10000px';
  container.style.left = '-10000px';
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position -= pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}

/** Shared base styling every Arabic document template builds on top of. */
export function createArabicDocumentContainer(): HTMLDivElement {
  const el = document.createElement('div');
  el.dir = 'rtl';
  el.style.width = '800px';
  el.style.padding = '40px';
  el.style.backgroundColor = '#ffffff';
  el.style.fontFamily = "'Tahoma', 'Arial', sans-serif";
  el.style.color = '#1a1a1a';
  el.style.fontSize = '13px';
  el.style.lineHeight = '1.6';
  return el;
}
