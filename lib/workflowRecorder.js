/**
 * Workflow Recorder - Records user interactions on web pages
 * Injected into pages via content.js when user starts recording
 */

(function () {
  'use strict';

  if (window.__crabWorkflowRecorder) return;

  const MAX_TEXT_LENGTH = 100;
  let isRecording = false;
  let recordedActions = [];
  let actionIndex = 0;

  // ============================================================================
  // SELECTOR GENERATION
  // ============================================================================

  function generateXPath(element) {
    if (element.id) return `//*[@id="${element.id}"]`;
    const parts = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 1;
      let sibling = current.previousElementSibling;
      while (sibling) {
        if (sibling.tagName === current.tagName) index++;
        sibling = sibling.previousElementSibling;
      }
      const tagName = current.tagName.toLowerCase();
      parts.unshift(
        index > 1 || current.nextElementSibling?.tagName === current.tagName
          ? `${tagName}[${index}]`
          : tagName
      );
      current = current.parentElement;
    }
    return '/' + parts.join('/');
  }

  // Patterns that indicate dynamic/unstable containers - skip nth-of-type for these
  const DYNAMIC_CLASS_PATTERNS = /dx-overlay|dx-popup|modal|dialog|popover|tooltip|dropdown|menu|overlay/i;

  function generateCSSSelector(element) {
    if (element.id) return `#${CSS.escape(element.id)}`;
    const parts = [];
    let current = element;
    let depth = 0;
    while (current && current !== document.body && current !== document.documentElement && depth < 6) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        parts.unshift(`#${CSS.escape(current.id)}`);
        break;
      }
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c =>
          c && !c.match(/^(hover|focus|active|crab-|dx-state-)/)
        );
        if (classes.length > 0) {
          selector += '.' + classes.slice(0, 2).map(c => CSS.escape(c)).join('.');
        }
      }
      // Only add nth-of-type for stable elements (not overlays/popups)
      const isDynamic = DYNAMIC_CLASS_PATTERNS.test(current.className || '');
      if (!isDynamic) {
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
          if (siblings.length > 1) {
            const idx = siblings.indexOf(current) + 1;
            selector += `:nth-of-type(${idx})`;
          }
        }
      }
      parts.unshift(selector);
      current = current.parentElement;
      depth++;
    }
    return parts.join(' > ');
  }

  function getNthChildIndex(element) {
    if (!element.parentElement) return 0;
    return Array.from(element.parentElement.children).indexOf(element);
  }

  function getParentContext(element) {
    const parts = [];
    let current = element.parentElement;
    let depth = 0;
    while (current && depth < 2 && current !== document.body) {
      const tag = current.tagName.toLowerCase();
      const cls = current.className && typeof current.className === 'string'
        ? current.className.trim().split(/\s+/).slice(0, 2).join('.')
        : '';
      parts.push(cls ? `${tag}.${cls}` : tag);
      current = current.parentElement;
      depth++;
    }
    return parts.join(' > ');
  }

  function truncate(str, max) {
    if (!str) return '';
    str = str.trim().replace(/\s+/g, ' ');
    return str.length > max ? str.slice(0, max) + '...' : str;
  }

  // ============================================================================
  // TARGET INFO EXTRACTION
  // ============================================================================

  function getTooltipLabel(el) {
    // All common tooltip attribute names used by various UI frameworks
    const attrs = ['aria-label', 'title', 'data-tooltip', 'data-title', 'data-tip',
                   'data-hint', 'data-content', 'aria-description', 'data-original-title'];
    for (const attr of attrs) {
      const val = el.getAttribute(attr);
      if (val && val.trim() && val !== 'undefined') return val.trim();
    }
    return '';
  }

  function extractTargetInfo(element) {
    // Walk up to find the most meaningful ancestor for icon buttons
    let labelSource = element;
    let label = getTooltipLabel(element);
    if (!label) {
      let current = element.parentElement;
      for (let depth = 0; depth < 8; depth++) {
        if (!current || current === document.body) break;
        label = getTooltipLabel(current);
        if (label) { labelSource = current; break; }
        // Also check siblings (some frameworks put tooltip on a sibling span)
        const siblings = current.children;
        for (const sib of siblings) {
          if (sib === element) continue;
          const sibLabel = getTooltipLabel(sib);
          if (sibLabel && sib.tagName.toLowerCase() !== 'button') {
            label = sibLabel; labelSource = sib; break;
          }
        }
        if (label) break;
        current = current.parentElement;
      }
    }

    // Use the discovered label as the primary semantic identifier
    const innerTxt = truncate(element.innerText, MAX_TEXT_LENGTH);
    const contentTxt = truncate(element.textContent, MAX_TEXT_LENGTH);

    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id || '',
      classList: element.className && typeof element.className === 'string'
        ? element.className.trim().split(/\s+/).filter(Boolean)
        : [],
      textContent: contentTxt,
      innerText: innerTxt,
      name: element.name || '',
      type: element.type || '',
      placeholder: element.placeholder || '',
      // Unified label field - best semantic description found
      ariaLabel: label || '',
      title: element.getAttribute('title') || labelSource.getAttribute('title') || '',
      tooltip: element.getAttribute('data-tooltip') || labelSource.getAttribute('data-tooltip') || '',
      role: element.getAttribute('role') || element.tagName.toLowerCase(),
      href: element.href || '',
      src: element.src || '',
      xpath: generateXPath(element),
      cssSelector: generateCSSSelector(element),
      nthChild: getNthChildIndex(element),
      parentContext: getParentContext(element)
    };
  }

  // ============================================================================
  // ACTION RECORDING
  // ============================================================================

  function createAction(type, element, extra = {}) {
    return {
      index: actionIndex++,
      type,
      timestamp: Date.now(),
      target: extractTargetInfo(element),
      value: extra.value || '',
      key: extra.key || '',
      url: window.location.href,
      pageTitle: document.title,
      ...extra
    };
  }

  function emitAction(action) {
    recordedActions.push(action);
    try {
      chrome.runtime.sendMessage({
        type: 'WORKFLOW_RECORD_ACTION',
        action
      });
    } catch (e) {
      // Extension context may be invalid
    }
  }

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  function isInteractive(el) {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role');
    const interactiveTags = ['a', 'button', 'input', 'textarea', 'select', 'details', 'summary', 'label'];
    const interactiveRoles = ['button', 'link', 'checkbox', 'radio', 'tab', 'menuitem', 'switch', 'textbox', 'combobox', 'option', 'listbox'];
    return interactiveTags.includes(tag) || interactiveRoles.includes(role) || el.onclick || el.hasAttribute('onclick') || el.getAttribute('tabindex') !== null;
  }

  function findInteractiveAncestor(el) {
    let current = el;
    let best = el;
    let depth = 0;
    while (current && current !== document.body && depth < 8) {
      const tag = current.tagName.toLowerCase();
      const role = current.getAttribute('role');
      const ariaLabel = current.getAttribute('aria-label');
      const hasText = (current.innerText || '').trim().length > 0 &&
                      (current.innerText || '').trim().length < 80;

      // Prefer elements with semantic meaning: aria-label, text, or proper role
      if (ariaLabel || (hasText && tag !== 'svg' && tag !== 'path')) {
        best = current;
      }
      if (['a', 'button', 'input', 'textarea', 'select'].includes(tag)) {
        return current; // Hard stop at native interactive elements
      }
      if (['button', 'link', 'menuitem', 'tab', 'option'].includes(role)) {
        return current;
      }
      current = current.parentElement;
      depth++;
    }
    // Return best candidate found (prefers aria-label/text over raw svg)
    return best;
  }

  function handleClick(e) {
    if (!isRecording) return;
    const target = findInteractiveAncestor(e.target);
    const action = createAction('click', target);
    emitAction(action);
  }

  function handleInput(e) {
    if (!isRecording) return;
    const target = e.target;
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    // Debounce: update last action if same target and type
    const last = recordedActions[recordedActions.length - 1];
    if (last && last.type === 'input' && last.target.cssSelector === generateCSSSelector(target)) {
      last.value = target.value;
      last.timestamp = Date.now();
      return;
    }
    const action = createAction('input', target, { value: target.value });
    emitAction(action);
  }

  function handleChange(e) {
    if (!isRecording) return;
    const target = e.target;
    if (target.tagName === 'SELECT') {
      const action = createAction('select', target, {
        value: target.value,
        selectedText: target.options[target.selectedIndex]?.textContent || ''
      });
      emitAction(action);
    }
  }

  function handleKeydown(e) {
    if (!isRecording) return;
    const importantKeys = ['Enter', 'Tab', 'Escape', 'Backspace', 'Delete'];
    if (!importantKeys.includes(e.key)) return;
    const action = createAction('keydown', e.target, { key: e.key });
    emitAction(action);
  }

  function handleSubmit(e) {
    if (!isRecording) return;
    const form = e.target;
    const action = createAction('submit', form);
    emitAction(action);
  }

  let lastUrl = window.location.href;
  function checkNavigation() {
    if (!isRecording) return;
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      const action = {
        index: actionIndex++,
        type: 'navigate',
        timestamp: Date.now(),
        target: { tagName: 'window', id: '', classList: [], textContent: '', innerText: '', name: '', type: '', placeholder: '', ariaLabel: '', role: '', href: currentUrl, src: '', xpath: '', cssSelector: '', nthChild: 0, parentContext: '' },
        value: currentUrl,
        key: '',
        url: currentUrl,
        pageTitle: document.title,
        fromUrl: lastUrl
      };
      lastUrl = currentUrl;
      emitAction(action);
    }
  }

  let navigationObserver = null;

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  function startRecording() {
    if (isRecording) return;
    isRecording = true;
    recordedActions = [];
    actionIndex = 0;
    lastUrl = window.location.href;

    document.addEventListener('click', handleClick, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleChange, true);
    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('submit', handleSubmit, true);

    // Monitor URL changes (SPA navigation)
    navigationObserver = setInterval(checkNavigation, 500);

    console.log('[Crab-Agent] Workflow recording started');
  }

  function stopRecording() {
    if (!isRecording) return;
    isRecording = false;

    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('input', handleInput, true);
    document.removeEventListener('change', handleChange, true);
    document.removeEventListener('keydown', handleKeydown, true);
    document.removeEventListener('submit', handleSubmit, true);

    if (navigationObserver) {
      clearInterval(navigationObserver);
      navigationObserver = null;
    }

    console.log('[Crab-Agent] Workflow recording stopped, actions:', recordedActions.length);
    return [...recordedActions];
  }

  function getRecordedActions() {
    return [...recordedActions];
  }

  function getIsRecording() {
    return isRecording;
  }

  // Expose API
  window.__crabWorkflowRecorder = {
    startRecording,
    stopRecording,
    getRecordedActions,
    isRecording: getIsRecording
  };

  // Listen for commands from content.js / background.js
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'WORKFLOW_START_RECORD') {
      startRecording();
      sendResponse({ success: true });
    } else if (message.type === 'WORKFLOW_STOP_RECORD') {
      const actions = stopRecording();
      sendResponse({ success: true, actions });
    } else if (message.type === 'WORKFLOW_GET_ACTIONS') {
      sendResponse({ success: true, actions: getRecordedActions(), isRecording });
    }
    return true;
  });

})();
