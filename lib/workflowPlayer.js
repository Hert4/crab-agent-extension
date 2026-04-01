/**
 * Workflow Player - Replays recorded workflows with element matching
 * and optional LLM fallback for smart generalization.
 */

(function () {
  'use strict';

  if (window.__crabWorkflowPlayer) return;

  const DEFAULT_STEP_DELAY = 500;
  const NAVIGATE_DELAY = 2000;
  const ELEMENT_WAIT_TIMEOUT = 5000;

  let currentPlayback = null;

  // ============================================================================
  // PLAYBACK STATE
  // ============================================================================

  class PlaybackState {
    constructor(workflow, parameterValues, onProgress) {
      this.workflow = workflow;
      this.parameterValues = parameterValues || {};
      this.onProgress = onProgress || (() => {});
      this.currentStep = 0;
      this.totalSteps = workflow.steps.length;
      this.status = 'idle'; // idle, running, paused, error, done, cancelled
      this.startTime = null;
      this.error = null;
      this.errorStep = null;
      this.modifiedSteps = null;
    }
  }

  // ============================================================================
  // ACTION EXECUTION
  // ============================================================================

  function dispatchMouseEvent(element, type) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    element.dispatchEvent(new MouseEvent(type, {
      bubbles: true, cancelable: true, view: window,
      clientX: x, clientY: y
    }));
  }

  async function executeClick(element) {
    // Scroll into view if needed
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(200);

    // Highlight briefly
    highlightElement(element);

    // Try native click first
    dispatchMouseEvent(element, 'mouseover');
    dispatchMouseEvent(element, 'mousedown');
    dispatchMouseEvent(element, 'mouseup');
    dispatchMouseEvent(element, 'click');

    // For links, try direct click
    if (element.tagName === 'A' || element.closest('a')) {
      element.click();
    }
  }

  async function executeInput(element, value) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(100);
    highlightElement(element);

    // Focus
    element.focus();
    element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));

    // Clear existing value
    element.value = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));

    // Set new value
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function executeSelect(element, value) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightElement(element);

    // Try by value
    const option = Array.from(element.options).find(o =>
      o.value === value || o.textContent.trim() === value
    );
    if (option) {
      element.value = option.value;
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function executeKeydown(element, key) {
    const keyMap = { Enter: 13, Tab: 9, Escape: 27, Backspace: 8, Delete: 46 };
    element.dispatchEvent(new KeyboardEvent('keydown', {
      key, code: key, keyCode: keyMap[key] || 0,
      bubbles: true, cancelable: true
    }));
    element.dispatchEvent(new KeyboardEvent('keyup', {
      key, code: key, keyCode: keyMap[key] || 0,
      bubbles: true, cancelable: true
    }));
  }

  // ============================================================================
  // VISUAL FEEDBACK
  // ============================================================================

  function highlightElement(element) {
    const overlay = document.createElement('div');
    overlay.className = 'crab-workflow-highlight';
    const rect = element.getBoundingClientRect();
    Object.assign(overlay.style, {
      position: 'fixed',
      left: `${rect.left - 2}px`,
      top: `${rect.top - 2}px`,
      width: `${rect.width + 4}px`,
      height: `${rect.height + 4}px`,
      border: '2px solid #c96442',
      borderRadius: '4px',
      backgroundColor: 'rgba(201, 100, 66, 0.1)',
      pointerEvents: 'none',
      zIndex: '2147483646',
      transition: 'opacity 0.3s ease'
    });
    document.body.appendChild(overlay);
    setTimeout(() => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    }, 800);
  }

  // ============================================================================
  // MAIN PLAYBACK ENGINE
  // ============================================================================

  async function playWorkflow(workflow, parameterValues = {}, onProgress = null) {
    if (currentPlayback && currentPlayback.status === 'running') {
      throw new Error('Another workflow is already running');
    }

    const state = new PlaybackState(workflow, parameterValues, onProgress);
    currentPlayback = state;
    state.status = 'running';
    state.startTime = Date.now();

    // Apply parameters to steps
    if (typeof window.__crabWorkflowParameterizer !== 'undefined') {
      state.modifiedSteps = window.__crabWorkflowParameterizer.applyParameters(
        workflow.steps, workflow.parameters || [], parameterValues
      );
    } else {
      state.modifiedSteps = JSON.parse(JSON.stringify(workflow.steps));
    }

    sendProgress(state, 'running');

    try {
      for (let i = 0; i < state.modifiedSteps.length; i++) {
        // Check for cancel/pause
        if (state.status === 'cancelled') break;
        while (state.status === 'paused') {
          await sleep(200);
          if (state.status === 'cancelled') break;
        }
        if (state.status === 'cancelled') break;

        state.currentStep = i;
        const step = state.modifiedSteps[i];

        sendProgress(state, 'running', `Step ${i + 1}/${state.totalSteps}: ${describeAction(step)}`);

        try {
          await executeStep(step, state);
        } catch (stepError) {
          state.error = stepError.message;
          state.errorStep = i;
          state.status = 'error';
          sendProgress(state, 'error', `Error at step ${i + 1}: ${stepError.message}`);
          break;
        }

        // Delay between steps
        const delay = step.type === 'navigate' ? NAVIGATE_DELAY : DEFAULT_STEP_DELAY;
        await sleep(delay);
      }

      if (state.status === 'running') {
        state.status = 'done';
        sendProgress(state, 'done', 'Workflow completed successfully');
      }
    } catch (e) {
      state.status = 'error';
      state.error = e.message;
      sendProgress(state, 'error', e.message);
    }

    const result = {
      success: state.status === 'done',
      duration: Date.now() - state.startTime,
      stepsCompleted: state.currentStep + (state.status === 'done' ? 1 : 0),
      totalSteps: state.totalSteps,
      error: state.error,
      errorStep: state.errorStep,
      parameterValues
    };

    currentPlayback = null;
    return result;
  }

  async function executeStep(step, state) {
    if (step.type === 'navigate') {
      // Send navigate request to background
      try {
        await chrome.runtime.sendMessage({
          type: 'WORKFLOW_NAVIGATE',
          url: step.value
        });
        await sleep(NAVIGATE_DELAY);
      } catch (e) {
        // Try direct navigation as fallback
        window.location.href = step.value;
        await sleep(NAVIGATE_DELAY);
      }
      return;
    }

    // Find the target element
    const matcher = window.__crabWorkflowMatcher;
    if (!matcher) throw new Error('Workflow matcher not loaded');

    const matchResult = await matcher.waitForElement(step.target, {}, ELEMENT_WAIT_TIMEOUT);

    if (!matchResult.element || matchResult.confidence < 0.4) {
      // Try LLM fallback if available
      const llmResult = await tryLLMFallback(step, state);
      if (llmResult) {
        matchResult.element = llmResult;
        matchResult.confidence = 0.7;
        matchResult.strategy = 'llm';
      }
    }

    if (!matchResult.element) {
      throw new Error(`Element not found: ${step.target.tagName} "${step.target.textContent || step.target.ariaLabel || step.target.cssSelector}"`);
    }

    // Execute the action
    switch (step.type) {
      case 'click':
        await executeClick(matchResult.element);
        break;
      case 'input':
        await executeInput(matchResult.element, step.value);
        break;
      case 'select':
        await executeSelect(matchResult.element, step.value);
        break;
      case 'keydown':
        await executeKeydown(matchResult.element, step.key);
        break;
      case 'submit':
        matchResult.element.dispatchEvent(new Event('submit', { bubbles: true }));
        break;
      default:
        console.warn('[Workflow Player] Unknown action type:', step.type);
    }
  }

  // ============================================================================
  // LLM FALLBACK
  // ============================================================================

  async function tryLLMFallback(step, state) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'WORKFLOW_LLM_FIND_ELEMENT',
        step,
        pageUrl: window.location.href,
        pageTitle: document.title
      });

      if (response && response.success && response.elementIndex !== undefined) {
        // Use buildDomTree element refs if available
        if (window.AgentSDom && window.AgentSDom.lastBuildResult) {
          const elements = window.AgentSDom.lastBuildResult.elements;
          const target = elements.find(e => e.index === response.elementIndex);
          if (target && target.ref_id) {
            const el = window.AgentSDom.getElementByRefId(target.ref_id);
            if (el) return el;
          }
        }

        // Fallback: try to find by index in interactive elements
        const allInteractive = document.querySelectorAll('a, button, input, textarea, select, [role="button"], [role="link"], [role="tab"], [onclick], [tabindex]');
        if (response.elementIndex < allInteractive.length) {
          return allInteractive[response.elementIndex];
        }
      }
    } catch (e) {
      console.warn('[Workflow Player] LLM fallback failed:', e);
    }
    return null;
  }

  // ============================================================================
  // CONTROLS
  // ============================================================================

  function pause() {
    if (currentPlayback && currentPlayback.status === 'running') {
      currentPlayback.status = 'paused';
      sendProgress(currentPlayback, 'paused', 'Paused');
    }
  }

  function resume() {
    if (currentPlayback && currentPlayback.status === 'paused') {
      currentPlayback.status = 'running';
      sendProgress(currentPlayback, 'running', 'Resumed');
    }
  }

  function cancel() {
    if (currentPlayback && (currentPlayback.status === 'running' || currentPlayback.status === 'paused')) {
      currentPlayback.status = 'cancelled';
      sendProgress(currentPlayback, 'cancelled', 'Cancelled');
    }
  }

  function getStatus() {
    if (!currentPlayback) return { status: 'idle' };
    return {
      status: currentPlayback.status,
      currentStep: currentPlayback.currentStep,
      totalSteps: currentPlayback.totalSteps,
      workflowName: currentPlayback.workflow.name
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  function sendProgress(state, status, message = '') {
    if (state.onProgress) {
      state.onProgress({
        step: state.currentStep,
        total: state.totalSteps,
        status,
        message,
        workflowName: state.workflow.name
      });
    }
    try {
      chrome.runtime.sendMessage({
        type: 'WORKFLOW_PROGRESS',
        step: state.currentStep,
        total: state.totalSteps,
        status,
        message,
        workflowName: state.workflow.name
      });
    } catch (e) { /* extension context may be invalid */ }
  }

  function describeAction(step) {
    const target = step.target;
    let desc = step.type;
    if (target.ariaLabel) desc += ` "${target.ariaLabel}"`;
    else if (target.textContent && target.textContent.length < 30) desc += ` "${target.textContent}"`;
    else if (target.placeholder) desc += ` "${target.placeholder}"`;
    else desc += ` ${target.tagName}`;
    return desc;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Expose API
  window.__crabWorkflowPlayer = {
    playWorkflow,
    pause,
    resume,
    cancel,
    getStatus
  };

  // Listen for control commands
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'WORKFLOW_PLAY':
        playWorkflow(message.workflow, message.parameterValues, (progress) => {
          chrome.runtime.sendMessage({ type: 'WORKFLOW_PROGRESS', ...progress }).catch(() => {});
        }).then(result => {
          chrome.runtime.sendMessage({ type: 'WORKFLOW_PLAY_RESULT', result }).catch(() => {});
        });
        sendResponse({ success: true, started: true });
        return true;
      case 'WORKFLOW_PAUSE':
        pause();
        sendResponse({ success: true });
        break;
      case 'WORKFLOW_RESUME':
        resume();
        sendResponse({ success: true });
        break;
      case 'WORKFLOW_CANCEL':
        cancel();
        sendResponse({ success: true });
        break;
      case 'WORKFLOW_STATUS':
        sendResponse(getStatus());
        break;
    }
    return false;
  });

})();
