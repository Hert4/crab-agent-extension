/**
 * Crab-Agent Accessibility Tree Injector
 * Injected into all pages at document_start.
 * Generates a lightweight accessibility tree with ref_ids for element targeting.
 * Ported from Claude Extension's approach with Crab-Agent enhancements.
 */

(function() {
  'use strict';

  // Prevent double injection, but allow re-injection after extension reload
  {
    const now = Date.now();
    if (window.__crabAccessibilityTreeInjected && (now - window.__crabAccessibilityTreeTime) < 2000) {
      return;
    }
    window.__crabAccessibilityTreeInjected = true;
    window.__crabAccessibilityTreeTime = now;
  }

  // Element tracking via WeakRef
  window.__crabElementMap = window.__crabElementMap || {};
  window.__crabRefCounter = window.__crabRefCounter || 0;

  // ========== Role Mapping ==========

  const TAG_TO_ROLE = {
    a: 'link',
    button: 'button',
    select: 'combobox',
    textarea: 'textbox',
    h1: 'heading', h2: 'heading', h3: 'heading',
    h4: 'heading', h5: 'heading', h6: 'heading',
    img: 'image',
    nav: 'navigation',
    main: 'main',
    header: 'banner',
    footer: 'contentinfo',
    section: 'region',
    article: 'article',
    aside: 'complementary',
    form: 'form',
    table: 'table',
    ul: 'list', ol: 'list',
    li: 'listitem',
    label: 'label',
    details: 'group',
    summary: 'button'
  };

  const INPUT_TYPE_TO_ROLE = {
    submit: 'button',
    button: 'button',
    checkbox: 'checkbox',
    radio: 'radio',
    file: 'button'
  };

  const INTERACTIVE_TAGS = new Set([
    'a', 'button', 'input', 'select', 'textarea', 'details', 'summary'
  ]);

  const INTERACTIVE_ROLES = new Set([
    'button', 'link', 'checkbox', 'radio', 'tab', 'menuitem',
    'menuitemcheckbox', 'menuitemradio', 'option', 'switch',
    'textbox', 'combobox', 'listbox', 'searchbox',
    'treeitem', 'slider', 'spinbutton', 'gridcell'
  ]);

  const SKIP_TAGS = new Set([
    'script', 'style', 'meta', 'link', 'title', 'noscript'
  ]);

  const LANDMARK_TAGS = new Set([
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'nav', 'main', 'header', 'footer', 'section', 'article', 'aside'
  ]);

  // ========== Utility Functions ==========

  function getRole(el) {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit;

    const tag = el.tagName.toLowerCase();
    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      return INPUT_TYPE_TO_ROLE[type] || 'textbox';
    }
    // Detect contenteditable as textbox (e.g. Facebook Messenger, Slack)
    if (el.isContentEditable && !['body', 'html'].includes(tag)) {
      return 'textbox';
    }
    return TAG_TO_ROLE[tag] || 'generic';
  }

  function getLabel(el) {
    const tag = el.tagName.toLowerCase();

    // Select: show selected option
    if (tag === 'select') {
      const selected = el.querySelector('option[selected]') || el.options?.[el.selectedIndex];
      if (selected?.textContent?.trim()) return selected.textContent.trim();
    }

    // aria-label
    const ariaLabel = (el.getAttribute('aria-label') || '').trim();
    if (ariaLabel) return ariaLabel;

    // placeholder
    const placeholder = (el.getAttribute('placeholder') || '').trim();
    if (placeholder) return placeholder;

    // data-placeholder (used by Facebook, Slack, etc.)
    const dataPlaceholder = (el.getAttribute('data-placeholder') || '').trim();
    if (dataPlaceholder) return dataPlaceholder;

    // title
    const title = (el.getAttribute('title') || '').trim();
    if (title) return title;

    // alt (for images)
    const alt = (el.getAttribute('alt') || '').trim();
    if (alt) return alt;

    // label[for]
    if (el.id) {
      const labelEl = document.querySelector(`label[for="${el.id}"]`);
      if (labelEl?.textContent?.trim()) return labelEl.textContent.trim();
    }

    // Input value for submit buttons
    if (tag === 'input') {
      const type = (el.getAttribute('type') || '').toLowerCase();
      const value = el.getAttribute('value');
      if (type === 'submit' && value?.trim()) return value.trim();
      if (el.value && el.value.length < 50 && el.value.trim()) return el.value.trim();
    }

    // Direct text for buttons, links, headings, summary
    if (['button', 'a', 'summary'].includes(tag) || tag.match(/^h[1-6]$/)) {
      let directText = '';
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          directText += child.textContent;
        }
      }
      directText = directText.trim();
      if (directText) return directText.substring(0, 100);

      // Fallback: full textContent for headings
      if (tag.match(/^h[1-6]$/)) {
        const full = (el.textContent || '').trim();
        if (full) return full.substring(0, 100);
      }
    }

    // Image without alt
    if (tag === 'img') return '';

    // Generic: try direct text children
    let directText = '';
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        directText += child.textContent;
      }
    }
    directText = directText.trim();
    if (directText && directText.length >= 3) {
      return directText.length > 100 ? directText.substring(0, 100) + '...' : directText;
    }

    // SVG: check <title> child element (standard accessible name for SVG)
    const svgTitle = el.querySelector('svg > title') || el.querySelector('title');
    if (svgTitle?.textContent?.trim()) return svgTitle.textContent.trim().substring(0, 60);

    // data-tooltip, data-tip (common tooltip attributes on web apps)
    const tooltip = (el.getAttribute('data-tooltip') || el.getAttribute('data-tip') || el.getAttribute('data-original-title') || '').trim();
    if (tooltip) return tooltip.substring(0, 60);

    // aria-describedby
    const describedBy = el.getAttribute('aria-describedby');
    if (describedBy) {
      const descEl = document.getElementById(describedBy);
      if (descEl?.textContent?.trim()) return descEl.textContent.trim().substring(0, 60);
    }

    // SVG-only child: describe based on SVG presence (icon buttons without text)
    if (!directText && el.querySelector('svg') && !el.querySelector('img')) {
      const svg = el.querySelector('svg');
      const svgClass = svg.getAttribute('class')?.toString() || '';
      // Try to extract icon name from common SVG class patterns (e.g. icon-more, emoji_icon)
      const iconMatch = svgClass.match(/icon[-_]?(\w+)|(\w+)[-_]?icon|ic[-_](\w+)/i);
      if (iconMatch) {
        const iconName = (iconMatch[1] || iconMatch[2] || iconMatch[3]).replace(/[-_]/g, ' ');
        return `[${iconName} icon]`;
      }

      // Check parent element for tooltip/label hints (common: wrapper div has tooltip, SVG inside)
      const parent = el.parentElement;
      if (parent) {
        const parentTooltip = (
          parent.getAttribute('title') ||
          parent.getAttribute('aria-label') ||
          parent.getAttribute('data-tooltip') ||
          parent.getAttribute('data-tip') ||
          parent.getAttribute('data-original-title') ||
          ''
        ).trim();
        if (parentTooltip) return parentTooltip.substring(0, 60);

        // Check sibling tooltip element (MISA/AntD pattern: .tooltip-body sibling)
        const tooltipSibling = parent.querySelector(
          '.tooltip-body, [class*=tooltip-body], [class*=tooltip__content], [class*=tooltip__inner]'
        );
        if (tooltipSibling?.textContent?.trim()) {
          return tooltipSibling.textContent.trim().substring(0, 60);
        }
      }

      return '[icon]';
    }

    return '';
  }

  function isVisible(el) {
    if (!(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    if (style.opacity === '0') return false;
    if (el.offsetWidth <= 0 || el.offsetHeight <= 0) return false;
    return true;
  }

  function isInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0
    );
  }

  function isInteractive(el) {
    if (!(el instanceof Element)) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (INTERACTIVE_TAGS.has(tag)) return true;
    const role = (el.getAttribute('role') || '').toLowerCase();
    if (INTERACTIVE_ROLES.has(role)) return true;
    if (el.getAttribute('onclick') !== null) return true;
    const tabindex = el.getAttribute('tabindex');
    if (tabindex !== null && tabindex !== '-1') return true;
    if (el.isContentEditable) return true;
    // Check for event listeners via common framework patterns
    if (el.getAttribute('data-action') !== null) return true;
    if (el.getAttribute('ng-click') !== null) return true;
    if (el.getAttribute('v-on:click') !== null || el.getAttribute('@click') !== null) return true;

    // Vue 3 runtime event listeners (_vei = Vue Event Invokers)
    if (el._vei && (el._vei.onClick || el._vei.onPointerdown || el._vei.onMousedown)) return true;

    // Vue 2 component instance
    if (el.__vue__) {
      const listeners = el.__vue__.$listeners || el.__vue__._events;
      if (listeners && (listeners.click || listeners.mousedown)) return true;
    }

    // React 16+ synthetic event detection via fiber
    try {
      const reactKey = Object.keys(el).find(k =>
        k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
      );
      if (reactKey) {
        let fiber = el[reactKey];
        for (let i = 0; i < 3 && fiber; i++) {
          if (fiber.memoizedProps?.onClick || fiber.pendingProps?.onClick) return true;
          fiber = fiber.return;
        }
      }
    } catch (e) {}

    // jQuery event data
    try {
      const jqKey = Object.keys(el).find(k => /^jQuery\d+$/.test(k));
      if (jqKey && el[jqKey]?.events?.click) return true;
    } catch (e) {}

    // Class-name patterns for common UI frameworks (MISA, Ant Design, Element UI, Vuetify, etc.)
    if (el.className && typeof el.className === 'string') {
      if (/menu-?item|trigger|toggle|toolbar-?item|controlpanel-?item|dropdown-?item|nav-?item|action-?item|clickable/i.test(el.className)) return true;
    }

    // Custom 'type' attribute on divs (MISA pattern: <div type="NPS">)
    if (el.tagName === 'DIV' && el.hasAttribute('type') && el.textContent?.trim()) return true;

    // Check cursor style - pointer cursor usually means clickable
    try {
      const cursor = window.getComputedStyle(el).cursor;
      if (cursor === 'pointer') return true;
      // For leaf-level elements (SVG/path/icon) — check nearest ancestor with inline pointer style
      if (el.children.length <= 3 && el.closest('[style*="cursor: pointer"], [style*="cursor:pointer"]')) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  function isLandmark(el) {
    const tag = (el.tagName || '').toLowerCase();
    if (LANDMARK_TAGS.has(tag)) return true;
    const role = el.getAttribute('role');
    return role !== null && role !== 'generic';
  }

  function shouldInclude(el, filter, checkViewport) {
    const tag = (el.tagName || '').toLowerCase();
    if (SKIP_TAGS.has(tag)) return false;
    if (filter !== 'all' && el.getAttribute('aria-hidden') === 'true') return false;
    if (filter !== 'all' && !isVisible(el)) return false;
    if (checkViewport && !isInViewport(el)) return false;

    if (filter === 'interactive') return isInteractive(el);
    if (isInteractive(el)) return true;
    if (isLandmark(el)) return true;
    if (getLabel(el).length > 0) return true;

    const role = getRole(el);
    return role !== null && role !== 'generic' && role !== 'image';
  }

  function getOrCreateRef(el) {
    // Check if element already has a ref
    for (const [refId, weakRef] of Object.entries(window.__crabElementMap)) {
      const stored = weakRef.deref ? weakRef.deref() : weakRef;
      if (stored === el) return refId;
    }

    // Create new ref
    const refId = 'ref_' + (++window.__crabRefCounter);
    window.__crabElementMap[refId] = new WeakRef(el);
    return refId;
  }

  // ========== Main Tree Builder ==========

  /**
   * Generate accessibility tree (Claude extension compatible).
   * @param {string} filter - "all" | "interactive"
   * @param {number} maxDepth - Max tree depth (default 15)
   * @param {string|null} focusRefId - Focus on subtree of this ref
   * @param {boolean} includeCoords - Include coordinates in output (default true)
   * @param {number} maxChars - Max output chars (default Infinity - no limit)
   * @returns {{ success: boolean, lines: string[], nodeCount: number, truncated: boolean }}
   */
  window.__generateAccessibilityTree = function(filter, maxDepth, focusRefId, includeCoords, maxChars) {
    filter = filter || 'all';
    maxDepth = maxDepth != null ? maxDepth : 50;
    includeCoords = includeCoords !== false;  // Default true
    maxChars = maxChars || Infinity;  // No char limit by default

    const lines = [];
    let nodeCount = 0;
    let charCount = 0;
    let truncated = false;
    const MAX_NODES = Infinity;  // No node limit

    // Cleanup stale refs
    for (const [refId, weakRef] of Object.entries(window.__crabElementMap)) {
      const el = weakRef.deref ? weakRef.deref() : weakRef;
      if (!el || !el.isConnected) {
        delete window.__crabElementMap[refId];
      }
    }

    // Find root element
    let root = document.body;
    if (focusRefId) {
      const map = window.__crabElementMap;
      const weakRef = map[focusRefId];
      const el = weakRef?.deref ? weakRef.deref() : weakRef;
      if (el && el.isConnected) {
        root = el;
      } else {
        // Try finding by attribute
        const found = document.querySelector(`[data-crab-ref-id="${focusRefId}"]`);
        if (found) root = found;
        else return { lines: [`(ref_id not found: ${focusRefId})`], nodeCount: 0, truncated: false };
      }
    }

    function walk(node, depth) {
      if (truncated || !(node instanceof Element)) return;
      if (nodeCount >= MAX_NODES) { truncated = true; return; }
      if (charCount >= maxChars) { truncated = true; return; }
      if (depth > maxDepth) return;

      // viewportOnly check only when not focusing on a subtree
      const include = shouldInclude(node, filter, !focusRefId);

      if (include) {
        nodeCount++;
        const role = getRole(node);
        const label = getLabel(node).replace(/\s+/g, ' ').substring(0, 100);
        const refId = getOrCreateRef(node);
        const indent = ' '.repeat(depth);

        let line = `${indent}${role}`;
        if (label) line += ` "${label.replace(/"/g, '\\"')}"`;
        line += ` [${refId}]`;

        // Extra attributes
        const href = node.getAttribute('href');
        if (href) line += ` href="${href.substring(0, 80)}"`;

        const type = node.getAttribute('type');
        if (type) line += ` type="${type}"`;

        const placeholder = node.getAttribute('placeholder');
        if (placeholder && !label.includes(placeholder)) line += ` placeholder="${placeholder.substring(0, 50)}"`;

        const ariaExpanded = node.getAttribute('aria-expanded');
        if (ariaExpanded) line += ` expanded=${ariaExpanded}`;

        const ariaSelected = node.getAttribute('aria-selected');
        if (ariaSelected === 'true') line += ` selected`;

        const ariaChecked = node.getAttribute('aria-checked');
        if (ariaChecked) line += ` checked=${ariaChecked}`;

        const disabled = node.hasAttribute('disabled');
        if (disabled) line += ` disabled`;

        const value = node.value;
        if (value && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') && value.length < 50) {
          line += ` value="${value.replace(/"/g, '\\"')}"`;
        }

        // Add coordinates if requested (for click targeting)
        if (includeCoords) {
          try {
            const rect = node.getBoundingClientRect();
            const cx = Math.round(rect.x + rect.width / 2);
            const cy = Math.round(rect.y + rect.height / 2);
            const w = Math.round(rect.width);
            const h = Math.round(rect.height);
            // Include size for small interactive elements to help distinguish icons from containers
            if (isInteractive(node) && (w <= 60 || h <= 60)) {
              line += ` ${w}×${h} @(${cx},${cy})`;
            } else {
              line += ` @(${cx},${cy})`;
            }
          } catch(e) {}
        }

        // Check char limit before adding
        if (charCount + line.length > maxChars) {
          truncated = true;
          return;
        }

        lines.push(line);
        charCount += line.length + 1;

        // For select elements, show options
        if (node.tagName.toLowerCase() === 'select') {
          for (const opt of node.options) {
            if (charCount >= maxChars) { truncated = true; break; }
            const optLabel = (opt.textContent || '').trim().substring(0, 100);
            const optRef = getOrCreateRef(opt);
            let optLine = `${' '.repeat(depth + 1)}option "${optLabel.replace(/"/g, '\\"')}" [${optRef}]`;
            if (opt.selected) optLine += ' (selected)';
            if (opt.value && opt.value !== optLabel) optLine += ` value="${opt.value.replace(/"/g, '\\"')}"`;
            lines.push(optLine);
            charCount += optLine.length + 1;
            nodeCount++;
          }
          return; // Don't recurse into select children
        }
      }

      // Recurse children
      if (node.children) {
        for (const child of node.children) {
          walk(child, include ? depth + 1 : depth);
          if (truncated) break;
        }
      }
    }

    walk(root, 0);

    if (lines.length === 0) {
      lines.push('(no matching elements)');
    }

    return { success: true, lines, nodeCount, truncated, filter, depth: maxDepth };
  };

  /**
   * Resolve a ref_id to element info (coordinates, tag, text).
   */
  window.__resolveRef = function(refId) {
    const map = window.__crabElementMap;
    if (!map) return null;

    const weakRef = map[refId];
    if (!weakRef) return null;

    const el = weakRef.deref ? weakRef.deref() : weakRef;
    if (!el || !el.isConnected) {
      delete map[refId];
      return null;
    }

    const rect = el.getBoundingClientRect();
    // Compensate for page zoom — getBoundingClientRect returns visual coords,
    // CDP events expect layout viewport coords
    const pageZoom = window.visualViewport?.scale || 1;
    return {
      x: Math.round((rect.x + rect.width / 2) / pageZoom),
      y: Math.round((rect.y + rect.height / 2) / pageZoom),
      width: Math.round(rect.width / pageZoom),
      height: Math.round(rect.height / pageZoom),
      tag: (el.tagName || '').toLowerCase(),
      text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 80),
      visible: isVisible(el),
      interactive: isInteractive(el)
    };
  };

  /**
   * Set form value on element by ref_id.
   * Handles: input, textarea, select, checkbox, radio, contenteditable.
   */
  window.__setFormValue = function(refId, value) {
    const map = window.__crabElementMap;
    if (!map) return { success: false, error: 'Element map not initialized' };

    const weakRef = map[refId];
    if (!weakRef) return { success: false, error: `Ref ${refId} not found` };

    const el = weakRef.deref ? weakRef.deref() : weakRef;
    if (!el || !el.isConnected) return { success: false, error: `Element for ${refId} disconnected` };

    const tag = (el.tagName || '').toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();

    try {
      el.scrollIntoView({ behavior: 'instant', block: 'center' });
      el.focus();

      if (tag === 'select') {
        // Set select value
        const options = Array.from(el.options);
        const target = options.find(o =>
          o.value === value ||
          o.textContent.trim().toLowerCase() === String(value).toLowerCase()
        );
        if (target) {
          el.value = target.value;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true, message: `Selected "${target.textContent.trim()}"` };
        }
        return { success: false, error: `Option "${value}" not found in select` };
      }

      if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
        const shouldCheck = value === true || value === 'true' || value === 'on' || value === '1';
        if (el.checked !== shouldCheck) {
          el.checked = shouldCheck;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return { success: true, message: `Set ${type} to ${shouldCheck}` };
      }

      if (tag === 'input' || tag === 'textarea') {
        // Clear existing value first
        const proto = tag === 'input' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

        // Select all existing text and delete it first
        el.select && el.select();

        if (descriptor?.set) {
          descriptor.set.call(el, value);
        } else {
          el.value = value;
        }
        // Dispatch events in the right order for React/Vue/Angular
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        // Also dispatch keyboard event for frameworks that listen to keyup
        el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        return { success: true, message: `Set value to "${String(value).substring(0, 50)}"` };
      }

      if (el.isContentEditable) {
        el.focus();
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(el);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        document.execCommand('insertText', false, value);
        return { success: true, message: `Set contenteditable to "${String(value).substring(0, 50)}"` };
      }

      return { success: false, error: `Element <${tag}> type="${type}" is not a form input` };
    } catch (e) {
      return { success: false, error: `setFormValue error: ${e.message}` };
    }
  };

  /**
   * Extract readable text content from page.
   */
  window.__getPageText = function(maxLength) {
    maxLength = maxLength || 50000;

    // Try to find article content first
    const articleSelectors = [
      'article', '[role="main"]', 'main',
      '.article-body', '.post-content', '.entry-content',
      '#content', '.content', '.story-body'
    ];

    for (const selector of articleSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.innerText?.trim();
        if (text && text.length > 100) {
          return text.substring(0, maxLength);
        }
      }
    }

    // Fallback: entire body text
    const bodyText = document.body?.innerText?.trim() || '';
    return bodyText.substring(0, maxLength);
  };

  console.log('[Crab-Agent] Accessibility tree injector loaded');
})();
