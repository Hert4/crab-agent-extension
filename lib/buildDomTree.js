/**
 * Crab-Agent DOM Tree Builder v2.0
 * Advanced DOM parsing with semantic extraction, viewport filtering,
 * bubble-up clicks, Shadow DOM/Iframe traversal, and obstruction detection.
 *
 * @license MIT
 */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const CONFIG = {
    MAX_ELEMENTS: Infinity,
    MAX_RECURSION_DEPTH: 5,
    MAX_TEXT_LENGTH: 120,
    HIGHLIGHT_Z_INDEX: 2147483647,
    DEBOUNCE_DELAY: 100,
    HIGHLIGHT_COLORS: [
      '#FF0000', '#00FF00', '#0000FF', '#FFA500', '#800080',
      '#008080', '#FF69B4', '#FFD700', '#00CED1', '#FF4500',
      '#9400D3', '#32CD32', '#FF1493', '#00BFFF', '#FF6347'
    ]
  };

  const STABLE_INDEX_STATE_KEY = '__crabAgentStableIndexState';
  const OVERLAY_CLASS = 'crab-agent-highlight-overlay';
  const LABEL_CLASS = 'crab-agent-highlight-label';
  const ELEMENT_REF_ATTR = 'data-crab-ref-id';

  // WeakRef element registry for memory-efficient element tracking
  const elementWeakRefs = new Map(); // ref_id -> WeakRef<Element>
  let refIdCounter = 0;

  // Tags to skip during traversal
  const SKIP_TAGS = new Set([
    'script', 'style', 'noscript', 'meta', 'link', 'head', 'template'
  ]);

  // Tags that should not receive interaction IDs (bubble up to parent)
  const BUBBLE_UP_TAGS = new Set([
    'span', 'svg', 'path', 'g', 'rect', 'circle', 'ellipse', 'line',
    'polyline', 'polygon', 'text', 'tspan', 'use', 'defs', 'symbol',
    'i', 'em', 'strong', 'b', 'small', 'mark', 'sub', 'sup', 'img'
  ]);

  // Tags that are inherently interactive
  const INTERACTIVE_TAGS = new Set([
    'a', 'button', 'input', 'textarea', 'select', 'details', 'summary'
  ]);

  // ARIA roles that indicate interactivity
  const INTERACTIVE_ROLES = new Set([
    'button', 'link', 'checkbox', 'radio', 'tab', 'menuitem', 'menuitemcheckbox',
    'menuitemradio', 'option', 'switch', 'textbox', 'combobox', 'listbox',
    'slider', 'spinbutton', 'searchbox', 'treeitem', 'gridcell', 'row'
  ]);

  // Container roles that should NOT receive IDs
  const CONTAINER_ROLES = new Set([
    'menu', 'menubar', 'listbox', 'list', 'tablist', 'tree', 'grid',
    'toolbar', 'group', 'radiogroup', 'tabpanel', 'treegrid'
  ]);

  // ============================================================================
  // STABLE INDEX STATE MANAGEMENT
  // ============================================================================

  function getStableState() {
    const pageKey = `${window.location.origin}${window.location.pathname}`;
    const existing = window[STABLE_INDEX_STATE_KEY];

    if (!existing || existing.pageKey !== pageKey ||
        typeof existing.nextIndex !== 'number' || !existing.signatureToIndex) {
      window[STABLE_INDEX_STATE_KEY] = {
        pageKey,
        nextIndex: 0,
        signatureToIndex: new Map()
      };
    } else if (existing.nextIndex > 10000) {
      // Reset if indices grow too large
      window[STABLE_INDEX_STATE_KEY] = {
        pageKey,
        nextIndex: 0,
        signatureToIndex: new Map()
      };
    }

    return window[STABLE_INDEX_STATE_KEY];
  }

  function buildStableSignature(element, xpath) {
    const tagName = element.tagName?.toLowerCase() || '';
    const id = element.id || '';
    const name = element.getAttribute?.('name') || '';
    const role = element.getAttribute?.('role') || '';
    const ariaLabel = element.getAttribute?.('aria-label') || '';

    const normalize = (val, max = 100) =>
      String(val || '').trim().toLowerCase().slice(0, max);

    return [
      normalize(tagName, 30),
      normalize(id, 60),
      normalize(name, 60),
      normalize(role, 30),
      normalize(ariaLabel, 100),
      normalize(xpath, 200)
    ].join('|');
  }

  function getStableIndex(element, xpath) {
    const state = getStableState();
    const signature = buildStableSignature(element, xpath);

    if (!state.signatureToIndex.has(signature)) {
      state.signatureToIndex.set(signature, state.nextIndex++);
    }

    return state.signatureToIndex.get(signature);
  }

  // ============================================================================
  // WEAKREF ELEMENT TRACKING
  // ============================================================================

  /**
   * Generate a unique ref_id for an element and store a WeakRef
   */
  function registerElementRef(element) {
    // Check if element already has a ref_id
    let refId = element.getAttribute?.(ELEMENT_REF_ATTR);
    if (refId) {
      // Update the WeakRef in case the old one was cleared
      elementWeakRefs.set(refId, new WeakRef(element));
      return refId;
    }

    // Generate new ref_id
    refId = `ref_${Date.now()}_${++refIdCounter}`;
    try {
      element.setAttribute(ELEMENT_REF_ATTR, refId);
    } catch (e) {
      // SVG elements may not support setAttribute, use fallback
    }

    // Store WeakRef
    elementWeakRefs.set(refId, new WeakRef(element));

    return refId;
  }

  /**
   * Get element by ref_id using WeakRef
   */
  function getElementByRefId(refId) {
    if (!refId) return null;

    const weakRef = elementWeakRefs.get(refId);
    if (weakRef) {
      const element = weakRef.deref();
      if (element && element.isConnected) {
        return element;
      }
      // Element was garbage collected or disconnected, clean up
      elementWeakRefs.delete(refId);
    }

    // Fallback: try to find by attribute
    try {
      const element = document.querySelector(`[${ELEMENT_REF_ATTR}="${refId}"]`);
      if (element) {
        // Re-register with new WeakRef
        elementWeakRefs.set(refId, new WeakRef(element));
        return element;
      }
    } catch (e) {}

    return null;
  }

  /**
   * Clean up stale WeakRefs (call periodically)
   */
  function cleanupWeakRefs() {
    for (const [refId, weakRef] of elementWeakRefs) {
      const element = weakRef.deref();
      if (!element || !element.isConnected) {
        elementWeakRefs.delete(refId);
      }
    }
  }

  // ============================================================================
  // VISIBILITY & VIEWPORT CHECKING
  // ============================================================================

  /**
   * Check if element is visible (not hidden by CSS)
   */
  function isElementVisible(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;

    try {
      const style = window.getComputedStyle(element);

      // Check display/visibility/opacity
      if (style.display === 'none') return false;
      if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
      if (parseFloat(style.opacity) === 0) return false;

      // Check if clipped to nothing
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;

      // Check for clip-path that hides element
      if (style.clipPath === 'inset(100%)' ||
          style.clip === 'rect(0px, 0px, 0px, 0px)') return false;

      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Check if element is within viewport bounds
   */
  function isInViewport(element, threshold = 0) {
    try {
      const rect = element.getBoundingClientRect();
      const viewHeight = window.innerHeight || document.documentElement.clientHeight;
      const viewWidth = window.innerWidth || document.documentElement.clientWidth;

      // Check if any part of the element is visible
      return (
        rect.bottom >= -threshold &&
        rect.right >= -threshold &&
        rect.top <= viewHeight + threshold &&
        rect.left <= viewWidth + threshold &&
        rect.width > 0 &&
        rect.height > 0
      );
    } catch (e) {
      return false;
    }
  }

  /**
   * Check if element is obstructed by another element (z-index overlay check)
   */
  function isElementObstructed(element) {
    try {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Check if point is within viewport
      if (centerX < 0 || centerY < 0 ||
          centerX > window.innerWidth || centerY > window.innerHeight) {
        return false; // Off-screen, not obstructed in viewport sense
      }

      // Temporarily hide our overlays to get accurate result
      const overlays = document.querySelectorAll(`.${OVERLAY_CLASS}`);
      overlays.forEach(o => o.style.pointerEvents = 'none');

      const topElement = document.elementFromPoint(centerX, centerY);

      overlays.forEach(o => o.style.pointerEvents = '');

      if (!topElement) return false;

      // Check if the element at point is the target or a descendant
      return !element.contains(topElement) && !topElement.contains(element) &&
             element !== topElement;
    } catch (e) {
      return false;
    }
  }

  // ============================================================================
  // SEMANTIC LABEL EXTRACTION
  // ============================================================================

  /**
   * Get semantic label for an element with priority-based fallback
   * Priority: aria-label > title > alt > sr-only text > innerText
   */
  function getSemanticLabel(element, maxLength = CONFIG.MAX_TEXT_LENGTH) {
    if (!element) return '';

    try {
      const tagName = element.tagName?.toLowerCase() || '';

      // 1. aria-label (highest priority)
      const ariaLabel = element.getAttribute?.('aria-label');
      if (ariaLabel?.trim()) {
        return truncateText(ariaLabel.trim(), maxLength);
      }

      // 2. aria-labelledby
      const labelledById = element.getAttribute?.('aria-labelledby');
      if (labelledById) {
        const labelElement = document.getElementById(labelledById);
        if (labelElement?.textContent?.trim()) {
          return truncateText(labelElement.textContent.trim(), maxLength);
        }
      }

      // 3. title attribute
      const title = element.getAttribute?.('title');
      if (title?.trim()) {
        return truncateText(title.trim(), maxLength);
      }

      // 4. alt text (for images)
      if (tagName === 'img' || tagName === 'area') {
        const alt = element.getAttribute?.('alt');
        if (alt?.trim()) {
          return truncateText(alt.trim(), maxLength);
        }
      }

      // 5. For inputs: value, placeholder
      if (tagName === 'input') {
        const type = element.getAttribute?.('type') || 'text';
        if (type === 'submit' || type === 'button') {
          const value = element.value;
          if (value?.trim()) return truncateText(value.trim(), maxLength);
        }
        const placeholder = element.getAttribute?.('placeholder');
        if (placeholder?.trim()) {
          return truncateText(`[${placeholder.trim()}]`, maxLength);
        }
      }

      if (tagName === 'textarea') {
        const placeholder = element.getAttribute?.('placeholder');
        if (placeholder?.trim()) {
          return truncateText(`[${placeholder.trim()}]`, maxLength);
        }
      }

      // 6. Screen reader only text (sr-only, visually-hidden, etc.)
      const srOnlyText = getSrOnlyText(element);
      if (srOnlyText) {
        return truncateText(srOnlyText, maxLength);
      }

      // 7. innerText / textContent
      const innerText = getVisibleText(element);
      if (innerText) {
        return truncateText(innerText, maxLength);
      }

      // 8. Fallback: Generate descriptive label
      return generateFallbackLabel(element);
    } catch (e) {
      return '';
    }
  }

  /**
   * Get screen reader only text from element
   */
  function getSrOnlyText(element) {
    try {
      // Common sr-only class patterns
      const srOnlySelectors = [
        '.sr-only', '.visually-hidden', '.screen-reader-text',
        '.screenreader', '.clip-hide', '[aria-hidden="false"]'
      ];

      for (const selector of srOnlySelectors) {
        const srElement = element.querySelector?.(selector);
        if (srElement?.textContent?.trim()) {
          return srElement.textContent.trim();
        }
      }

      // Check element itself
      const className = element.className?.toString?.() || '';
      if (/sr-only|visually-hidden|screen-reader/i.test(className)) {
        return element.textContent?.trim() || '';
      }

      return '';
    } catch (e) {
      return '';
    }
  }

  /**
   * Get visible text content, excluding hidden children
   */
  function getVisibleText(element) {
    try {
      // For inputs, get value
      const tagName = element.tagName?.toLowerCase() || '';
      if (tagName === 'input') {
        return element.value || '';
      }
      if (tagName === 'textarea') {
        return element.value || '';
      }
      if (tagName === 'select') {
        const selected = element.options?.[element.selectedIndex];
        return selected?.text || '';
      }

      // Use innerText which respects visibility
      let text = element.innerText || '';

      // Fallback to textContent for elements without innerText
      if (!text && element.textContent) {
        text = element.textContent;
      }

      return text.trim().replace(/\s+/g, ' ');
    } catch (e) {
      return '';
    }
  }

  /**
   * Generate fallback label when no text is available
   */
  function generateFallbackLabel(element) {
    const tagName = element.tagName?.toLowerCase() || '';
    const role = element.getAttribute?.('role') || '';
    const type = element.getAttribute?.('type') || '';
    const className = element.className?.toString?.() || '';

    // Try to infer from class names
    const meaningfulClasses = extractMeaningfulClasses(className);
    if (meaningfulClasses) {
      return `[${meaningfulClasses}]`;
    }

    // Generate based on tag/role/type
    if (role) {
      return `[Unlabeled ${role}]`;
    }
    if (type && tagName === 'input') {
      return `[Unlabeled ${type} input]`;
    }
    if (INTERACTIVE_TAGS.has(tagName)) {
      return `[Unlabeled ${tagName}]`;
    }

    return '[Unlabeled element]';
  }

  /**
   * Extract meaningful words from class names
   */
  function extractMeaningfulClasses(className) {
    if (!className) return '';

    const words = className
      .split(/[\s_-]+/)
      .filter(w => w.length > 2 && w.length < 20)
      .filter(w => !/^(js|css|ng|v-|is-|has-|el-|ant-|mui-|chakra-)/.test(w))
      .filter(w => !/^[a-z]{1,2}\d+$/i.test(w)) // Skip hash classes
      .slice(0, 3);

    return words.join(' ');
  }

  /**
   * Truncate text with ellipsis
   */
  function truncateText(text, maxLength) {
    if (!text) return '';
    text = text.trim().replace(/\s+/g, ' ');
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }

  // ============================================================================
  // INTERACTIVITY DETECTION
  // ============================================================================

  /**
   * Check if element is interactive (can receive user input)
   */
  function isInteractiveElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;

    try {
      const tagName = element.tagName?.toLowerCase() || '';

      // Native interactive elements
      if (INTERACTIVE_TAGS.has(tagName)) {
        // Links need href
        if (tagName === 'a') {
          return element.hasAttribute('href');
        }
        // Inputs should not be hidden type
        if (tagName === 'input') {
          return element.type !== 'hidden';
        }
        return true;
      }

      // ARIA role indicates interactivity
      const role = element.getAttribute?.('role');
      if (role && INTERACTIVE_ROLES.has(role)) {
        return true;
      }

      // Has explicit click handler
      if (element.onclick || element.getAttribute?.('onclick')) {
        return true;
      }

      // Framework event attributes
      const frameworkAttrs = [
        'ng-click', 'v-on:click', '@click', 'data-action',
        'data-toggle', 'data-target', 'data-dismiss'
      ];
      for (const attr of frameworkAttrs) {
        if (element.hasAttribute?.(attr)) return true;
      }

      // Tabindex makes it focusable/interactive
      const tabindex = element.getAttribute?.('tabindex');
      if (tabindex !== null && tabindex !== '-1') {
        return true;
      }

      // Content editable
      if (element.isContentEditable) {
        return true;
      }

      // Cursor pointer with meaningful content
      const style = window.getComputedStyle(element);
      if (style.cursor === 'pointer') {
        // Must have some indication it's meant to be interactive
        const hasIndicators =
          element.hasAttribute?.('role') ||
          element.hasAttribute?.('aria-label') ||
          element.hasAttribute?.('title') ||
          element.hasAttribute?.('tabindex') ||
          /btn|button|click|action|link|nav|tab|toggle|menu|icon|tool/i.test(
            element.className?.toString?.() || ''
          );

        if (hasIndicators) return true;

        // Has short meaningful text
        const text = getVisibleText(element);
        if (text.length > 0 && text.length < 80) return true;

        // Contains SVG icon - likely a clickable icon button
        const hasSvg = element.querySelector?.('svg');
        if (hasSvg) return true;

        // Small clickable element (likely icon)
        const rect = element.getBoundingClientRect?.();
        if (rect && rect.width > 10 && rect.width < 60 && rect.height > 10 && rect.height < 60) {
          // Small element with pointer cursor is likely an icon button
          return true;
        }
      }

      // Vue 3 runtime event listeners (_vei = Vue Event Invokers, more reliable than template attrs)
      if (element._vei && (element._vei.onClick || element._vei.onPointerdown || element._vei.onMousedown)) {
        return true;
      }

      // Vue/React framework detection
      const hasFrameworkInstance =
        element.__vue__ ||
        element.__vueParentComponent ||
        Object.keys(element).some(k =>
          k.startsWith('__reactFiber$') ||
          k.startsWith('__reactProps$')
        );

      if (hasFrameworkInstance) {
        const style = window.getComputedStyle(element);
        const text = getVisibleText(element);
        const looksClickable =
          style.cursor === 'pointer' ||
          (text.length > 0 && text.length < 80) ||
          element.hasAttribute?.('disabled') ||
          /btn|button|link|action/i.test(element.className?.toString?.() || '');

        if (looksClickable) return true;
      }

      // Class-name patterns for SaaS UI frameworks (MISA, Ant Design, Element UI, Vuetify, etc.)
      const cls = element.className?.toString?.() || '';
      if (cls && /menu-?item|trigger|toggle|toolbar-?item|controlpanel-?item|dropdown-?item|nav-?item|action-?item/i.test(cls)) {
        return true;
      }

      // Custom 'type' attribute on divs (MISA pattern: <div type="NPS">Satisfaction rating</div>)
      if (tagName === 'div' && element.hasAttribute?.('type') && element.textContent?.trim()) {
        return true;
      }

      return false;
    } catch (e) {
      return false;
    }
  }

  /**
   * Check if element should bubble up clicks to parent
   */
  function shouldBubbleUp(element) {
    if (!element) return false;

    const tagName = element.tagName?.toLowerCase() || '';

    // Check if tag is in bubble-up list
    if (!BUBBLE_UP_TAGS.has(tagName)) return false;

    // Find closest interactive parent - try standard selector first
    let interactiveParent = element.closest?.(
      'a, button, [role="button"], [role="link"], [role="menuitem"], ' +
      '[role="option"], [role="tab"], [tabindex]:not([tabindex="-1"])'
    );

    // If not found, look for parent with cursor: pointer (icon containers)
    if (!interactiveParent) {
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        try {
          const style = window.getComputedStyle(parent);
          if (style.cursor === 'pointer') {
            interactiveParent = parent;
            break;
          }
        } catch (e) {}
        parent = parent.parentElement;
      }
    }

    return !!interactiveParent && interactiveParent !== element;
  }

  /**
   * Check if element is a container (should not receive ID)
   */
  function isContainer(element) {
    const role = element.getAttribute?.('role');
    if (role && CONTAINER_ROLES.has(role)) return true;

    // Check if has multiple interactive children
    const interactiveChildren = element.querySelectorAll?.(
      '[role="menuitem"], [role="option"], [role="tab"], ' +
      '[role="treeitem"], [role="listitem"]'
    );

    return interactiveChildren && interactiveChildren.length > 1;
  }

  // ============================================================================
  // DOM TRAVERSAL
  // ============================================================================

  /**
   * Get XPath for element
   */
  function getXPath(element) {
    if (!element) return '';

    try {
      if (element.id) {
        return `//*[@id="${element.id}"]`;
      }

      const parts = [];
      let current = element;

      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let index = 1;
        let sibling = current.previousSibling;

        while (sibling) {
          if (sibling.nodeType === Node.ELEMENT_NODE &&
              sibling.tagName === current.tagName) {
            index++;
          }
          sibling = sibling.previousSibling;
        }

        const tagName = current.tagName.toLowerCase();
        parts.unshift(index > 1 ? `${tagName}[${index}]` : tagName);
        current = current.parentNode;
      }

      return '/' + parts.join('/');
    } catch (e) {
      return '';
    }
  }

  /**
   * Recursively collect elements from DOM tree including Shadow DOM and iframes
   */
  function collectElements(root, elements, depth = 0) {
    if (depth > CONFIG.MAX_RECURSION_DEPTH) return;
    if (!root) return;

    try {
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node) => {
            const tagName = node.tagName?.toLowerCase() || '';
            if (SKIP_TAGS.has(tagName)) return NodeFilter.FILTER_REJECT;
            if (node.classList?.contains?.(OVERLAY_CLASS)) return NodeFilter.FILTER_REJECT;
            if (node.classList?.contains?.(LABEL_CLASS)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      let node = walker.currentNode;
      while (node) {
        elements.push(node);

        // Traverse Shadow DOM
        if (node.shadowRoot) {
          collectElements(node.shadowRoot, elements, depth + 1);
        }

        // Traverse same-origin iframes
        if (node.tagName?.toLowerCase() === 'iframe') {
          try {
            const iframeDoc = node.contentDocument || node.contentWindow?.document;
            if (iframeDoc) {
              collectElements(iframeDoc, elements, depth + 1);
            }
          } catch (e) {
            // Cross-origin iframe, skip
          }
        }

        node = walker.nextNode();
      }
    } catch (e) {
      console.warn('Error collecting elements:', e);
    }
  }

  // ============================================================================
  // HIGHLIGHT RENDERING (SET-OF-MARK)
  // ============================================================================

  /**
   * Create highlight overlay for an element
   */
  function createHighlight(element, index, color) {
    try {
      const rect = element.getBoundingClientRect();

      const overlay = document.createElement('div');
      overlay.className = OVERLAY_CLASS;
      overlay.setAttribute('data-crab-index', index);

      Object.assign(overlay.style, {
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${Math.max(rect.width, 1)}px`,
        height: `${Math.max(rect.height, 1)}px`,
        border: `2px solid ${color}`,
        backgroundColor: `${color}22`,
        pointerEvents: 'none',
        zIndex: CONFIG.HIGHLIGHT_Z_INDEX,
        boxSizing: 'border-box'
      });

      const label = document.createElement('div');
      label.className = LABEL_CLASS;
      label.textContent = String(index);

      Object.assign(label.style, {
        position: 'absolute',
        top: '-18px',
        left: '-2px',
        backgroundColor: color,
        color: 'white',
        fontSize: '11px',
        fontWeight: 'bold',
        fontFamily: 'Arial, sans-serif',
        padding: '1px 4px',
        borderRadius: '3px',
        minWidth: '16px',
        textAlign: 'center',
        whiteSpace: 'nowrap'
      });

      overlay.appendChild(label);
      document.body.appendChild(overlay);

      return overlay;
    } catch (e) {
      return null;
    }
  }

  /**
   * Remove all highlight overlays
   */
  function removeHighlights() {
    try {
      const overlays = document.querySelectorAll(`.${OVERLAY_CLASS}`);
      overlays.forEach(overlay => overlay.remove());
    } catch (e) {
      // Ignore errors during cleanup
    }
  }

  // ============================================================================
  // MAIN BUILD FUNCTION
  // ============================================================================

  /**
   * Build DOM tree with interactive elements
   * @param {Object} options Configuration options
   * @returns {Object} DOM tree result
   */
  function buildDomTree(options = {}) {
    const {
      highlightElements = false,  // Disabled by default for clean UI
      viewportOnly = true,
      maxElements = CONFIG.MAX_ELEMENTS,
      includeObstructedInfo = true
    } = options;

    // Clean up previous highlights
    removeHighlights();

    const result = {
      elements: [],
      elementMap: {},
      textRepresentation: '',
      viewportInfo: null,
      url: window.location.href,
      title: document.title,
      timestamp: Date.now()
    };

    try {
      // Collect all elements
      const allElements = [];
      collectElements(document, allElements);

      // Track which elements get IDs (for bubble-up logic)
      const assignedElements = new Set();
      let collected = 0;

      // First pass: identify interactive elements and apply bubble-up
      for (const element of allElements) {
        if (collected >= maxElements) break;

        // Skip non-visible elements
        if (!isElementVisible(element)) continue;

        // Skip if not in viewport (when viewportOnly is true)
        if (viewportOnly && !isInViewport(element)) continue;

        // Check if element should bubble up to parent
        if (shouldBubbleUp(element)) {
          // Find the interactive parent and mark it instead
          let interactiveParent = element.closest?.(
            'a, button, [role="button"], [role="link"], [role="menuitem"], ' +
            '[role="option"], [role="tab"], [tabindex]:not([tabindex="-1"])'
          );

          // If not found, look for parent with cursor: pointer (icon containers)
          if (!interactiveParent) {
            let parent = element.parentElement;
            while (parent && parent !== document.body) {
              try {
                const style = window.getComputedStyle(parent);
                if (style.cursor === 'pointer') {
                  interactiveParent = parent;
                  break;
                }
              } catch (e) {}
              parent = parent.parentElement;
            }
          }

          if (interactiveParent && !assignedElements.has(interactiveParent)) {
            processElement(interactiveParent, result, assignedElements,
                           highlightElements, includeObstructedInfo);
            collected++;
          }
          continue;
        }

        // Skip containers
        if (isContainer(element)) continue;

        // Check if interactive
        if (!isInteractiveElement(element)) continue;

        // Skip if already assigned (from bubble-up)
        if (assignedElements.has(element)) continue;

        processElement(element, result, assignedElements,
                       highlightElements, includeObstructedInfo);
        collected++;
      }

      // Build text representation
      result.viewportInfo = {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: Math.round(window.scrollX),
        scrollY: Math.round(window.scrollY),
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
        devicePixelRatio: window.devicePixelRatio || 1
      };

      result.textRepresentation = buildTextRepresentation(result);

    } catch (e) {
      console.error('Error building DOM tree:', e);
      result.error = e.message;
    }

    return result;
  }

  /**
   * Process a single element and add to result
   */
  function processElement(element, result, assignedElements,
                          highlightElements, includeObstructedInfo) {
    try {
      const tagName = element.tagName?.toLowerCase() || '';
      const xpath = getXPath(element);
      const index = getStableIndex(element, xpath);
      const rect = element.getBoundingClientRect();

      // Register element with WeakRef and get ref_id
      const refId = registerElementRef(element);

      const elementInfo = {
        index,
        ref_id: refId,
        tagName,
        text: getSemanticLabel(element),
        attributes: getElementAttributes(element),
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        xpath,
        isInteractive: true,
        isContentEditable: element.isContentEditable || false,
        obstructed: includeObstructedInfo ? isElementObstructed(element) : false
      };

      result.elements.push(elementInfo);
      result.elementMap[index] = element; // Keep for backward compatibility
      result.refIdMap = result.refIdMap || {};
      result.refIdMap[refId] = index; // Map ref_id to index
      assignedElements.add(element);

      // Create highlight
      if (highlightElements) {
        const color = CONFIG.HIGHLIGHT_COLORS[index % CONFIG.HIGHLIGHT_COLORS.length];
        createHighlight(element, index, color);
      }
    } catch (e) {
      // Skip element on error
    }
  }

  /**
   * Get important attributes from element
   */
  function getElementAttributes(element) {
    const attrs = {};
    const importantAttrs = [
      'id', 'name', 'type', 'value', 'placeholder', 'href', 'src', 'alt', 'title',
      'aria-label', 'aria-describedby', 'aria-expanded', 'aria-checked',
      'aria-selected', 'aria-haspopup', 'role', 'data-testid', 'data-id'
    ];

    try {
      for (const attr of importantAttrs) {
        if (element.hasAttribute?.(attr)) {
          let value = element.getAttribute(attr);
          if (value && value.length > 100) {
            value = value.slice(0, 100) + '...';
          }
          if (value) {
            attrs[attr] = value;
          }
        }
      }

      // Include class but limit length
      if (element.className) {
        const className = element.className.toString?.() || '';
        if (className.length > 0 && className.length <= 100) {
          attrs.class = className;
        }
      }
    } catch (e) {
      // Ignore attribute errors
    }

    return attrs;
  }

  /**
   * Build text representation for LLM consumption
   */
  function buildTextRepresentation(result) {
    const lines = [];
    const { viewportInfo, elements } = result;

    // Header
    lines.push(`[Viewport: ${viewportInfo.width}x${viewportInfo.height}]`);
    lines.push(`[Scroll: Y=${viewportInfo.scrollY}/${viewportInfo.scrollHeight - viewportInfo.height}]`);
    lines.push(`[URL: ${result.url}]`);
    lines.push(`[Title: ${result.title}]`);
    lines.push('');
    lines.push('Interactive Elements:');

    // Pre-compute ordinal positions for menu items
    const menuItemOrdinals = computeMenuOrdinals(elements);

    // Element list
    for (const el of elements) {
      let line = `[${el.index}] <${el.tagName}>`;

      // Mark contenteditable
      if (el.isContentEditable) {
        line += ' [EDITABLE INPUT]';
      }

      // Mark obstructed
      if (el.obstructed) {
        line += ' [Obstructed]';
      }

      // Important attributes
      const attrs = el.attributes || {};
      if (attrs.type) line += ` type="${attrs.type}"`;
      if (attrs.role) line += ` role="${attrs.role}"`;
      if (attrs.id) line += ` id="${attrs.id}"`;
      if (attrs.name) line += ` name="${attrs.name}"`;
      if (attrs['aria-label']) line += ` aria-label="${attrs['aria-label']}"`;
      if (attrs.placeholder) line += ` placeholder="${attrs.placeholder}"`;
      if (attrs.href) {
        const href = attrs.href.length > 50 ?
          attrs.href.slice(0, 50) + '...' : attrs.href;
        line += ` href="${href}"`;
      }
      if (attrs['aria-expanded']) {
        line += ` aria-expanded="${attrs['aria-expanded']}"`;
      }

      // Menu item ordinal
      const ordinal = menuItemOrdinals.get(el.index);
      if (ordinal) {
        line += ` [item ${ordinal.pos}/${ordinal.total}]`;
      }

      // Text content
      if (el.text) {
        line += ` "${el.text}"`;
      }

      // Position hint (center coordinates)
      if (el.rect) {
        const cx = el.rect.x + Math.round(el.rect.width / 2);
        const cy = el.rect.y + Math.round(el.rect.height / 2);
        line += ` @(${cx},${cy})`;
      }

      lines.push(line);
    }

    return lines.join('\n');
  }

  /**
   * Compute ordinal positions for menu items
   */
  function computeMenuOrdinals(elements) {
    const ordinals = new Map();

    // Filter menu items
    const menuItems = elements.filter(el => {
      const role = el.attributes?.role;
      return role === 'menuitem' || role === 'option' || role === 'tab';
    });

    if (menuItems.length === 0) return ordinals;

    // Group by approximate x position (same menu column)
    const groups = new Map();
    for (const el of menuItems) {
      const xBucket = Math.round((el.rect?.x || 0) / 50) * 50;
      if (!groups.has(xBucket)) {
        groups.set(xBucket, []);
      }
      groups.get(xBucket).push(el);
    }

    // Sort each group by y and assign ordinals
    for (const group of groups.values()) {
      group.sort((a, b) => (a.rect?.y || 0) - (b.rect?.y || 0));
      group.forEach((el, idx) => {
        ordinals.set(el.index, { pos: idx + 1, total: group.length });
      });
    }

    return ordinals;
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Get element by index from last build result
   * Uses WeakRef for memory-efficient element retrieval
   */
  function getElementByIndex(index) {
    const lastResult = window.AgentSDom?.lastBuildResult;
    if (!lastResult) return null;

    // First try direct map (fast path)
    const directElement = lastResult.elementMap?.[index];
    if (directElement && directElement.isConnected) {
      return directElement;
    }

    // Fallback: find ref_id for this index and use WeakRef
    const elementInfo = lastResult.elements?.find(el => el.index === index);
    if (elementInfo?.ref_id) {
      const element = getElementByRefId(elementInfo.ref_id);
      if (element) {
        // Update the direct map for faster future lookups
        if (lastResult.elementMap) {
          lastResult.elementMap[index] = element;
        }
        return element;
      }
    }

    // Last resort: try XPath
    if (elementInfo?.xpath) {
      try {
        const result = document.evaluate(
          elementInfo.xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        if (result.singleNodeValue) {
          return result.singleNodeValue;
        }
      } catch (e) {}
    }

    return null;
  }

  /**
   * Get element by ref_id (preferred method for reliable element access)
   */
  function getElementByRef(refId) {
    return getElementByRefId(refId);
  }

  /**
   * Scroll element into view
   */
  function scrollToElement(element) {
    if (!element) return false;
    try {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Click element
   */
  function clickElement(element) {
    if (!element) return false;
    try {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => element.click(), 100);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Hover element (dispatch mouse events)
   */
  function hoverElement(element) {
    if (!element) return false;
    try {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      element.dispatchEvent(new MouseEvent('mouseenter', {
        bubbles: true, cancelable: true, view: window
      }));
      element.dispatchEvent(new MouseEvent('mouseover', {
        bubbles: true, cancelable: true, view: window
      }));

      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Input text into element
   */
  function inputText(element, text, clearFirst = true) {
    if (!element) return false;

    try {
      element.focus();

      if (clearFirst) {
        if (element.value !== undefined) {
          element.value = '';
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }

      if (element.value !== undefined) {
        element.value = text;
      } else if (element.isContentEditable) {
        element.textContent = text;
      }

      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));

      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Scroll page
   */
  function scrollPage(direction, amount = null) {
    const viewportHeight = window.innerHeight;

    switch (direction) {
      case 'up':
        window.scrollBy(0, -(amount || viewportHeight * 0.8));
        break;
      case 'down':
        window.scrollBy(0, amount || viewportHeight * 0.8);
        break;
      case 'top':
        window.scrollTo(0, 0);
        break;
      case 'bottom':
        window.scrollTo(0, document.documentElement.scrollHeight);
        break;
      case 'percent':
        if (amount !== null) {
          const targetY = (amount / 100) *
            (document.documentElement.scrollHeight - viewportHeight);
          window.scrollTo(0, targetY);
        }
        break;
    }

    return true;
  }

  /**
   * Scroll to text on page
   */
  function scrollToText(searchText) {
    if (!searchText) return false;

    try {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null
      );

      const normalizedSearch = searchText.toLowerCase();

      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.textContent?.toLowerCase().includes(normalizedSearch)) {
          const element = node.parentElement;
          if (element && isElementVisible(element)) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return true;
          }
        }
      }

      return false;
    } catch (e) {
      return false;
    }
  }

  /**
   * Wait for element to appear
   */
  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      // Check if already exists
      const existing = document.querySelector(selector);
      if (existing && isElementVisible(existing)) {
        resolve(existing);
        return;
      }

      // Use MutationObserver
      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element && isElementVisible(element)) {
          observer.disconnect();
          resolve(element);
        } else if (Date.now() - startTime > timeout) {
          observer.disconnect();
          reject(new Error(`Timeout waiting for element: ${selector}`));
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true
      });

      // Timeout fallback
      setTimeout(() => {
        observer.disconnect();
        const element = document.querySelector(selector);
        if (element && isElementVisible(element)) {
          resolve(element);
        } else {
          reject(new Error(`Timeout waiting for element: ${selector}`));
        }
      }, timeout);
    });
  }

  /**
   * Get page markdown content
   */
  function getMarkdownContent() {
    let markdown = `# ${document.title}\n\n`;

    try {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc?.content) {
        markdown += `> ${metaDesc.content}\n\n`;
      }

      const mainContent = document.querySelector(
        'main, article, [role="main"], .content, #content'
      ) || document.body;

      const elements = mainContent.querySelectorAll(
        'h1, h2, h3, h4, h5, h6, p, li, pre, code, blockquote'
      );

      for (const el of elements) {
        if (!isElementVisible(el)) continue;

        const tagName = el.tagName.toLowerCase();
        const text = el.innerText?.trim();
        if (!text) continue;

        switch (tagName) {
          case 'h1': markdown += `# ${text}\n\n`; break;
          case 'h2': markdown += `## ${text}\n\n`; break;
          case 'h3': markdown += `### ${text}\n\n`; break;
          case 'h4':
          case 'h5':
          case 'h6': markdown += `#### ${text}\n\n`; break;
          case 'p': markdown += `${text}\n\n`; break;
          case 'li': markdown += `- ${text}\n`; break;
          case 'pre':
          case 'code': markdown += `\`\`\`\n${text}\n\`\`\`\n\n`; break;
          case 'blockquote': markdown += `> ${text}\n\n`; break;
        }
      }
    } catch (e) {
      markdown += `Error extracting content: ${e.message}`;
    }

    return markdown;
  }

  /**
   * Compute DOM hash for state comparison
   */
  function computeDomHash() {
    try {
      const significantElements = document.querySelectorAll(
        'a, button, input, select, textarea, [role]'
      );

      let hash = '';
      const sample = Array.from(significantElements).slice(0, 50);

      for (const el of sample) {
        hash += el.tagName + (el.id || '') + (el.textContent?.slice(0, 20) || '');
      }

      // Simple hash function
      let hashValue = 0;
      for (let i = 0; i < hash.length; i++) {
        hashValue = ((hashValue << 5) - hashValue) + hash.charCodeAt(i);
        hashValue = hashValue & hashValue; // Convert to 32bit integer
      }

      return hashValue.toString(16);
    } catch (e) {
      return Date.now().toString(16);
    }
  }

  // ============================================================================
  // EXPOSE API
  // ============================================================================

  window.AgentSDom = {
    // Core functions
    buildDomTree,
    removeHighlights,

    // Element access
    getElementByIndex,
    getElementByRef,
    cleanupWeakRefs,

    // Navigation
    scrollToElement,
    scrollPage,
    scrollToText,

    // Interaction
    clickElement,
    hoverElement,
    inputText,

    // Async utilities
    waitForElement,

    // Content extraction
    getMarkdownContent,
    getSemanticLabel,

    // State utilities
    computeDomHash,

    // Visibility checks
    isElementVisible,
    isInViewport,
    isElementObstructed,
    isInteractiveElement,

    // Storage for last result
    lastBuildResult: null
  };

  // ============================================================================
  // CLAUDE-COMPATIBLE ACCESSIBILITY TREE API
  // Provides __generateAccessibilityTree matching Claude extension spec
  // ============================================================================

  /**
   * Generate accessibility tree in Claude extension format.
   * @param {string} filter - 'interactive' or 'all'
   * @param {number} depth - Max tree depth (default 15)
   * @param {string|null} refId - Scope to subtree of this ref
   * @param {boolean} includeCoords - Include coordinates in output
   * @param {number} maxChars - Max output characters (default Infinity - no limit)
   * @returns {{ success: boolean, lines: string[], nodeCount: number, truncated: boolean, error?: string }}
   */
  function generateAccessibilityTree(filter = 'all', depth = 50, refId = null, includeCoords = true, maxChars = Infinity) {
    try {
      // Initialize element map if needed
      if (!window.__crabElementMap) {
        window.__crabElementMap = {};
        window.__crabRefCounter = 0;
      }

      const lines = [];
      let nodeCount = 0;
      let charCount = 0;
      let truncated = false;
      const maxDepth = Math.min(50, Math.max(1, depth));
      const interactiveOnly = filter === 'interactive';

      // Find root element (scope to refId if provided)
      let rootElement = document.body;
      if (refId) {
        const scopeEl = window.__crabElementMap[refId]?.deref?.() ||
                        window.__crabElementMap[refId] ||
                        document.querySelector(`[data-crab-ref-id="${refId}"]`);
        if (scopeEl && scopeEl.isConnected) {
          rootElement = scopeEl;
        } else {
          return { success: false, error: `Ref ${refId} not found or disconnected` };
        }
      }

      // Role mapping (tag -> ARIA role)
      const ROLE_MAP = {
        'a': 'link', 'button': 'button', 'input': 'textbox', 'textarea': 'textbox',
        'select': 'combobox', 'option': 'option', 'img': 'image', 'nav': 'navigation',
        'header': 'banner', 'footer': 'contentinfo', 'main': 'main', 'aside': 'complementary',
        'article': 'article', 'section': 'region', 'form': 'form', 'table': 'table',
        'ul': 'list', 'ol': 'list', 'li': 'listitem', 'h1': 'heading', 'h2': 'heading',
        'h3': 'heading', 'h4': 'heading', 'h5': 'heading', 'h6': 'heading',
        'dialog': 'dialog', 'details': 'group', 'summary': 'button', 'menu': 'menu'
      };

      // Get or create ref for element
      function getOrCreateRef(el) {
        // Check existing ref
        const existingRef = el.getAttribute?.('data-crab-ref-id');
        if (existingRef && window.__crabElementMap[existingRef]) {
          return existingRef;
        }
        // Create new ref
        const refId = 'ref_' + (++window.__crabRefCounter);
        try { el.setAttribute('data-crab-ref-id', refId); } catch(e) {}
        window.__crabElementMap[refId] = new WeakRef(el);
        return refId;
      }

      // Get accessible name
      function getAccessibleName(el) {
        const ariaLabel = el.getAttribute?.('aria-label');
        if (ariaLabel?.trim()) return ariaLabel.trim();

        const title = el.getAttribute?.('title');
        if (title?.trim()) return title.trim();

        const alt = el.getAttribute?.('alt');
        if (alt?.trim()) return alt.trim();

        const placeholder = el.getAttribute?.('placeholder');
        if (placeholder?.trim()) return placeholder.trim();

        // For inputs, get value
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          if (el.value?.trim()) return el.value.trim().substring(0, 50);
        }

        // For select, get selected option text
        if (el.tagName === 'SELECT') {
          const opt = el.options?.[el.selectedIndex];
          if (opt?.text) return opt.text.trim();
        }

        // Get inner text (limited)
        const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
        return text.substring(0, 80);
      }

      // Get role for element
      function getRole(el) {
        const explicitRole = el.getAttribute?.('role');
        if (explicitRole) return explicitRole;

        const tag = el.tagName?.toLowerCase() || '';

        // Special cases
        if (tag === 'input') {
          const type = el.getAttribute?.('type') || 'text';
          if (type === 'checkbox') return 'checkbox';
          if (type === 'radio') return 'radio';
          if (type === 'submit' || type === 'button') return 'button';
          if (type === 'search') return 'searchbox';
          return 'textbox';
        }

        return ROLE_MAP[tag] || tag;
      }

      // Check if element is interactive
      function isInteractive(el) {
        const tag = el.tagName?.toLowerCase() || '';
        if (['a', 'button', 'input', 'textarea', 'select', 'details', 'summary'].includes(tag)) {
          if (tag === 'a') return el.hasAttribute('href');
          if (tag === 'input') return el.type !== 'hidden';
          return true;
        }
        const role = el.getAttribute?.('role');
        if (['button', 'link', 'checkbox', 'radio', 'tab', 'menuitem', 'option', 'switch', 'textbox', 'combobox', 'slider'].includes(role)) {
          return true;
        }
        if (el.onclick || el.getAttribute?.('onclick') || el.getAttribute?.('tabindex') === '0') {
          return true;
        }
        if (el.isContentEditable) return true;
        try {
          const style = window.getComputedStyle(el);
          if (style.cursor === 'pointer') return true;
        } catch(e) {}
        return false;
      }

      // Check visibility
      function isVisible(el) {
        try {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        } catch(e) { return false; }
      }

      // Walk tree recursively
      function walkTree(el, currentDepth, indent) {
        if (truncated || currentDepth > maxDepth) return;
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return;

        const tag = el.tagName?.toLowerCase() || '';

        // Skip non-content elements
        if (['script', 'style', 'noscript', 'meta', 'link', 'template', 'head'].includes(tag)) return;
        // Skip our overlays
        if (el.classList?.contains?.('crab-agent-highlight-overlay')) return;

        // Check visibility
        if (!isVisible(el)) return;

        // Check if should include
        const interactive = isInteractive(el);
        if (interactiveOnly && !interactive) {
          // Still walk children for interactive-only mode
          for (const child of el.children || []) {
            walkTree(child, currentDepth + 1, indent);
          }
          return;
        }

        // Build line
        const role = getRole(el);
        const name = getAccessibleName(el);
        const ref = getOrCreateRef(el);

        let line = `${' '.repeat(currentDepth * 2)}${role}`;
        if (name) line += ` "${name.substring(0, 60)}"`;
        line += ` [${ref}]`;

        // Add attributes
        const type = el.getAttribute?.('type');
        if (type) line += ` type="${type}"`;

        const href = el.getAttribute?.('href');
        if (href) line += ` href="${href.substring(0, 40)}${href.length > 40 ? '...' : ''}"`;

        const placeholder = el.getAttribute?.('placeholder');
        if (placeholder) line += ` placeholder="${placeholder.substring(0, 30)}"`;

        const ariaExpanded = el.getAttribute?.('aria-expanded');
        if (ariaExpanded) line += ` aria-expanded="${ariaExpanded}"`;

        const ariaChecked = el.getAttribute?.('aria-checked');
        if (ariaChecked) line += ` aria-checked="${ariaChecked}"`;

        const disabled = el.hasAttribute?.('disabled');
        if (disabled) line += ` disabled`;

        // Add coordinates if requested
        if (includeCoords) {
          try {
            const rect = el.getBoundingClientRect();
            const cx = Math.round(rect.x + rect.width / 2);
            const cy = Math.round(rect.y + rect.height / 2);
            line += ` @(${cx},${cy})`;
          } catch(e) {}
        }

        // Check truncation
        if (charCount + line.length > maxChars) {
          truncated = true;
          return;
        }

        lines.push(line);
        nodeCount++;
        charCount += line.length + 1;

        // Handle select options specially
        if (tag === 'select') {
          for (const opt of el.options || []) {
            const optLine = `${' '.repeat((currentDepth + 1) * 2)}option "${opt.text}"${opt.selected ? ' (selected)' : ''} value="${opt.value}"`;
            if (charCount + optLine.length <= maxChars) {
              lines.push(optLine);
              nodeCount++;
              charCount += optLine.length + 1;
            }
          }
          return; // Don't walk children of select
        }

        // Walk children
        for (const child of el.children || []) {
          walkTree(child, currentDepth + 1, indent + '  ');
        }
      }

      // Start walking
      walkTree(rootElement, 0, '');

      return {
        success: true,
        lines,
        nodeCount,
        truncated,
        filter,
        depth: maxDepth
      };

    } catch (e) {
      return { success: false, error: `Accessibility tree generation failed: ${e.message}` };
    }
  }

  // Expose Claude-compatible API globally
  window.__generateAccessibilityTree = generateAccessibilityTree;

  // Also expose element map for ref resolution
  if (!window.__crabElementMap) {
    window.__crabElementMap = {};
    window.__crabRefCounter = 0;
  }

})();
