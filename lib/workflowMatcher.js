/**
 * Workflow Matcher - Finds elements on a page matching recorded target info.
 * Supports fuzzy matching for workflow generalization across different contexts.
 */

(function () {
  'use strict';

  if (window.__crabWorkflowMatcher) return;

  // ============================================================================
  // STRING SIMILARITY (Levenshtein-based)
  // ============================================================================

  function levenshtein(a, b) {
    if (!a || !b) return Math.max((a || '').length, (b || '').length);
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = b[i - 1] === a[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[b.length][a.length];
  }

  function stringSimilarity(a, b) {
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    a = a.toLowerCase().trim();
    b = b.toLowerCase().trim();
    if (a === b) return 1;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    return 1 - levenshtein(a, b) / maxLen;
  }

  function containsSimilar(text, query) {
    if (!text || !query) return 0;
    text = text.toLowerCase().trim();
    query = query.toLowerCase().trim();
    if (text.includes(query)) return 1;
    if (query.includes(text)) return 0.8;
    return stringSimilarity(text, query) > 0.6 ? stringSimilarity(text, query) : 0;
  }

  // ============================================================================
  // ELEMENT SCORING
  // ============================================================================

  function scoreElement(element, targetInfo) {
    let score = 0;
    let maxScore = 0;

    // === ID match (highest priority) ===
    if (targetInfo.id) {
      maxScore += 30;
      if (element.id === targetInfo.id) score += 30;
    }

    // === Tag name match ===
    maxScore += 10;
    if (element.tagName.toLowerCase() === targetInfo.tagName) score += 10;

    // === Role match ===
    if (targetInfo.role) {
      maxScore += 8;
      const elRole = element.getAttribute('role') || element.tagName.toLowerCase();
      if (elRole === targetInfo.role) score += 8;
    }

    // === Type match (for inputs) ===
    if (targetInfo.type) {
      maxScore += 8;
      if (element.type === targetInfo.type) score += 8;
    }

    // === Name attribute match ===
    if (targetInfo.name) {
      maxScore += 10;
      if (element.name === targetInfo.name) score += 10;
    }

    // === Class match ===
    if (targetInfo.classList && targetInfo.classList.length > 0) {
      maxScore += 12;
      const elClasses = element.className && typeof element.className === 'string'
        ? element.className.trim().split(/\s+/)
        : [];
      const matchCount = targetInfo.classList.filter(c => elClasses.includes(c)).length;
      score += (matchCount / targetInfo.classList.length) * 12;
    }

    // === Text content match (fuzzy) ===
    if (targetInfo.textContent) {
      maxScore += 10;
      const elText = (element.textContent || '').trim().substring(0, 200);
      score += containsSimilar(elText, targetInfo.textContent) * 10;
    }

    // === Aria label match ===
    if (targetInfo.ariaLabel) {
      maxScore += 10;
      const elAria = element.getAttribute('aria-label') || '';
      score += stringSimilarity(elAria, targetInfo.ariaLabel) * 10;
    }

    // === Placeholder match ===
    if (targetInfo.placeholder) {
      maxScore += 8;
      score += stringSimilarity(element.placeholder || '', targetInfo.placeholder) * 8;
    }

    // === Href match ===
    if (targetInfo.href) {
      maxScore += 6;
      if (element.href === targetInfo.href) score += 6;
      else if (element.href && targetInfo.href && new URL(element.href, location.href).pathname === new URL(targetInfo.href, location.href).pathname) score += 4;
    }

    // === Parent context match ===
    if (targetInfo.parentContext) {
      maxScore += 6;
      const currentParentCtx = getParentContext(element);
      score += stringSimilarity(currentParentCtx, targetInfo.parentContext) * 6;
    }

    // === Structural position (nthChild) ===
    if (typeof targetInfo.nthChild === 'number') {
      maxScore += 4;
      const currentNth = element.parentElement
        ? Array.from(element.parentElement.children).indexOf(element)
        : -1;
      if (currentNth === targetInfo.nthChild) score += 4;
      else if (Math.abs(currentNth - targetInfo.nthChild) <= 1) score += 2;
    }

    return maxScore > 0 ? score / maxScore : 0;
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

  // ============================================================================
  // ELEMENT FINDING STRATEGIES
  // ============================================================================

  function findElement(targetInfo, parameterOverrides = {}) {
    // Apply parameter overrides to target info for generalization
    const target = { ...targetInfo };
    if (parameterOverrides.textContent) target.textContent = parameterOverrides.textContent;
    if (parameterOverrides.value) target.value = parameterOverrides.value;

    // Strategy 1: ID lookup
    if (target.id) {
      const el = document.getElementById(target.id);
      if (el) {
        const conf = scoreElement(el, target);
        if (conf > 0.5) return { element: el, confidence: conf, strategy: 'id' };
      }
    }

    // Strategy 2: CSS selector
    if (target.cssSelector) {
      try {
        const el = document.querySelector(target.cssSelector);
        if (el) {
          const conf = scoreElement(el, target);
          if (conf > 0.4) return { element: el, confidence: conf, strategy: 'css' };
        }
      } catch (e) { /* invalid selector */ }
    }

    // Strategy 3: XPath
    if (target.xpath) {
      try {
        const result = document.evaluate(target.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const el = result.singleNodeValue;
        if (el && el.nodeType === Node.ELEMENT_NODE) {
          const conf = scoreElement(el, target);
          if (conf > 0.4) return { element: el, confidence: conf, strategy: 'xpath' };
        }
      } catch (e) { /* invalid xpath */ }
    }

    // Strategy 4: Fuzzy match across all matching elements
    const tagSelector = target.tagName || '*';
    const candidates = document.querySelectorAll(tagSelector);
    let bestMatch = null;
    let bestScore = 0;

    for (const el of candidates) {
      // Skip hidden elements
      if (el.offsetWidth === 0 && el.offsetHeight === 0) continue;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      const score = scoreElement(el, target);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = el;
      }
    }

    if (bestMatch && bestScore > 0.4) {
      return { element: bestMatch, confidence: bestScore, strategy: 'fuzzy' };
    }

    // Strategy 5: Parent context + nthChild fallback
    if (target.parentContext && typeof target.nthChild === 'number') {
      try {
        const parentParts = target.parentContext.split(' > ');
        if (parentParts.length > 0) {
          const parentSelector = parentParts[0];
          const parents = document.querySelectorAll(parentSelector);
          for (const parent of parents) {
            const child = parent.children[target.nthChild];
            if (child && child.tagName.toLowerCase() === target.tagName) {
              return { element: child, confidence: 0.45, strategy: 'structural' };
            }
          }
        }
      } catch (e) { /* selector error */ }
    }

    return { element: null, confidence: 0, strategy: 'none' };
  }

  // ============================================================================
  // WAIT FOR ELEMENT (with retry)
  // ============================================================================

  function waitForElement(targetInfo, parameterOverrides = {}, timeoutMs = 5000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const interval = 300;

      function attempt() {
        const result = findElement(targetInfo, parameterOverrides);
        if (result.element && result.confidence > 0.4) {
          resolve(result);
          return;
        }
        if (Date.now() - startTime > timeoutMs) {
          resolve(result); // Return best match even if low confidence
          return;
        }
        setTimeout(attempt, interval);
      }

      attempt();
    });
  }

  // Expose API
  window.__crabWorkflowMatcher = {
    findElement,
    waitForElement,
    scoreElement,
    stringSimilarity
  };

})();
