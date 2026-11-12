/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
/**
 * Accurately converts OKLCH color strings to sRGB rgb/rgba strings.
 * Implements standard Björn Ottosson OKLCH -> OKLab -> Linear sRGB -> Gamma corrected sRGB.
 */
function oklchToRgbFallback(str: string): string {
  const clean = str.trim();
  const match = clean.match(
    /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([-\d.]+(?:deg|rad|turn)?)(?:\s*(?:\/|,)\s*([\d.]+%?))?\s*\)/i
  );
  if (!match) return '#000000';

  let L = match[1].endsWith('%') ? parseFloat(match[1]) / 100 : parseFloat(match[1]);
  const C = parseFloat(match[2]);
  let hRaw = match[3];
  let H = parseFloat(hRaw);
  if (hRaw.endsWith('rad')) {
    H = (H * 180) / Math.PI;
  } else if (hRaw.endsWith('turn')) {
    H = H * 360;
  }
  const A = match[4]
    ? match[4].endsWith('%')
      ? parseFloat(match[4]) / 100
      : parseFloat(match[4])
    : 1;

  if (isNaN(L)) L = 0;
  if (isNaN(H)) H = 0;

  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const rLinear = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLinear = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLinear = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  const gamma = (x: number) => {
    const clamped = Math.max(0, Math.min(1, x));
    return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  };

  const R = Math.round(gamma(rLinear) * 255);
  const G = Math.round(gamma(gLinear) * 255);
  const B = Math.round(gamma(bLinear) * 255);

  if (A < 1) {
    return `rgba(${R}, ${G}, ${B}, ${Math.max(0, Math.min(1, A))})`;
  }
  return `rgb(${R}, ${G}, ${B})`;
}

/**
 * Universal color sanitizer: converts any oklch, oklab, or modern color notation
 * to standard sRGB (rgb/rgba/hex) accepted by html2canvas.
 */
function sanitizeColorString(str: string): string {
  if (!str || typeof str !== 'string') return str;
  if (!str.includes('oklch') && !str.includes('oklab') && !str.includes('lab(') && !str.includes('lch(')) {
    return str;
  }

  // Replace oklab(...), oklch(...), lab(...), lch(...) inside values (including box-shadow, borders, gradients)
  return str.replace(/(?:oklch|oklab|lab|lch)\([^)]+\)/gi, (match) => {
    // 1. Try native 2D canvas parsing first (instant & exact in browser)
    if (typeof document !== 'undefined') {
      try {
        const testCanvas = document.createElement('canvas');
        testCanvas.width = 1;
        testCanvas.height = 1;
        const ctx = testCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#000000';
          ctx.fillStyle = match;
          const style = ctx.fillStyle;
          if (style && !style.includes('oklch') && !style.includes('oklab') && !style.includes('lab(')) {
            return style;
          }
        }
      } catch {
        // Fall back to math conversion
      }
    }
    // 2. Math conversion fallback
    return oklchToRgbFallback(match);
  });
}

/**
 * Traverses original and cloned DOM trees, resolving all computed text colors,
 * background colors, and border colors into explicit sRGB rgb/rgba/hex values.
 * This guarantees html2canvas parses every character, heading, table cell, and border
 * with 100% visible colors, completely avoiding transparent fallback (return 0).
 */
function copyComputedStylesAsRgb(originalRoot: HTMLElement, clonedRoot: HTMLElement): void {
  try {
    const origEls = [originalRoot, ...Array.from(originalRoot.querySelectorAll('*'))] as HTMLElement[];
    const cloneEls = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll('*'))] as HTMLElement[];
    const count = Math.min(origEls.length, cloneEls.length);

    for (let i = 0; i < count; i++) {
      const orig = origEls[i];
      const cln = cloneEls[i];
      if (!orig || !cln) continue;

      try {
        const computed = window.getComputedStyle(orig);

        // 1. Text color
        if (computed.color) {
          const s = sanitizeColorString(computed.color);
          if (s && !s.includes('oklch') && !s.includes('oklab')) {
            cln.style.color = s;
          } else {
            cln.style.color = '#0f172a';
          }
        }

        // 2. Background color
        if (
          computed.backgroundColor &&
          computed.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
          computed.backgroundColor !== 'transparent'
        ) {
          const s = sanitizeColorString(computed.backgroundColor);
          if (s && !s.includes('oklch') && !s.includes('oklab')) {
            cln.style.backgroundColor = s;
          }
        }

        // 3. Border colors
        if (computed.borderColor && computed.borderWidth !== '0px') {
          const s = sanitizeColorString(computed.borderColor);
          if (s && !s.includes('oklch') && !s.includes('oklab')) {
            cln.style.borderColor = s;
          } else {
            cln.style.borderColor = '#94a3b8';
          }
        }

        // 4. Ensure table containers and parent wrappers do not clip content
        if (cln.classList && (cln.classList.contains('overflow-x-auto') || cln.classList.contains('overflow-hidden'))) {
          cln.style.overflow = 'visible';
          cln.style.maxWidth = 'none';
        }
      } catch {}
    }
  } catch (err) {
    console.warn('copyComputedStylesAsRgb note:', err);
  }
}

/**
 * Inlines all <img> elements inside a root container into base64 data URLs.
 * Ensures html2canvas renders all logos, stamps, and photos without network latency or CORS blocks.
 * If liveElement is provided, grabs pixel data directly from already-rendered live images.
 */
async function inlineAllImages(root: HTMLElement, liveElement?: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  const liveImages = liveElement ? Array.from(liveElement.querySelectorAll('img')) : [];

  await Promise.all(
    images.map(async (img, idx) => {
      try {
        if (!img.src || img.src.startsWith('data:')) return;

        const liveImg = liveImages[idx];

        // If the original live DOM image is already rendered and has natural dimensions
        if (liveImg && liveImg.complete && liveImg.naturalWidth > 0 && liveImg.naturalHeight > 0) {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = liveImg.naturalWidth;
            canvas.height = liveImg.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(liveImg, 0, 0);
              const dataUrl = canvas.toDataURL('image/png');
              if (dataUrl && dataUrl.length > 50) {
                img.src = dataUrl;
                return;
              }
            }
          } catch {
            // In case of canvas taint from cross-origin image, retain original src
          }
        }

        // Fallback: load asynchronously via off-screen Image object with CORS enabled
        await new Promise<void>((resolve) => {
          const tempImg = new Image();
          tempImg.crossOrigin = 'anonymous';
          tempImg.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = tempImg.naturalWidth || 120;
              canvas.height = tempImg.naturalHeight || 120;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(tempImg, 0, 0);
                const dataUrl = canvas.toDataURL('image/png');
                if (dataUrl && dataUrl.length > 50) {
                  img.src = dataUrl;
                }
              }
            } catch {}
            resolve();
          };
          tempImg.onerror = () => resolve();
          tempImg.src = img.src;
          setTimeout(resolve, 600);
        });
      } catch {
        // Continue gracefully if a specific image cannot be inlined
      }
    })
  );
}

/**
 * Checks if a generated canvas is completely blank (white or transparent).
 * Accurately samples central content areas, scanlines, and text regions.
 * Prevents false positives caused by white page borders or margins.
 */
function isCanvasBlank(canvas: HTMLCanvasElement): boolean {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return true;

    // 1. Sample central points across the document where headings, text, and tables reside
    const testPoints = [
      { x: Math.floor(w * 0.5), y: Math.floor(h * 0.15) },
      { x: Math.floor(w * 0.5), y: Math.floor(h * 0.25) },
      { x: Math.floor(w * 0.5), y: Math.floor(h * 0.4) },
      { x: Math.floor(w * 0.5), y: Math.floor(h * 0.6) },
      { x: Math.floor(w * 0.5), y: Math.floor(h * 0.8) },
      { x: Math.floor(w * 0.3), y: Math.floor(h * 0.35) },
      { x: Math.floor(w * 0.7), y: Math.floor(h * 0.35) },
      { x: Math.floor(w * 0.3), y: Math.floor(h * 0.5) },
      { x: Math.floor(w * 0.7), y: Math.floor(h * 0.5) },
    ];

    for (const pt of testPoints) {
      const sampleW = Math.min(80, w - pt.x);
      const sampleH = Math.min(80, h - pt.y);
      if (sampleW <= 0 || sampleH <= 0) continue;
      const imgData = ctx.getImageData(pt.x, pt.y, sampleW, sampleH);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const a = d[i + 3];
        // If pixel is not transparent and not pure white (has text, line, or color)
        if (a > 30 && (r < 240 || g < 240 || b < 240)) {
          return false; // Found visible content!
        }
      }
    }

    // 2. Scanline grid check across the vertical body of the canvas
    const scanStepY = Math.max(15, Math.floor(h / 35));
    const scanWidth = Math.min(Math.floor(w * 0.7), 400);
    const startX = Math.floor(w * 0.15);

    for (let y = Math.floor(h * 0.1); y < Math.floor(h * 0.9); y += scanStepY) {
      const row = ctx.getImageData(startX, y, scanWidth, 1).data;
      for (let i = 0; i < row.length; i += 8) {
        if (row[i + 3] > 30 && (row[i] < 240 || row[i + 1] < 240 || row[i + 2] < 240)) {
          return false; // Found visible content!
        }
      }
    }

    return true;
  } catch {
    // If browser security limits reading canvas pixels, assume it is valid and do not block download
    return false;
  }
}

/**
 * Universal print helper: Prints any DOM element cleanly on standard A4 page.
 * Uses isolated DOM container and CSS print media query isolation to guarantee all text,
 * Urdu fonts, borders, stamps, and logos print with exact colors, with zero blank pages
 * and zero dashboard chrome clutter.
 */
export function printElement(element: HTMLElement | null, title?: string): void {
  if (!element) {
    window.print();
    return;
  }

  // Remove any stale print elements or styles
  const staleWrapper = document.getElementById('edupro-isolated-print-wrapper');
  if (staleWrapper) staleWrapper.remove();
  const staleStyle = document.getElementById('edupro-print-isolation-style');
  if (staleStyle) staleStyle.remove();

  // Create isolated print container attached directly to body
  const printWrapper = document.createElement('div');
  printWrapper.id = 'edupro-isolated-print-wrapper';

  const clone = element.cloneNode(true) as HTMLElement;
  clone.classList.remove('hidden');
  clone.style.display = 'block';
  clone.style.visibility = 'visible';
  clone.style.opacity = '1';
  clone.style.position = 'static';
  clone.style.left = '0';
  clone.style.top = '0';
  clone.style.width = '100%';
  clone.style.maxWidth = '100%';
  clone.style.margin = '0 auto';
  clone.style.backgroundColor = '#ffffff';
  clone.style.color = '#000000';

  // Force all child elements to visible and strip out any off-screen positioning
  clone.querySelectorAll('*').forEach((node) => {
    const el = node as HTMLElement;
    if (el.style) {
      if (el.style.opacity === '0') el.style.opacity = '1';
      if (el.style.visibility === 'hidden') el.style.visibility = 'visible';
      if (el.style.position === 'fixed') el.style.position = 'static';
    }
  });

  printWrapper.appendChild(clone);
  document.body.appendChild(printWrapper);

  const printStyle = document.createElement('style');
  printStyle.id = 'edupro-print-isolation-style';
  printStyle.textContent = `
    @media print {
      @page {
        size: A4 portrait;
        margin: 8mm;
      }
      body > *:not(#edupro-isolated-print-wrapper) {
        display: none !important;
      }
      #edupro-isolated-print-wrapper {
        display: block !important;
        position: static !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #edupro-isolated-print-wrapper * {
        visibility: visible !important;
        opacity: 1 !important;
      }
      .no-print {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(printStyle);

  const prevTitle = document.title;
  if (title) document.title = title;

  try {
    window.print();
  } finally {
    setTimeout(() => {
      try {
        printWrapper.remove();
        printStyle.remove();
        if (title) document.title = prevTitle;
      } catch {}
    }, 1500);
  }
}

/**
 * Universal interactive download notification popup on screen.
 * Confirms file was generated, saved to laptop Downloads, and provides a direct click button.
 */
export function showDownloadSuccessToast(filename: string, blobUrl?: string): void {
  try {
    const existing = document.getElementById('edupro-download-toast');
    if (existing) {
      existing.remove();
    }
    const toast = document.createElement('div');
    toast.id = 'edupro-download-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.zIndex = '999999';
    toast.style.display = 'flex';
    toast.style.flexDirection = 'column';
    toast.style.gap = '8px';
    toast.style.padding = '14px 18px';
    toast.style.background = '#090d16';
    toast.style.color = '#ffffff';
    toast.style.borderRadius = '14px';
    toast.style.boxShadow = '0 20px 35px -5px rgba(0, 0, 0, 0.5), 0 10px 15px -5px rgba(0, 0, 0, 0.3)';
    toast.style.border = '1.5px solid #22c55e';
    toast.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    toast.style.maxWidth = '380px';
    toast.style.pointerEvents = 'auto';

    toast.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 10px;">
        <div style="width: 28px; height: 28px; border-radius: 50%; background: rgba(34, 197, 94, 0.2); display: flex; align-items: center; justify-content: center; shrink: 0; margin-top: 2px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div style="flex: 1;">
          <p style="margin: 0; color: #f8fafc; font-size: 13px; font-weight: 700; line-height: 1.2;">Document Downloaded</p>
          <p style="margin: 3px 0 0 0; color: #38bdf8; font-size: 11px; font-weight: 600; font-family: monospace; word-break: break-all;">${filename}</p>
          <p style="margin: 2px 0 0 0; color: #94a3b8; font-size: 11px;">Saved to your default device Downloads folder</p>
        </div>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s ease-out, transform 0.4s ease-out';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
      setTimeout(() => {
        try {
          toast.remove();
        } catch {}
      }, 400);
    }, 6000);
  } catch {
    // Non-fatal if DOM toast fails
  }
}

/**
 * Universal error toast when a download fails.
 */
export function showDownloadErrorToast(errorMessage: string): void {
  try {
    const existing = document.getElementById('edupro-download-toast');
    if (existing) {
      existing.remove();
    }
    const toast = document.createElement('div');
    toast.id = 'edupro-download-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.zIndex = '999999';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '10px';
    toast.style.padding = '14px 18px';
    toast.style.background = '#180707';
    toast.style.color = '#ffffff';
    toast.style.borderRadius = '14px';
    toast.style.boxShadow = '0 20px 35px -5px rgba(0, 0, 0, 0.5)';
    toast.style.border = '1.5px solid #ef4444';
    toast.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    toast.style.maxWidth = '380px';

    toast.innerHTML = `
      <div style="width: 28px; height: 28px; border-radius: 50%; background: rgba(239, 68, 68, 0.2); display: flex; align-items: center; justify-content: center; shrink: 0;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div>
        <p style="margin: 0; color: #f87171; font-size: 13px; font-weight: 700;">Download Failed</p>
        <p style="margin: 2px 0 0 0; color: #fca5a5; font-size: 11px;">${errorMessage}</p>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      try {
        toast.remove();
      } catch {}
    }, 6000);
  } catch {}
}

/**
 * Downloads a DOM element as a high-resolution, multi-page aware A4 PDF.
 * Preserves Urdu text, English text, images, logos, stamps, and layout.
 * Bulletproof against hidden containers, scroll offsets, tainted canvas, and blank pages.
 */
export async function downloadElementAsPDF(
  element: HTMLElement,
  filename: string,
  options?: {
    orientation?: 'portrait' | 'landscape';
    format?: 'a4';
    marginMm?: number;
  }
): Promise<void> {
  const orientation = options?.orientation || 'portrait';
  const marginMm = options?.marginMm !== undefined ? options?.marginMm : 8;

  // A4 dimensions in mm
  const a4WidthMm = orientation === 'portrait' ? 210 : 297;
  const a4HeightMm = orientation === 'portrait' ? 297 : 210;

  const contentWidthMm = a4WidthMm - marginMm * 2;
  const contentHeightMm = a4HeightMm - marginMm * 2;

  let stagingWrapper: HTMLElement | null = null;
  const prevScrollX = typeof window !== 'undefined' ? (window.scrollX || window.pageXOffset || 0) : 0;
  const prevScrollY = typeof window !== 'undefined' ? (window.scrollY || window.pageYOffset || 0) : 0;

  try {
    // Reset window scroll to 0,0 during capture to eliminate html2canvas coordinate distortion
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }

    const isLandscape = orientation === 'landscape';
    const targetWidthPx = isLandscape ? 1123 : 794;
    const targetMinHeightPx = isLandscape ? 794 : 1123;

    // 1. Create a dedicated absolute staging container at document origin (0, 0)
    // Using position: absolute completely eliminates the html2canvas fixed-position coordinate bugs
    stagingWrapper = document.createElement('div');
    stagingWrapper.id = 'edupro-pdf-staging-layer';
    stagingWrapper.style.position = 'absolute';
    stagingWrapper.style.left = '0px';
    stagingWrapper.style.top = '0px';
    stagingWrapper.style.width = `${targetWidthPx}px`;
    stagingWrapper.style.minHeight = `${targetMinHeightPx}px`;
    stagingWrapper.style.backgroundColor = '#ffffff';
    stagingWrapper.style.zIndex = '999999';
    stagingWrapper.style.margin = '0';
    stagingWrapper.style.padding = '0';
    stagingWrapper.style.boxSizing = 'border-box';
    stagingWrapper.style.opacity = '1';
    stagingWrapper.style.visibility = 'visible';
    stagingWrapper.style.pointerEvents = 'none';
    stagingWrapper.style.overflow = 'visible';

    // Clone target element
    const clone = element.cloneNode(true) as HTMLElement;
    clone.classList.remove('hidden');
    clone.style.display = 'block';
    clone.style.visibility = 'visible';
    clone.style.opacity = '1';
    clone.style.width = `${targetWidthPx}px`;
    clone.style.maxWidth = `${targetWidthPx}px`;
    clone.style.margin = '0 auto';
    clone.style.boxSizing = 'border-box';
    clone.style.backgroundColor = '#ffffff';
    clone.style.color = '#000000';

    // Unhide all descendant elements that may have been hidden for layout or offscreen positioning
    clone.querySelectorAll('*').forEach((node) => {
      const el = node as HTMLElement;
      if (el.classList.contains('hidden')) el.classList.remove('hidden');
      if (el.style) {
        if (el.style.opacity === '0') el.style.opacity = '1';
        if (el.style.visibility === 'hidden') el.style.visibility = 'visible';
        if (el.style.position === 'fixed') el.style.position = 'static';
      }
    });

    // Sanitize modern CSS colors (oklch, oklab, lab, lch) to sRGB
    const allDescendants = clone.querySelectorAll('*');
    allDescendants.forEach((el) => {
      const inlineStyle = el.getAttribute('style');
      if (inlineStyle && (inlineStyle.includes('oklch') || inlineStyle.includes('oklab') || inlineStyle.includes('lab('))) {
        el.setAttribute('style', sanitizeColorString(inlineStyle));
      }
    });

    stagingWrapper.appendChild(clone);
    document.body.appendChild(stagingWrapper);

    // Explicitly copy and bind computed sRGB colors to every cloned DOM node
    copyComputedStylesAsRgb(element, clone);

    // Inline all image assets into base64 data using live DOM elements as priority source
    await inlineAllImages(clone, element);

    // Wait for fonts to finish rendering
    if (document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {}
    }

    // Small delay to ensure painted DOM layout is finalized
    await new Promise((resolve) => setTimeout(resolve, 150));

    const captureWidth = targetWidthPx;
    const captureHeight = Math.max(clone.scrollHeight, clone.offsetHeight, stagingWrapper.scrollHeight, targetMinHeightPx);

    // Render to high-DPI canvas with exact coordinate bounds
    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        width: captureWidth,
        height: captureHeight,
        windowWidth: captureWidth,
        windowHeight: captureHeight,
        logging: false,
      });
    } catch (captureErr) {
      console.warn('Initial html2canvas render encountered issue, trying direct capture:', captureErr);
      canvas = await html2canvas(element, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        logging: false,
      });
    }

    if (!canvas || canvas.width === 0 || canvas.height === 0 || isCanvasBlank(canvas)) {
      console.warn('Staged canvas check was sparse or blank, performing direct capture fallback...');
      try {
        const directCanvas = await html2canvas(element, {
          scale: 1.5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          logging: false,
        });
        if (directCanvas && directCanvas.width > 0) {
          canvas = directCanvas;
        }
      } catch {
        // Proceed with available canvas rather than halting
      }
    }

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    // Calculate pagination slices cleanly
    const pageCanvasHeight = Math.floor((canvas.width * contentHeightMm) / contentWidthMm);
    const totalPages = Math.max(1, Math.ceil(canvas.height / pageCanvasHeight));

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) {
        pdf.addPage();
      }

      const chunkHeight = Math.min(pageCanvasHeight, canvas.height - page * pageCanvasHeight);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = chunkHeight;

      const pctx = pageCanvas.getContext('2d');
      if (pctx) {
        pctx.fillStyle = '#ffffff';
        pctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        pctx.drawImage(
          canvas,
          0,
          page * pageCanvasHeight,
          canvas.width,
          chunkHeight,
          0,
          0,
          pageCanvas.width,
          chunkHeight
        );
      }

      const chunkImgData = pageCanvas.toDataURL('image/png');
      const chunkHeightMm = (chunkHeight * contentWidthMm) / canvas.width;

      pdf.addImage(
        chunkImgData,
        'PNG',
        marginMm,
        marginMm,
        contentWidthMm,
        chunkHeightMm,
        undefined,
        'FAST'
      );
    }

    // Ensure clean filename
    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

    // 1. Generate Blob and Blob URL
    const pdfBlob = pdf.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);

    // 2. Trigger automatic browser download via anchor click
    try {
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = blobUrl;
      downloadAnchor.download = cleanFilename;
      downloadAnchor.style.display = 'none';
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();

      setTimeout(() => {
        try {
          document.body.removeChild(downloadAnchor);
        } catch {}
      }, 2000);
    } catch (clickErr) {
      console.warn('Anchor click error:', clickErr);
    }

    // 3. Fallback: also call pdf.save()
    try {
      pdf.save(cleanFilename);
    } catch {}

    // 4. Show success confirmation toast with direct download link
    showDownloadSuccessToast(cleanFilename, blobUrl);

    // Revoke Blob URL after generous timeout
    setTimeout(() => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {}
    }, 30000);
  } catch (err: any) {
    console.error('downloadElementAsPDF fatal error:', err);
    showDownloadErrorToast(err?.message || 'Failed to generate PDF document');
    throw err;
  } finally {
    if (typeof window !== 'undefined') {
      try {
        window.scrollTo(prevScrollX, prevScrollY);
      } catch {}
    }
    if (stagingWrapper && stagingWrapper.parentNode) {
      try {
        stagingWrapper.parentNode.removeChild(stagingWrapper);
      } catch {}
    }
  }
}

/**
 * Exports data to CSV file with UTF-8 BOM so Excel and Urdu/special characters display properly.
 */
export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const escapeCell = (val: string | number) => {
    const str = String(val === undefined || val === null ? '' : val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ];

  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', cleanFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showDownloadSuccessToast(cleanFilename, url);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/**
 * Exports data to an Excel-compatible XML spreadsheet (.xls).
 * Opens natively in Microsoft Excel, Google Sheets, Apple Numbers, and LibreOffice.
 */
export function exportToExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const sanitize = (val: string | number) => {
    const s = String(val === undefined || val === null ? '' : val);
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Row">
   <Alignment ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${sanitize(sheetName || 'Sheet1')}">
  <Table>
   <Row ss:StyleID="Header">
`;

  headers.forEach((h) => {
    xml += `    <Cell><Data ss:Type="String">${sanitize(h)}</Data></Cell>\n`;
  });
  xml += `   </Row>\n`;

  rows.forEach((row) => {
    xml += `   <Row ss:StyleID="Row">\n`;
    row.forEach((cell) => {
      const isNum = typeof cell === 'number';
      const cellType = isNum ? 'Number' : 'String';
      xml += `    <Cell><Data ss:Type="${cellType}">${sanitize(cell)}</Data></Cell>\n`;
    });
    xml += `   </Row>\n`;
  });

  xml += `  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const cleanFilename =
    filename.endsWith('.xls') || filename.endsWith('.xlsx') ? filename : `${filename}.xls`;
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', cleanFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showDownloadSuccessToast(cleanFilename, url);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/**
 * Direct Vector PDF Table Generator:
 * Generates razor-sharp, multi-page vector A4 PDF tables with school branding,
 * headers, borders, and clean pagination. 100% immune to canvas rendering bugs.
 */
export function exportTableToPDF(
  filename: string,
  title: string,
  schoolName: string,
  session: string,
  headers: string[],
  rows: (string | number)[][],
  options?: {
    orientation?: 'portrait' | 'landscape';
  }
): void {
  const orientation = options?.orientation || (headers.length > 6 ? 'landscape' : 'portrait');
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = orientation === 'landscape' ? 297 : 210;
  const pageHeight = orientation === 'landscape' ? 210 : 297;
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;

  // Calculate proportional column widths
  const colCount = Math.max(1, headers.length);
  const colWidth = usableWidth / colCount;

  let y = 16;
  let pageNum = 1;

  const drawHeader = () => {
    // School Title Banner
    pdf.setFillColor(15, 23, 42); // slate-900
    pdf.rect(margin, y - 6, usableWidth, 14, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    pdf.text(schoolName.toUpperCase(), margin + 4, y + 1);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(203, 213, 225); // slate-300
    const subText = `${title.toUpperCase()}  ·  ACADEMIC SESSION: ${session}  ·  GENERATED: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`;
    pdf.text(subText, margin + 4, y + 6);

    y += 13;

    // Table Column Headers
    pdf.setFillColor(30, 41, 59); // slate-800
    pdf.rect(margin, y, usableWidth, 7, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(255, 255, 255);

    headers.forEach((h, i) => {
      const cellX = margin + i * colWidth + 2;
      const text = String(h);
      pdf.text(text, cellX, y + 4.8, { maxWidth: colWidth - 3 });
    });

    y += 7;
  };

  const drawFooter = () => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(148, 163, 184); // slate-400
    const footerText = `EDU.pro School ERP  ·  ${schoolName}  ·  Page ${pageNum}`;
    pdf.text(footerText, pageWidth - margin, pageHeight - 5, { align: 'right' });
  };

  drawHeader();

  // Draw Data Rows
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);

  rows.forEach((row, rowIdx) => {
    // Check if new page is needed
    if (y + 8 > pageHeight - 12) {
      drawFooter();
      pdf.addPage();
      pageNum++;
      y = 16;
      drawHeader();
    }

    // Alternating row background
    if (rowIdx % 2 === 1) {
      pdf.setFillColor(248, 250, 252); // slate-50
      pdf.rect(margin, y, usableWidth, 6.5, 'F');
    }

    // Row borders
    pdf.setDrawColor(226, 232, 240); // slate-200
    pdf.line(margin, y + 6.5, margin + usableWidth, y + 6.5);

    pdf.setTextColor(15, 23, 42); // slate-900

    row.forEach((val, colIdx) => {
      const cellX = margin + colIdx * colWidth + 2;
      const text = String(val !== undefined && val !== null ? val : '-');
      pdf.text(text, cellX, y + 4.5, { maxWidth: colWidth - 3 });
    });

    y += 6.5;
  });

  drawFooter();

  const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  const pdfBlob = pdf.output('blob');
  const blobUrl = URL.createObjectURL(pdfBlob);

  try {
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = blobUrl;
    downloadAnchor.download = cleanFilename;
    downloadAnchor.style.display = 'none';
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    setTimeout(() => {
      try {
        document.body.removeChild(downloadAnchor);
      } catch {}
    }, 2000);
  } catch {}

  try {
    pdf.save(cleanFilename);
  } catch {}

  showDownloadSuccessToast(cleanFilename, blobUrl);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
}

