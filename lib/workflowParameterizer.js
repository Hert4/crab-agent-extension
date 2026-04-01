/**
 * Workflow Parameterizer - Detects values in recorded steps that can be parameterized
 * for workflow generalization (e.g., record "delete group aaa" → replay "delete group bbb")
 */

(function () {
  'use strict';

  /**
   * Analyze recorded workflow steps and suggest parameters
   * @param {Array} steps - Array of recorded action objects
   * @returns {Array} Suggested parameters
   */
  function detectParameters(steps) {
    const suggestions = [];
    let paramCount = 0;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // 1. Input steps with non-empty values → likely parameterizable
      if ((step.type === 'input' || step.type === 'select') && step.value) {
        const paramName = generateParamName(step, paramCount);
        suggestions.push({
          stepIndex: i,
          field: 'value',
          paramName,
          defaultValue: step.value,
          description: describeStep(step),
          confidence: 0.9,
          auto: true
        });
        paramCount++;
      }

      // 2. Click steps on elements with specific text content
      if (step.type === 'click' && step.target.textContent) {
        const text = step.target.textContent.trim();
        // Only suggest if text looks like a specific name/value (not generic UI text)
        if (isSpecificText(text) && text.length > 1 && text.length < 80) {
          const paramName = `click_target_${paramCount}`;
          suggestions.push({
            stepIndex: i,
            field: 'target.textContent',
            paramName,
            defaultValue: text,
            description: `Click target text: "${text}"`,
            confidence: 0.6,
            auto: true
          });
          paramCount++;
        }
      }

      // 3. Navigate steps with dynamic URL segments
      if (step.type === 'navigate' && step.value) {
        const dynamicSegments = findDynamicUrlSegments(step.value);
        for (const segment of dynamicSegments) {
          suggestions.push({
            stepIndex: i,
            field: 'value',
            paramName: `url_param_${paramCount}`,
            defaultValue: segment.value,
            description: `URL segment: ${segment.description}`,
            confidence: 0.5,
            auto: true,
            urlSegment: segment
          });
          paramCount++;
        }
      }
    }

    return suggestions;
  }

  /**
   * Generate a meaningful parameter name based on step context
   */
  function generateParamName(step, index) {
    const target = step.target;

    // Use name attribute if available
    if (target.name) return sanitizeParamName(target.name);

    // Use placeholder as hint
    if (target.placeholder) return sanitizeParamName(target.placeholder);

    // Use aria-label
    if (target.ariaLabel) return sanitizeParamName(target.ariaLabel);

    // Use type + index
    if (target.type === 'email') return 'email';
    if (target.type === 'password') return 'password';
    if (target.type === 'search') return 'search_query';
    if (target.type === 'tel') return 'phone';
    if (target.type === 'url') return 'url';
    if (target.type === 'number') return `number_${index}`;

    if (target.tagName === 'textarea') return `text_${index}`;
    if (target.tagName === 'select') return `select_${index}`;

    return `input_value_${index}`;
  }

  function sanitizeParamName(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, '')
      .replace(/[\s-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 30) || 'param';
  }

  /**
   * Check if text looks like a specific value (not generic UI text)
   */
  function isSpecificText(text) {
    const genericTexts = [
      'ok', 'cancel', 'close', 'submit', 'save', 'delete', 'edit',
      'confirm', 'yes', 'no', 'back', 'next', 'previous', 'done',
      'apply', 'reset', 'clear', 'search', 'filter', 'sort',
      'add', 'remove', 'create', 'update', 'open', 'view',
      'sign in', 'sign out', 'log in', 'log out', 'login', 'logout'
    ];
    const lower = text.toLowerCase().trim();
    if (genericTexts.includes(lower)) return false;
    // If text contains numbers or mixed case or spaces, likely specific
    if (/\d/.test(text)) return true;
    if (text.includes(' ') && text.length > 3) return true;
    return text.length > 5;
  }

  /**
   * Find dynamic segments in a URL
   */
  function findDynamicUrlSegments(url) {
    const segments = [];
    try {
      const parsed = new URL(url);
      // Check path segments for IDs/slugs
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      for (const part of pathParts) {
        // UUID pattern
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)) {
          segments.push({ value: part, description: 'UUID in URL path', type: 'uuid' });
        }
        // Numeric ID
        else if (/^\d+$/.test(part) && part.length > 1) {
          segments.push({ value: part, description: 'Numeric ID in URL path', type: 'id' });
        }
      }
      // Check query parameters
      for (const [key, value] of parsed.searchParams) {
        if (value && value.length > 0 && value.length < 100) {
          segments.push({ value, description: `Query param "${key}"`, type: 'query', key });
        }
      }
    } catch (e) { /* not a valid URL */ }
    return segments;
  }

  /**
   * Generate a human-readable description of a step
   */
  function describeStep(step) {
    const target = step.target;
    let desc = '';

    switch (step.type) {
      case 'input':
        desc = `Input "${step.value}" into`;
        break;
      case 'select':
        desc = `Select "${step.value}" in`;
        break;
      case 'click':
        desc = 'Click';
        break;
      case 'navigate':
        return `Navigate to ${step.value}`;
      case 'keydown':
        desc = `Press ${step.key} on`;
        break;
      case 'submit':
        desc = 'Submit';
        break;
      default:
        desc = step.type;
    }

    // Add target description
    if (target.ariaLabel) desc += ` "${target.ariaLabel}"`;
    else if (target.placeholder) desc += ` "${target.placeholder}" field`;
    else if (target.name) desc += ` "${target.name}" field`;
    else if (target.textContent && target.textContent.length < 40) desc += ` "${target.textContent}"`;
    else desc += ` ${target.tagName}`;

    return desc;
  }

  /**
   * Apply parameter values to workflow steps for replay
   * @param {Array} steps - Original workflow steps
   * @param {Array} parameters - Parameter definitions
   * @param {Object} values - Parameter values keyed by paramName
   * @returns {Array} Modified steps with parameter values applied
   */
  function applyParameters(steps, parameters, values) {
    // Deep clone steps
    const modifiedSteps = JSON.parse(JSON.stringify(steps));

    for (const param of parameters) {
      if (!(param.paramName in values)) continue;
      const newValue = values[param.paramName];
      const step = modifiedSteps[param.stepIndex];
      if (!step) continue;

      if (param.field === 'value') {
        step.value = newValue;
      } else if (param.field === 'target.textContent') {
        step.target.textContent = newValue;
        step.target.innerText = newValue;
      }
    }

    return modifiedSteps;
  }

  // Export for both page context and module contexts
  const api = {
    detectParameters,
    applyParameters,
    describeStep,
    generateParamName,
    isSpecificText
  };

  if (typeof window !== 'undefined') {
    window.__crabWorkflowParameterizer = api;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.__crabWorkflowParameterizer = api;
  }

})();
