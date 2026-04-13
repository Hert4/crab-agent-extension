/**
 * Module 2: Universal Clipboard Paste
 * Universal paste utility for Canvas apps
 */

class ClipboardPaste {
  constructor(cdpInteraction) {
    this.cdp = cdpInteraction;
    this.offscreenDocumentPath = 'offscreen/offscreen.html';
    this.offscreenCreated = false;
  }

  /**
   * Smart Paste - Intelligently paste content into Canvas
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {string} contentType - Content type: 'svg', 'html', 'text', 'image'
   * @param {string} payload - Content to paste
   */
  async smart_paste(x, y, contentType, payload) {
    try {
      console.log(`[SmartPaste] Starting paste at (${x}, ${y}) with type: ${contentType}`);

      // Step 1: Click at position to get focus
      await this.cdp.cdp_click(x, y);
      await this._sleep(100);

      // Step 2: Write payload to clipboard
      await this._writeToClipboard(contentType, payload);
      await this._sleep(50);

      // Step 3: Dispatch Ctrl+V (or Cmd+V on Mac)
      const isMac = await this._detectMac();
      await this.cdp.cdp_pressKey('v', { ctrl: !isMac, meta: isMac });

      console.log('[SmartPaste] Paste completed successfully');
      return { success: true, x, y, contentType };

    } catch (error) {
      console.error('[SmartPaste] Failed:', error);
      throw error;
    }
  }

  /**
   * Write content to clipboard with appropriate MIME type
   */
  async _writeToClipboard(contentType, payload) {
    const mimeTypes = {
      'svg': 'image/svg+xml',
      'html': 'text/html',
      'text': 'text/plain',
      'image': 'image/png'
    };

    const mimeType = mimeTypes[contentType] || 'text/plain';

    // Method 1: Use Offscreen Document (Manifest V3)
    if (chrome.offscreen) {
      await this._writeWithOffscreen(mimeType, payload);
      return;
    }

    // Method 2: Fallback - inject script into page
    await this._writeWithInjection(mimeType, payload);
  }

  /**
   * Write clipboard via Offscreen Document (MV3 recommended)
   */
  async _writeWithOffscreen(mimeType, payload) {
    try {
      // Create offscreen document if not exists
      if (!this.offscreenCreated) {
        await this._createOffscreenDocument();
      }

      // Send message to offscreen document
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'CLIPBOARD_WRITE',
          target: 'offscreen',
          data: { mimeType, payload }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response?.success) {
            console.log('[Clipboard] Written via Offscreen');
            resolve();
          } else {
            reject(new Error(response?.error || 'Clipboard write failed'));
          }
        });
      });

    } catch (error) {
      console.warn('[Clipboard] Offscreen failed, trying injection:', error);
      await this._writeWithInjection(mimeType, payload);
    }
  }

  /**
   * Create Offscreen Document
   */
  async _createOffscreenDocument() {
    try {
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
      });

      if (existingContexts.length > 0) {
        this.offscreenCreated = true;
        return;
      }

      await chrome.offscreen.createDocument({
        url: this.offscreenDocumentPath,
        reasons: ['CLIPBOARD'],
        justification: 'Write content to clipboard for canvas paste'
      });

      this.offscreenCreated = true;
      console.log('[Clipboard] Offscreen document created');

    } catch (error) {
      console.error('[Clipboard] Failed to create offscreen document:', error);
      throw error;
    }
  }

  /**
   * Write clipboard via injection (fallback)
   */
  async _writeWithInjection(mimeType, payload) {
    const script = `
      (async () => {
        try {
          const mimeType = ${JSON.stringify(mimeType)};
          const payload = ${JSON.stringify(payload)};

          // Create ClipboardItem with appropriate MIME type
          const blob = new Blob([payload], { type: mimeType });
          const clipboardItems = {};

          // Also add text/plain for better compatibility
          if (mimeType !== 'text/plain') {
            clipboardItems['text/plain'] = new Blob([payload], { type: 'text/plain' });
          }
          clipboardItems[mimeType] = blob;

          const clipboardItem = new ClipboardItem(clipboardItems);
          await navigator.clipboard.write([clipboardItem]);

          return { success: true };
        } catch (err) {
          // Fallback: execCommand (deprecated but works)
          const textarea = document.createElement('textarea');
          textarea.value = ${JSON.stringify(payload)};
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          return { success: true, method: 'execCommand' };
        }
      })();
    `;

    try {
      await this.cdp.sendCommand('Runtime.evaluate', {
        expression: script,
        awaitPromise: true,
        returnByValue: true
      });
      console.log('[Clipboard] Written via injection');
    } catch (error) {
      console.error('[Clipboard] Injection failed:', error);
      throw error;
    }
  }

  /**
   * Paste SVG - Shortcut to paste SVG
   */
  async pasteSVG(x, y, svgContent) {
    // Ensure SVG has namespace
    if (!svgContent.includes('xmlns')) {
      svgContent = svgContent.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    return this.smart_paste(x, y, 'svg', svgContent);
  }

  /**
   * Paste HTML - Shortcut to paste HTML
   */
  async pasteHTML(x, y, htmlContent) {
    return this.smart_paste(x, y, 'html', htmlContent);
  }

  /**
   * Paste Text - Shortcut to paste plain text
   */
  async pasteText(x, y, text) {
    return this.smart_paste(x, y, 'text', text);
  }

  /**
   * Paste Rich Table - Create and paste HTML table
   */
  async pasteTable(x, y, data, options = {}) {
    const { headers = true, border = true } = options;

    let html = '<table style="border-collapse: collapse;">';

    data.forEach((row, rowIndex) => {
      html += '<tr>';
      row.forEach(cell => {
        const tag = headers && rowIndex === 0 ? 'th' : 'td';
        const style = border ? 'border: 1px solid #ccc; padding: 8px;' : 'padding: 8px;';
        html += `<${tag} style="${style}">${cell}</${tag}>`;
      });
      html += '</tr>';
    });

    html += '</table>';

    return this.pasteHTML(x, y, html);
  }

  /**
   * Paste Flowchart - Create and paste flowchart SVG
   */
  async pasteFlowchart(x, y, nodes, edges) {
    const nodeWidth = 120;
    const nodeHeight = 40;
    const spacing = 80;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${nodes.length * (nodeWidth + spacing)}" height="400">`;
    svg += '<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#333"/></marker></defs>';

    // Draw nodes
    nodes.forEach((node, index) => {
      const nx = 50 + index * (nodeWidth + spacing);
      const ny = 100;

      if (node.type === 'diamond') {
        svg += `<polygon points="${nx + nodeWidth/2},${ny} ${nx + nodeWidth},${ny + nodeHeight/2} ${nx + nodeWidth/2},${ny + nodeHeight} ${nx},${ny + nodeHeight/2}" fill="#fff" stroke="#333" stroke-width="2"/>`;
      } else {
        svg += `<rect x="${nx}" y="${ny}" width="${nodeWidth}" height="${nodeHeight}" rx="5" fill="#fff" stroke="#333" stroke-width="2"/>`;
      }

      svg += `<text x="${nx + nodeWidth/2}" y="${ny + nodeHeight/2 + 5}" text-anchor="middle" font-size="12">${node.label}</text>`;
    });

    // Draw edges (arrows)
    edges.forEach(edge => {
      const fromX = 50 + edge.from * (nodeWidth + spacing) + nodeWidth;
      const toX = 50 + edge.to * (nodeWidth + spacing);
      const y = 100 + nodeHeight / 2;

      svg += `<line x1="${fromX}" y1="${y}" x2="${toX - 5}" y2="${y}" stroke="#333" stroke-width="2" marker-end="url(#arrowhead)"/>`;
    });

    svg += '</svg>';

    return this.pasteSVG(x, y, svg);
  }

  /**
   * Detect Mac OS
   */
  async _detectMac() {
    try {
      const result = await this.cdp.sendCommand('Runtime.evaluate', {
        expression: 'navigator.platform.toLowerCase().includes("mac")',
        returnByValue: true
      });
      return result.result.value;
    } catch {
      return false;
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ClipboardPaste };
}
