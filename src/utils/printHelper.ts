/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { printElement as iframePrintElement } from './pdfExport.ts';

/**
 * Universal print helper for clean, high-fidelity A4 printing across all modules.
 * Delegates to iframe-isolated print engine to avoid printing headers, sidebars,
 * or modal backdrops.
 */
export function printElement(element: HTMLElement | null, title?: string): void {
  if (!element) {
    window.print();
    return;
  }
  iframePrintElement(element, title);
}
