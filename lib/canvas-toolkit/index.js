/**
 * Universal Canvas Toolkit
 * Entry point - Export tất cả modules
 */

// Import modules
const { CDPInteraction, cdpInteraction } = require('./cdp-interaction.js');
const { ClipboardPaste } = require('./clipboard-paste.js');
const { CanvasAgentPrompt, CANVAS_AGENT_SYSTEM_PROMPT } = require('./system-prompt.js');

/**
 * CanvasToolkit - Main class kết hợp tất cả modules
 */
class CanvasToolkit {
  constructor() {
    this.cdp = new CDPInteraction();
    this.clipboard = new ClipboardPaste(this.cdp);
    this.prompt = CanvasAgentPrompt;
    this.isInitialized = false;
  }

  /**
   * Khởi tạo toolkit với tab ID
   */
  async initialize(tabId) {
    if (this.isInitialized) {
      console.warn('[CanvasToolkit] Already initialized');
      return;
    }

    try {
      await this.cdp.attach(tabId);
      this.isInitialized = true;
      console.log('[CanvasToolkit] Initialized successfully');
    } catch (error) {
      console.error('[CanvasToolkit] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup khi kết thúc
   */
  async destroy() {
    if (!this.isInitialized) return;

    await this.cdp.detach();
    this.isInitialized = false;
    console.log('[CanvasToolkit] Destroyed');
  }

  /**
   * Kiểm tra đã khởi tạo chưa
   */
  _checkInitialized() {
    if (!this.isInitialized) {
      throw new Error('CanvasToolkit not initialized. Call initialize(tabId) first.');
    }
  }

  // ===== CDP Interaction Methods =====

  async click(x, y, options) {
    this._checkInitialized();
    return this.cdp.cdp_click(x, y, options);
  }

  async doubleClick(x, y) {
    this._checkInitialized();
    return this.cdp.cdp_doubleClick(x, y);
  }

  async rightClick(x, y) {
    this._checkInitialized();
    return this.cdp.cdp_rightClick(x, y);
  }

  async drag(startX, startY, endX, endY, options) {
    this._checkInitialized();
    return this.cdp.cdp_drag(startX, startY, endX, endY, options);
  }

  async type(text, options) {
    this._checkInitialized();
    return this.cdp.cdp_type(text, options);
  }

  async pressKey(key, modifiers) {
    this._checkInitialized();
    return this.cdp.cdp_pressKey(key, modifiers);
  }

  async scroll(x, y, deltaX, deltaY) {
    this._checkInitialized();
    return this.cdp.cdp_scroll(x, y, deltaX, deltaY);
  }

  async screenshot(options) {
    this._checkInitialized();
    return this.cdp.screenshot(options);
  }

  async getViewportSize() {
    this._checkInitialized();
    return this.cdp.getViewportSize();
  }

  // ===== Smart Paste Methods =====

  async smartPaste(x, y, contentType, payload) {
    this._checkInitialized();
    return this.clipboard.smart_paste(x, y, contentType, payload);
  }

  async pasteSVG(x, y, svgContent) {
    this._checkInitialized();
    return this.clipboard.pasteSVG(x, y, svgContent);
  }

  async pasteHTML(x, y, htmlContent) {
    this._checkInitialized();
    return this.clipboard.pasteHTML(x, y, htmlContent);
  }

  async pasteText(x, y, text) {
    this._checkInitialized();
    return this.clipboard.pasteText(x, y, text);
  }

  async pasteTable(x, y, data, options) {
    this._checkInitialized();
    return this.clipboard.pasteTable(x, y, data, options);
  }

  async pasteFlowchart(x, y, nodes, edges) {
    this._checkInitialized();
    return this.clipboard.pasteFlowchart(x, y, nodes, edges);
  }

  // ===== Convenience Methods =====

  /**
   * Tạo SVG đơn giản
   */
  createSVG(elements, width = 800, height = 600) {
    let content = this.prompt.svgTemplates.arrowDef();
    elements.forEach(el => {
      switch (el.type) {
        case 'rect':
          content += this.prompt.svgTemplates.rectangle(el.x, el.y, el.width, el.height, el.fill, el.stroke);
          break;
        case 'circle':
          content += this.prompt.svgTemplates.circle(el.cx, el.cy, el.r, el.fill, el.stroke);
          break;
        case 'diamond':
          content += this.prompt.svgTemplates.diamond(el.cx, el.cy, el.size, el.fill, el.stroke);
          break;
        case 'arrow':
          content += this.prompt.svgTemplates.arrow(el.x1, el.y1, el.x2, el.y2);
          break;
        case 'text':
          content += this.prompt.svgTemplates.text(el.x, el.y, el.content, el.fontSize);
          break;
      }
    });
    return this.prompt.wrapSVG(content, width, height);
  }

  /**
   * Lấy system prompt cho agent
   */
  getSystemPrompt(appName = null) {
    let prompt = this.prompt.systemPrompt;
    if (appName) {
      prompt += '\n' + this.prompt.getAppSpecificPrompt(appName);
    }
    return prompt;
  }

  /**
   * Shortcut: Select tool và vẽ shape
   */
  async drawShape(toolX, toolY, canvasStartX, canvasStartY, canvasEndX, canvasEndY) {
    this._checkInitialized();

    // 1. Click vào tool
    await this.click(toolX, toolY);
    await this._sleep(100);

    // 2. Drag trên canvas để vẽ
    await this.drag(canvasStartX, canvasStartY, canvasEndX, canvasEndY);

    return { success: true };
  }

  /**
   * Shortcut: Click vào vị trí và gõ text
   */
  async clickAndType(x, y, text) {
    this._checkInitialized();

    await this.doubleClick(x, y); // Double click để focus text
    await this._sleep(100);
    await this.type(text);

    return { success: true };
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
const canvasToolkit = new CanvasToolkit();

// Export
module.exports = {
  CanvasToolkit,
  canvasToolkit,
  CDPInteraction,
  cdpInteraction,
  ClipboardPaste,
  CanvasAgentPrompt,
  CANVAS_AGENT_SYSTEM_PROMPT
};
