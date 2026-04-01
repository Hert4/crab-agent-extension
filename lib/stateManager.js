/**
 * Crab-Agent State Manager v2.0
 * Handles state tracking, infinite loop prevention, and DOM stabilization.
 */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const CONFIG = {
    MAX_FAILED_ACTIONS: 20,
    DOM_STABLE_THRESHOLD: 800,
    DOM_STABLE_TIMEOUT: 5000,
    STATE_HISTORY_SIZE: 50,
    DUPLICATE_ACTION_THRESHOLD: 3
  };

  // ============================================================================
  // STATE MANAGER CLASS
  // ============================================================================

  class StateManager {
    constructor() {
      this.reset();
    }

    reset() {
      // State history tracking
      this.stateHistory = [];

      // Failed actions tracking
      this.failedActions = [];

      // Action pattern detection
      this.actionPatterns = new Map();

      // DOM hash history
      this.domHashHistory = [];

      // Current state snapshot
      this.currentState = null;

      // Statistics
      this.stats = {
        totalActions: 0,
        successfulActions: 0,
        failedActions: 0,
        loopsDetected: 0,
        stateUnchangedCount: 0
      };
    }

    /**
     * Capture current page state
     */
    captureState(url, domHash, viewportInfo = {}) {
      return {
        url,
        domHash,
        scrollY: viewportInfo.scrollY || 0,
        timestamp: Date.now(),
        signature: `${url}|${domHash}|${viewportInfo.scrollY || 0}`
      };
    }

    /**
     * Record state before action
     */
    recordPreActionState(url, domHash, viewportInfo = {}) {
      this.currentState = this.captureState(url, domHash, viewportInfo);
      return this.currentState;
    }

    /**
     * Check if state changed after action
     */
    checkStateChanged(url, domHash, viewportInfo = {}) {
      if (!this.currentState) return true;

      const newState = this.captureState(url, domHash, viewportInfo);

      // Compare states
      const urlChanged = this.currentState.url !== newState.url;
      const domChanged = this.currentState.domHash !== newState.domHash;
      const scrollChanged = Math.abs(
        (this.currentState.scrollY || 0) - (newState.scrollY || 0)
      ) > 50;

      const changed = urlChanged || domChanged || scrollChanged;

      // Track unchanged state
      if (!changed) {
        this.stats.stateUnchangedCount++;
      } else {
        this.stats.stateUnchangedCount = 0;
      }

      // Save to history
      this.stateHistory.push({
        before: this.currentState,
        after: newState,
        changed
      });

      // Trim history
      if (this.stateHistory.length > CONFIG.STATE_HISTORY_SIZE) {
        this.stateHistory.shift();
      }

      return changed;
    }

    /**
     * Record action result
     */
    recordActionResult(actionName, params, success, details = '') {
      this.stats.totalActions++;

      if (success) {
        this.stats.successfulActions++;
      } else {
        this.stats.failedActions++;
      }

      const actionKey = this.buildActionKey(actionName, params);

      // Track failed actions
      if (!success) {
        this.failedActions.push({
          action: actionName,
          params: this.sanitizeParams(params),
          details,
          timestamp: Date.now(),
          key: actionKey
        });

        // Trim failed actions
        if (this.failedActions.length > CONFIG.MAX_FAILED_ACTIONS) {
          this.failedActions.shift();
        }
      }

      // Track action patterns
      const currentCount = this.actionPatterns.get(actionKey) || 0;
      this.actionPatterns.set(actionKey, currentCount + 1);

      // Check for loops
      if (this.actionPatterns.get(actionKey) >= CONFIG.DUPLICATE_ACTION_THRESHOLD) {
        this.stats.loopsDetected++;
      }
    }

    /**
     * Build unique action key
     */
    buildActionKey(actionName, params) {
      const safeParams = this.sanitizeParams(params);
      return `${actionName}:${JSON.stringify(safeParams)}`;
    }

    /**
     * Sanitize params for comparison (remove timestamps, etc.)
     */
    sanitizeParams(params) {
      if (!params || typeof params !== 'object') return params;

      const sanitized = {};
      for (const [key, value] of Object.entries(params)) {
        // Skip timestamp-like fields
        if (/time|date|timestamp/i.test(key)) continue;
        // Truncate long strings
        if (typeof value === 'string' && value.length > 100) {
          sanitized[key] = value.slice(0, 100);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }

    /**
     * Check if action should be blocked (detected as loop)
     */
    isActionBlocked(actionName, params) {
      const actionKey = this.buildActionKey(actionName, params);
      const count = this.actionPatterns.get(actionKey) || 0;

      // Block if repeated too many times
      if (count >= CONFIG.DUPLICATE_ACTION_THRESHOLD) {
        return {
          blocked: true,
          reason: `Action repeated ${count} times without success`
        };
      }

      // Check if in recent failed actions
      const recentFailed = this.failedActions
        .slice(-5)
        .filter(a => a.key === actionKey);

      if (recentFailed.length >= 2) {
        return {
          blocked: true,
          reason: 'Action failed multiple times recently'
        };
      }

      return { blocked: false };
    }

    /**
     * Get dynamic warning for LLM prompt
     */
    getWarningBlock() {
      const warnings = [];

      // Failed actions warning
      if (this.failedActions.length > 0) {
        const recentFailed = this.failedActions.slice(-5);
        const failedSummary = recentFailed
          .map(a => `- ${a.action}(${JSON.stringify(a.params).slice(0, 50)}) - ${a.details || 'failed'}`)
          .join('\n');

        warnings.push(
          `[FAILED ACTIONS WARNING]\n` +
          `The following actions have failed recently. DO NOT repeat them:\n${failedSummary}\n` +
          `Try alternative approaches: different element indices, scrolling, or different actions.`
        );
      }

      // Loop detection warning
      const repeatedActions = [];
      for (const [key, count] of this.actionPatterns.entries()) {
        if (count >= CONFIG.DUPLICATE_ACTION_THRESHOLD - 1) {
          repeatedActions.push({ key, count });
        }
      }

      if (repeatedActions.length > 0) {
        warnings.push(
          `[LOOP DETECTION WARNING]\n` +
          `You are repeating similar actions without progress. ` +
          `This suggests the current approach is not working.\n` +
          `Strategies to try:\n` +
          `1. Scroll to reveal different elements\n` +
          `2. Use hover_element to trigger dropdowns\n` +
          `3. Try clicking a different element nearby\n` +
          `4. Use send_keys for keyboard navigation\n` +
          `5. Check if the element is actually clickable`
        );
      }

      // State unchanged warning
      if (this.stats.stateUnchangedCount >= 3) {
        warnings.push(
          `[STATE UNCHANGED WARNING]\n` +
          `The page state has not changed after ${this.stats.stateUnchangedCount} actions. ` +
          `Your clicks may not be hitting the intended targets. ` +
          `Verify element indices match the current DOM state.`
        );
      }

      return warnings.join('\n\n');
    }

    /**
     * Reset action patterns (e.g., after navigation)
     */
    resetPatterns() {
      this.actionPatterns.clear();
      this.stats.stateUnchangedCount = 0;
    }

    /**
     * Get statistics
     */
    getStats() {
      return { ...this.stats };
    }
  }

  // ============================================================================
  // DOM STABILIZATION
  // ============================================================================

  class DomStabilizer {
    constructor() {
      this.observer = null;
      this.lastMutationTime = 0;
      this.mutationCount = 0;
    }

    /**
     * Wait for DOM to stabilize
     */
    waitForStable(timeout = CONFIG.DOM_STABLE_TIMEOUT, threshold = CONFIG.DOM_STABLE_THRESHOLD) {
      return new Promise((resolve) => {
        let resolved = false;
        let lastMutationTime = Date.now();
        let checkCount = 0;

        // Create observer if not exists
        if (this.observer) {
          this.observer.disconnect();
        }

        this.observer = new MutationObserver(() => {
          lastMutationTime = Date.now();
          this.mutationCount++;
        });

        try {
          this.observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
          });
        } catch (e) {
          // Observer failed, resolve immediately
          resolve({ stable: true, reason: 'observer_failed' });
          return;
        }

        const checkStable = () => {
          if (resolved) return;
          checkCount++;

          const timeSinceLastMutation = Date.now() - lastMutationTime;

          if (timeSinceLastMutation >= threshold) {
            resolved = true;
            this.observer.disconnect();
            resolve({
              stable: true,
              reason: 'no_mutations',
              waitTime: checkCount * 100
            });
            return;
          }

          if (checkCount * 100 >= timeout) {
            resolved = true;
            this.observer.disconnect();
            resolve({
              stable: true,
              reason: 'timeout',
              waitTime: timeout
            });
            return;
          }

          setTimeout(checkStable, 100);
        };

        // Start checking after initial delay
        setTimeout(checkStable, Math.min(threshold / 2, 200));
      });
    }

    /**
     * Get mutation count since last check
     */
    getMutationCount() {
      const count = this.mutationCount;
      this.mutationCount = 0;
      return count;
    }

    /**
     * Cleanup
     */
    destroy() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
    }
  }

  // ============================================================================
  // NETWORK IDLE DETECTION (using Performance API)
  // ============================================================================

  class NetworkMonitor {
    constructor() {
      this.pendingRequests = 0;
    }

    /**
     * Wait for network idle
     * Note: This is a simplified version. Full implementation would use
     * chrome.debugger API's Network.enable and requestWillBeSent/loadingFinished
     */
    waitForNetworkIdle(timeout = 3000, idleTime = 500) {
      return new Promise((resolve) => {
        const startTime = Date.now();
        let lastActivityTime = startTime;
        let resolved = false;

        // Use Performance Observer if available
        let observer = null;

        if (typeof PerformanceObserver !== 'undefined') {
          try {
            observer = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              if (entries.some(e => e.entryType === 'resource')) {
                lastActivityTime = Date.now();
              }
            });
            observer.observe({ entryTypes: ['resource'] });
          } catch (e) {
            // PerformanceObserver not available
          }
        }

        const checkIdle = () => {
          if (resolved) return;

          const now = Date.now();
          const timeSinceActivity = now - lastActivityTime;
          const elapsed = now - startTime;

          if (timeSinceActivity >= idleTime) {
            resolved = true;
            if (observer) observer.disconnect();
            resolve({ idle: true, reason: 'no_activity' });
            return;
          }

          if (elapsed >= timeout) {
            resolved = true;
            if (observer) observer.disconnect();
            resolve({ idle: true, reason: 'timeout' });
            return;
          }

          setTimeout(checkIdle, 100);
        };

        setTimeout(checkIdle, 200);
      });
    }
  }

  // ============================================================================
  // EXPORT
  // ============================================================================

  // Export for content script context
  if (typeof window !== 'undefined') {
    window.CrabStateManager = StateManager;
    window.CrabDomStabilizer = DomStabilizer;
    window.CrabNetworkMonitor = NetworkMonitor;
  }

  // Export for service worker context
  if (typeof self !== 'undefined' && typeof self.CrabStateManager === 'undefined') {
    self.CrabStateManager = StateManager;
    self.CrabDomStabilizer = DomStabilizer;
    self.CrabNetworkMonitor = NetworkMonitor;
  }

})();
