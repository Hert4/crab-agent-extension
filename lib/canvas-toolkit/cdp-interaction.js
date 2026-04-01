/**
 * Module 1: CDP Native Interaction
 * Mô phỏng phần cứng qua Chrome DevTools Protocol
 */

class CDPInteraction {
  constructor() {
    this.debuggeeId = null;
    this.isAttached = false;
    this.attachTimeout = 5000;
    this.commandTimeout = 3000;
  }

  /**
   * Attach debugger vào tab hiện tại
   */
  async attach(tabId) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('CDP attach timeout'));
      }, this.attachTimeout);

      this.debuggeeId = { tabId };

      chrome.debugger.attach(this.debuggeeId, '1.3', () => {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError) {
          reject(new Error(`CDP attach failed: ${chrome.runtime.lastError.message}`));
          return;
        }
        this.isAttached = true;
        console.log('[CDP] Attached to tab:', tabId);
        resolve();
      });
    });
  }

  /**
   * Detach debugger
   */
  async detach() {
    if (!this.isAttached || !this.debuggeeId) return;

    return new Promise((resolve) => {
      chrome.debugger.detach(this.debuggeeId, () => {
        this.isAttached = false;
        this.debuggeeId = null;
        console.log('[CDP] Detached');
        resolve();
      });
    });
  }

  /**
   * Gửi command CDP với timeout
   */
  async sendCommand(method, params = {}) {
    if (!this.isAttached) {
      throw new Error('CDP not attached. Call attach() first.');
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`CDP command timeout: ${method}`));
      }, this.commandTimeout);

      chrome.debugger.sendCommand(this.debuggeeId, method, params, (result) => {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError) {
          reject(new Error(`CDP command failed: ${chrome.runtime.lastError.message}`));
          return;
        }
        resolve(result);
      });
    });
  }

  /**
   * CDP Click - Di chuyển chuột và click tại tọa độ [x, y]
   */
  async cdp_click(x, y, options = {}) {
    const { button = 'left', clickCount = 1, delay = 50 } = options;

    try {
      // 1. Di chuyển chuột đến vị trí
      await this.sendCommand('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: Math.round(x),
        y: Math.round(y)
      });

      await this._sleep(delay);

      // 2. Mouse down
      await this.sendCommand('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: Math.round(x),
        y: Math.round(y),
        button,
        clickCount
      });

      await this._sleep(delay);

      // 3. Mouse up
      await this.sendCommand('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: Math.round(x),
        y: Math.round(y),
        button,
        clickCount
      });

      console.log(`[CDP] Click at (${x}, ${y})`);
      return { success: true, x, y };

    } catch (error) {
      console.error('[CDP] Click failed:', error);
      throw error;
    }
  }

  /**
   * CDP Double Click
   */
  async cdp_doubleClick(x, y) {
    return this.cdp_click(x, y, { clickCount: 2 });
  }

  /**
   * CDP Right Click
   */
  async cdp_rightClick(x, y) {
    return this.cdp_click(x, y, { button: 'right' });
  }

  /**
   * CDP Drag - Kéo thả từ điểm A đến điểm B
   */
  async cdp_drag(startX, startY, endX, endY, options = {}) {
    const { steps = 10, duration = 300 } = options;
    const stepDelay = duration / steps;

    try {
      // 1. Di chuyển đến điểm bắt đầu
      await this.sendCommand('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: Math.round(startX),
        y: Math.round(startY)
      });

      await this._sleep(50);

      // 2. Mouse down tại điểm bắt đầu
      await this.sendCommand('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: Math.round(startX),
        y: Math.round(startY),
        button: 'left',
        clickCount: 1
      });

      // 3. Di chuyển từ từ đến điểm kết thúc (mô phỏng drag thực tế)
      const deltaX = (endX - startX) / steps;
      const deltaY = (endY - startY) / steps;

      for (let i = 1; i <= steps; i++) {
        const currentX = startX + deltaX * i;
        const currentY = startY + deltaY * i;

        await this.sendCommand('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: Math.round(currentX),
          y: Math.round(currentY),
          button: 'left'
        });

        await this._sleep(stepDelay);
      }

      // 4. Mouse up tại điểm kết thúc
      await this.sendCommand('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: Math.round(endX),
        y: Math.round(endY),
        button: 'left',
        clickCount: 1
      });

      console.log(`[CDP] Drag from (${startX}, ${startY}) to (${endX}, ${endY})`);
      return { success: true, startX, startY, endX, endY };

    } catch (error) {
      console.error('[CDP] Drag failed:', error);
      throw error;
    }
  }

  /**
   * CDP Type - Gõ từng ký tự một
   */
  async cdp_type(text, options = {}) {
    const { delay = 30 } = options;

    try {
      for (const char of text) {
        // Dispatch keyDown
        await this.sendCommand('Input.dispatchKeyEvent', {
          type: 'keyDown',
          text: char,
          key: char,
          code: this._getKeyCode(char),
          windowsVirtualKeyCode: char.charCodeAt(0),
          nativeVirtualKeyCode: char.charCodeAt(0)
        });

        // Dispatch char event
        await this.sendCommand('Input.dispatchKeyEvent', {
          type: 'char',
          text: char
        });

        // Dispatch keyUp
        await this.sendCommand('Input.dispatchKeyEvent', {
          type: 'keyUp',
          key: char,
          code: this._getKeyCode(char),
          windowsVirtualKeyCode: char.charCodeAt(0),
          nativeVirtualKeyCode: char.charCodeAt(0)
        });

        await this._sleep(delay);
      }

      console.log(`[CDP] Typed: "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`);
      return { success: true, text };

    } catch (error) {
      console.error('[CDP] Type failed:', error);
      throw error;
    }
  }

  /**
   * CDP Press Key - Nhấn phím đặc biệt (Enter, Tab, Escape, etc.)
   */
  async cdp_pressKey(key, modifiers = {}) {
    const { ctrl = false, alt = false, shift = false, meta = false } = modifiers;

    let modifierFlags = 0;
    if (alt) modifierFlags |= 1;
    if (ctrl) modifierFlags |= 2;
    if (meta) modifierFlags |= 4;
    if (shift) modifierFlags |= 8;

    const keyDefinitions = {
      'Enter': { code: 'Enter', keyCode: 13 },
      'Tab': { code: 'Tab', keyCode: 9 },
      'Escape': { code: 'Escape', keyCode: 27 },
      'Backspace': { code: 'Backspace', keyCode: 8 },
      'Delete': { code: 'Delete', keyCode: 46 },
      'ArrowUp': { code: 'ArrowUp', keyCode: 38 },
      'ArrowDown': { code: 'ArrowDown', keyCode: 40 },
      'ArrowLeft': { code: 'ArrowLeft', keyCode: 37 },
      'ArrowRight': { code: 'ArrowRight', keyCode: 39 },
      'Home': { code: 'Home', keyCode: 36 },
      'End': { code: 'End', keyCode: 35 },
      'PageUp': { code: 'PageUp', keyCode: 33 },
      'PageDown': { code: 'PageDown', keyCode: 34 },
      'a': { code: 'KeyA', keyCode: 65 },
      'c': { code: 'KeyC', keyCode: 67 },
      'v': { code: 'KeyV', keyCode: 86 },
      'x': { code: 'KeyX', keyCode: 88 },
      'z': { code: 'KeyZ', keyCode: 90 }
    };

    const keyDef = keyDefinitions[key] || { code: `Key${key.toUpperCase()}`, keyCode: key.toUpperCase().charCodeAt(0) };

    try {
      await this.sendCommand('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key,
        code: keyDef.code,
        windowsVirtualKeyCode: keyDef.keyCode,
        nativeVirtualKeyCode: keyDef.keyCode,
        modifiers: modifierFlags
      });

      await this._sleep(30);

      await this.sendCommand('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key,
        code: keyDef.code,
        windowsVirtualKeyCode: keyDef.keyCode,
        nativeVirtualKeyCode: keyDef.keyCode,
        modifiers: modifierFlags
      });

      console.log(`[CDP] Pressed key: ${ctrl ? 'Ctrl+' : ''}${alt ? 'Alt+' : ''}${shift ? 'Shift+' : ''}${meta ? 'Meta+' : ''}${key}`);
      return { success: true, key, modifiers };

    } catch (error) {
      console.error('[CDP] PressKey failed:', error);
      throw error;
    }
  }

  /**
   * CDP Scroll - Cuộn trang
   */
  async cdp_scroll(x, y, deltaX, deltaY) {
    try {
      await this.sendCommand('Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x: Math.round(x),
        y: Math.round(y),
        deltaX,
        deltaY
      });

      console.log(`[CDP] Scroll at (${x}, ${y}) delta: (${deltaX}, ${deltaY})`);
      return { success: true };

    } catch (error) {
      console.error('[CDP] Scroll failed:', error);
      throw error;
    }
  }

  /**
   * Chụp ảnh màn hình
   */
  async screenshot(options = {}) {
    const { format = 'png', quality = 80, fullPage = false } = options;

    try {
      const result = await this.sendCommand('Page.captureScreenshot', {
        format,
        quality: format === 'jpeg' ? quality : undefined,
        captureBeyondViewport: fullPage
      });

      console.log('[CDP] Screenshot captured');
      return result.data; // Base64 encoded image

    } catch (error) {
      console.error('[CDP] Screenshot failed:', error);
      throw error;
    }
  }

  /**
   * Lấy kích thước viewport
   */
  async getViewportSize() {
    try {
      const result = await this.sendCommand('Runtime.evaluate', {
        expression: 'JSON.stringify({ width: window.innerWidth, height: window.innerHeight })',
        returnByValue: true
      });
      return JSON.parse(result.result.value);
    } catch (error) {
      console.error('[CDP] Get viewport size failed:', error);
      throw error;
    }
  }

  // Helper: Sleep
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Helper: Get key code for character
  _getKeyCode(char) {
    const code = char.toUpperCase().charCodeAt(0);
    if (code >= 65 && code <= 90) return `Key${char.toUpperCase()}`;
    if (code >= 48 && code <= 57) return `Digit${char}`;
    if (char === ' ') return 'Space';
    return `Key${char}`;
  }
}

// Export singleton instance
const cdpInteraction = new CDPInteraction();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CDPInteraction, cdpInteraction };
}
