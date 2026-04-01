/**
 * Crab-Agent Visual Indicator - Claude Style
 * Shows glow border and stop button when agent is running
 * Copied from Claude 1.0.56 extension styling
 */

(function() {
  'use strict';

  // Prevent double injection within the same extension instance,
  // but allow re-injection after extension reload (old listeners are dead).
  // After reload, Chrome injects new content scripts but the old window flags persist.
  // Using a timestamp: if re-injected within 2s, it's a duplicate; otherwise it's a reload.
  {
    const now = Date.now();
    if (window.__crabAgentVisualIndicator && (now - window.__crabAgentVisualIndicatorTime) < 2000) {
      return; // Duplicate injection within same instance — skip
    }
    // Clean up stale DOM elements from previous injection (if any)
    document.getElementById('claude-agent-glow-border')?.remove();
    document.getElementById('claude-agent-stop-container')?.remove();
    document.getElementById('claude-static-indicator-container')?.remove();
    document.getElementById('claude-agent-animation-styles')?.remove();
    window.__crabAgentVisualIndicator = true;
    window.__crabAgentVisualIndicatorTime = now;
  }

  let glowBorder = null;
  let stopContainer = null;
  let staticIndicator = null;
  let isAgentActive = false;
  let isStaticMode = false;
  let heartbeatInterval = null;
  let glowHeartbeatInterval = null;
  let glowHeartbeatFailures = 0;
  const GLOW_HEARTBEAT_MAX_FAILURES = 3; // Tolerate 3 consecutive failures (15s) before hiding
  let wasActiveBeforeToolUse = false;
  let wasStaticBeforeToolUse = false;
  let isMcpMode = false;

  // Claude orange color palette (from Claude 1.0.56)
  const CLAUDE_COLOR = 'rgba(217, 119, 87, 1)';
  const CLAUDE_COLOR_70 = 'rgba(217, 119, 87, 0.7)';
  const CLAUDE_COLOR_50 = 'rgba(217, 119, 87, 0.5)';
  const CLAUDE_COLOR_30 = 'rgba(217, 119, 87, 0.3)';
  const CLAUDE_COLOR_20 = 'rgba(217, 119, 87, 0.2)';
  const CLAUDE_COLOR_10 = 'rgba(217, 119, 87, 0.1)';

  /**
   * Inject animation styles (exact copy from Claude)
   */
  function injectStyles() {
    if (document.getElementById('claude-agent-animation-styles')) return;

    const style = document.createElement('style');
    style.id = 'claude-agent-animation-styles';
    style.textContent = `
      @keyframes claude-pulse {
        0% {
          box-shadow:
            inset 0 0 10px ${CLAUDE_COLOR_50},
            inset 0 0 20px ${CLAUDE_COLOR_30},
            inset 0 0 30px ${CLAUDE_COLOR_10};
        }
        50% {
          box-shadow:
            inset 0 0 15px ${CLAUDE_COLOR_70},
            inset 0 0 25px ${CLAUDE_COLOR_50},
            inset 0 0 35px ${CLAUDE_COLOR_20};
        }
        100% {
          box-shadow:
            inset 0 0 10px ${CLAUDE_COLOR_50},
            inset 0 0 20px ${CLAUDE_COLOR_30},
            inset 0 0 30px ${CLAUDE_COLOR_10};
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Create glow border element (exact copy from Claude)
   */
  function createGlowBorder() {
    const el = document.createElement('div');
    el.id = 'claude-agent-glow-border';
    el.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 2147483646;
      opacity: 0;
      transition: opacity 0.3s ease-in-out;
      animation: claude-pulse 2s ease-in-out infinite;
      box-shadow:
        inset 0 0 10px ${CLAUDE_COLOR_50},
        inset 0 0 20px ${CLAUDE_COLOR_30},
        inset 0 0 30px ${CLAUDE_COLOR_10};
    `;
    return el;
  }

  /**
   * Create stop button container (exact copy from Claude)
   */
  function createStopContainer() {
    const container = document.createElement('div');
    container.id = 'claude-agent-stop-container';
    container.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      justify-content: center;
      align-items: center;
      pointer-events: none;
      z-index: 2147483647;
    `;

    const button = document.createElement('button');
    button.id = 'claude-agent-stop-button';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" style="margin-right: 12px; vertical-align: middle;">
        <path d="M128,20A108,108,0,1,0,236,128,108.12,108.12,0,0,0,128,20Zm0,192a84,84,0,1,1,84-84A84.09,84.09,0,0,1,128,212Zm40-112v56a12,12,0,0,1-12,12H100a12,12,0,0,1-12-12V100a12,12,0,0,1,12-12h56A12,12,0,0,1,168,100Z"></path>
      </svg>
      <span style="vertical-align: middle;">Stop</span>
    `;
    button.style.cssText = `
      position: relative;
      transform: translateY(100px);
      padding: 12px 16px;
      background: #FAF9F5;
      color: #141413;
      border: 0.5px solid rgba(31, 30, 29, 0.4);
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow:
        0 40px 80px rgba(217, 119, 87, 0.24),
        0 4px 14px rgba(217, 119, 87, 0.24);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0;
      user-select: none;
      pointer-events: auto;
      white-space: nowrap;
      margin: 0 auto;
    `;

    button.addEventListener('mouseenter', () => {
      if (isAgentActive) {
        button.style.background = '#F5F4F0';
        button.style.boxShadow = '0 40px 80px rgba(217, 119, 87, 0.24), 0 4px 14px rgba(217, 119, 87, 0.24)';
      }
    });

    button.addEventListener('mouseleave', () => {
      if (isAgentActive) {
        button.style.background = '#FAF9F5';
        button.style.boxShadow = '0 40px 80px rgba(217, 119, 87, 0.24), 0 4px 14px rgba(217, 119, 87, 0.24)';
      }
    });

    button.addEventListener('click', async () => {
      try {
        await chrome.runtime.sendMessage({ type: 'STOP_AGENT', fromTabId: 'CURRENT_TAB' });
      } catch (e) {
        console.error('[VisualIndicator] Failed to send stop message:', e);
      }
    });

    container.appendChild(button);
    return container;
  }

  /**
   * Create static indicator (exact copy from Claude with Claude logo)
   */
  function createStaticIndicator() {
    const container = document.createElement('div');
    container.id = 'claude-static-indicator-container';
    container.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; flex-shrink: 0; margin-right: 8px;">
        <path d="M3.13946 10.6399L6.28757 8.87462L6.37405 8.73821L6.28757 8.6339H6.13189L5.60432 8.6018L3.80541 8.55366L2.24865 8.48947L0.735135 8.40923H0.492973L0.354595 8.32899L0.181622 8.1685L0.0345946 8.01605L0 7.85557L0.0345946 7.62287L0.138378 7.44634L0.224865 7.40622H0.354595L0.812973 7.44634L1.82486 7.51856L3.34703 7.62287L4.44541 7.68706L6.08 7.85557H6.33946L6.37405 7.75125L6.28757 7.68706L6.21838 7.62287L4.64432 6.55567L2.94054 5.4323L2.04973 4.78235L1.57405 4.45336L1.33189 4.14845L1.22811 3.92377L1.17622 3.69107L1.22811 3.47442L1.33189 3.28185L1.46162 3.13741L1.66054 2.99298H1.87676L2.24865 3.0331L2.39568 3.07322L2.99243 3.53059L4.26378 4.51755L5.92432 5.73721L6.16649 5.93781H6.27892V5.82548L6.16649 5.64092L5.26703 4.01204L4.30703 2.35105L3.87459 1.66098L3.76216 1.25176C3.7391 1.16082 3.69297 0.977332 3.69297 0.970913V0.762287L3.77946 0.505517L3.93513 0.240722L4.18595 0.0882648L4.4627 0H4.67892L4.83459 0.0240722L5.12865 0.0882648L5.4054 0.328987L5.82054 1.27583L6.48649 2.76028L7.52432 4.78235L7.82703 5.38415L7.99135 5.93781L8.05189 6.10632H8.15567V6.01003L8.24216 4.87061L8.39784 3.47442L8.55351 1.67703L8.6054 1.17151L8.85622 0.561685L8.9773 0.417252L9.21946 0.232698H9.35784L9.74703 0.417252L9.97189 0.665998L10.067 0.874624L10.0238 1.17151L9.83351 2.40722L9.46162 4.34102L9.21946 5.64092H9.35784L9.52216 5.47242L10.1795 4.60582L11.2778 3.22568L11.7622 2.68004L12.333 2.07823L12.6962 1.78937L13.0162 1.67703L13.3881 1.78937L13.7168 2.06219L13.8897 2.54363V2.76028L13.6649 3.32197L12.9557 4.22066L12.3676 4.98295L12.0043 5.56871L11.0011 7.02106V7.08526H11.1741L13.0768 6.67603L14.1059 6.49147L15.3341 6.28285L15.5762 6.34704L15.8876 6.53962L15.9481 6.80441L15.8876 7.12538L15.7319 7.34203L14.4173 7.66299L12.8778 7.97593L10.5854 8.51559C10.5705 8.51909 10.56 8.53236 10.56 8.54764C10.56 8.56468 10.573 8.57891 10.59 8.58044L11.6238 8.67402L12.0649 8.69809H13.1459L15.1611 8.85055L15.6886 9.19559L15.9481 9.39619L16 9.62086L15.9481 9.94985L15.8443 10.1023L15.4119 10.3029L15.1351 10.3591L14.0454 10.1023L11.4941 9.49248L10.6205 9.27583H10.4995V9.34804L11.2259 10.0622L12.5665 11.2658L14.2357 12.8225L14.3222 13.0953V13.2076L14.1059 13.5125L13.9243 13.5206L13.8811 13.4804L12.4108 12.3731L12.2984 12.325L11.84 11.8756L10.56 10.7924H10.4735V10.9047L10.7676 11.338L12.333 13.6891L12.4108 14.4112L12.2984 14.6439L11.8919 14.7884L11.667 14.7563L11.4508 14.7081L11.2605 14.5396L10.5254 13.4162L9.5827 11.9719L8.82162 10.672H8.79342C8.76039 10.672 8.73278 10.6972 8.7297 10.73L8.27676 15.5667L8.06919 15.8154L7.6454 16H7.58486L7.17838 15.6951L6.96216 15.1976L7.17838 14.2106L7.43784 12.9268L7.6454 11.9077L7.83567 10.6399L7.95187 10.2164C7.9548 10.2057 7.95069 10.1944 7.94161 10.1881C7.91157 10.1672 7.87034 10.1741 7.84878 10.2037L6.89297 11.5145L5.44 13.4804L4.28973 14.7081L4.01297 14.8205H3.80541L3.5373 14.5717V14.4514L3.58054 14.1304L3.84865 13.7372L5.44 11.7151L6.4 10.4554L7.01872 9.73222C7.04511 9.70139 7.04245 9.65523 7.0127 9.62763C7.00333 9.61894 6.98925 9.61773 6.97854 9.62471L2.75027 12.3811L1.99784 12.4774L1.66919 12.1725L1.71243 11.675L1.86811 11.5145L3.13946 10.6399Z" fill="#D97757"/>
      </svg>
      <span style="vertical-align: middle; color: #141413; font-size: 14px; display: inline-block;">Crab is active in this tab group</span>
      <div style="display: inline-block; width: 0.5px; height: 32px; background: rgba(31, 30, 29, 0.15); margin: 0 8px; vertical-align: middle;"></div>
      <button id="claude-static-chat-button" style="position: relative; display: inline-flex; align-items: center; justify-content: center; padding: 6px; background: transparent; border: none; cursor: pointer; pointer-events: auto; vertical-align: middle; width: 32px; height: 32px; border-radius: 8px; transition: background 0.2s;">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="#141413" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px; display: block;">
          <path d="M10 2.5C14.1421 2.5 17.5 5.85786 17.5 10C17.5 14.1421 14.1421 17.5 10 17.5H3C2.79779 17.5 2.61549 17.3782 2.53809 17.1914C2.4607 17.0046 2.50349 16.7895 2.64648 16.6465L4.35547 14.9365C3.20124 13.6175 2.5 11.8906 2.5 10C2.5 5.85786 5.85786 2.5 10 2.5ZM10 3.5C6.41015 3.5 3.5 6.41015 3.5 10C3.5 11.7952 4.22659 13.4199 5.40332 14.5967L5.46582 14.6729C5.52017 14.7544 5.5498 14.8508 5.5498 14.9502C5.5498 15.0828 5.49709 15.2099 5.40332 15.3037L4.20703 16.5H10C13.5899 16.5 16.5 13.5899 16.5 10C16.5 6.41015 13.5899 3.5 10 3.5ZM13.29 9.30371C13.3986 9.05001 13.6925 8.93174 13.9463 9.04004C14.2 9.14863 14.3183 9.44253 14.21 9.69629C13.8506 10.536 13.1645 11.25 12.25 11.25C11.6372 11.25 11.128 10.9289 10.75 10.4648C10.372 10.9289 9.86276 11.25 9.25 11.25C8.63724 11.25 8.12801 10.9289 7.75 10.4648C7.37198 10.9289 6.86276 11.25 6.25 11.25C5.97386 11.25 5.75 11.0261 5.75 10.75C5.75 10.4739 5.97386 10.25 6.25 10.25C6.58764 10.25 7.00448 9.97056 7.29004 9.30371L7.32422 9.2373C7.41431 9.09121 7.5749 9 7.75 9C7.9501 9 8.13123 9.11975 8.20996 9.30371L8.32227 9.53516C8.59804 10.0359 8.95442 10.25 9.25 10.25C9.58764 10.25 10.0045 9.97056 10.29 9.30371L10.3242 9.2373C10.4143 9.09121 10.5749 9 10.75 9C10.9501 9 11.1312 9.11975 11.21 9.30371L11.3223 9.53516C11.598 10.0359 11.9544 10.25 12.25 10.25C12.5876 10.25 13.0045 9.97056 13.29 9.30371Z" />
        </svg>
        <span id="claude-static-chat-tooltip" style="position: absolute; bottom: calc(100% + 12px); left: 50%; transform: translateX(-50%); padding: 6px 12px; background: #30302E; color: #FAF9F5; border-radius: 6px; font-size: 12px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.2s; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">Open chat</span>
      </button>
      <button id="claude-static-close-button" style="position: relative; display: inline-flex; align-items: center; justify-content: center; padding: 6px; background: transparent; border: none; cursor: pointer; pointer-events: auto; vertical-align: middle; width: 32px; height: 32px; margin-left: 4px; border-radius: 8px; transition: background 0.2s;">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px; display: block;">
          <path d="M15.1464 4.14642C15.3417 3.95121 15.6582 3.95118 15.8534 4.14642C16.0486 4.34168 16.0486 4.65822 15.8534 4.85346L10.7069 9.99997L15.8534 15.1465C16.0486 15.3417 16.0486 15.6583 15.8534 15.8535C15.6826 16.0244 15.4186 16.0461 15.2245 15.918L15.1464 15.8535L9.99989 10.707L4.85338 15.8535C4.65813 16.0486 4.34155 16.0486 4.14634 15.8535C3.95115 15.6583 3.95129 15.3418 4.14634 15.1465L9.29286 9.99997L4.14634 4.85346C3.95129 4.65818 3.95115 4.34162 4.14634 4.14642C4.34154 3.95128 4.65812 3.95138 4.85338 4.14642L9.99989 9.29294L15.1464 4.14642Z" fill="#141413"/>
        </svg>
        <span id="claude-static-close-tooltip" style="position: absolute; bottom: calc(100% + 12px); left: 50%; transform: translateX(-50%); padding: 6px 12px; background: #30302E; color: #FAF9F5; border-radius: 6px; font-size: 12px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.2s; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">Dismiss</span>
      </button>
    `;
    container.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 6px 6px 16px;
      background: #FAF9F5;
      border: 0.5px solid rgba(31, 30, 29, 0.30);
      border-radius: 14px;
      box-shadow: 0 40px 80px 0 rgba(0, 0, 0, 0.15);
      z-index: 2147483647;
      pointer-events: none;
      white-space: nowrap;
      user-select: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    `;

    // Add event listeners for buttons
    const chatBtn = container.querySelector('#claude-static-chat-button');
    const chatTooltip = container.querySelector('#claude-static-chat-tooltip');
    if (chatBtn) {
      chatBtn.addEventListener('mouseenter', () => {
        chatBtn.style.background = '#F0EEE6';
        if (chatTooltip) chatTooltip.style.opacity = '1';
      });
      chatBtn.addEventListener('mouseleave', () => {
        chatBtn.style.background = 'transparent';
        if (chatTooltip) chatTooltip.style.opacity = '0';
      });
      chatBtn.addEventListener('click', async () => {
        try {
          await chrome.runtime.sendMessage({ type: 'SWITCH_TO_MAIN_TAB' });
        } catch (e) {
          console.error('[VisualIndicator] Failed to switch to main tab:', e);
        }
      });
    }

    const closeBtn = container.querySelector('#claude-static-close-button');
    const closeTooltip = container.querySelector('#claude-static-close-tooltip');
    if (closeBtn) {
      closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = '#F0EEE6';
        if (closeTooltip) closeTooltip.style.opacity = '1';
      });
      closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = 'transparent';
        if (closeTooltip) closeTooltip.style.opacity = '0';
      });
      closeBtn.addEventListener('click', async () => {
        try {
          await chrome.runtime.sendMessage({ type: 'DISMISS_STATIC_INDICATOR_FOR_GROUP' });
        } catch (e) {
          hideStaticIndicator();
        }
      });
    }

    return container;
  }

  /**
   * Show agent indicators (glow border + stop button)
   */
  function showAgentIndicators(options = {}) {
    isMcpMode = options.isMcp || false;
    isAgentActive = true;
    injectStyles();

    if (!glowBorder) {
      glowBorder = createGlowBorder();
      document.body.appendChild(glowBorder);
    } else {
      glowBorder.style.display = '';
    }

    // Don't show stop button in MCP mode (external control)
    if (!isMcpMode) {
      if (!stopContainer) {
        stopContainer = createStopContainer();
        document.body.appendChild(stopContainer);
      } else {
        stopContainer.style.display = '';
      }
    }

    // Animate in
    requestAnimationFrame(() => {
      if (glowBorder) {
        glowBorder.style.opacity = '1';
      }
      if (stopContainer && !isMcpMode) {
        const btn = stopContainer.querySelector('#claude-agent-stop-button');
        if (btn) {
          btn.style.transform = 'translateY(0)';
          btn.style.opacity = '1';
        }
      }
    });

    // Start heartbeat to auto-hide if agent is no longer running.
    // Tolerates brief service worker unresponsiveness (e.g., during long LLM calls).
    if (glowHeartbeatInterval) clearInterval(glowHeartbeatInterval);
    glowHeartbeatFailures = 0;
    glowHeartbeatInterval = setInterval(async () => {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'STATIC_INDICATOR_HEARTBEAT' });
        if (response?.success) {
          glowHeartbeatFailures = 0; // Reset on success
        } else {
          glowHeartbeatFailures++;
          if (glowHeartbeatFailures >= GLOW_HEARTBEAT_MAX_FAILURES) {
            hideAgentIndicators();
          }
        }
      } catch (e) {
        glowHeartbeatFailures++;
        if (glowHeartbeatFailures >= GLOW_HEARTBEAT_MAX_FAILURES) {
          // Extension context invalidated or service worker dead — clean up
          hideAgentIndicators();
        }
      }
    }, 5000);
  }

  /**
   * Hide agent indicators
   */
  function hideAgentIndicators() {
    if (!isAgentActive) return;
    isAgentActive = false;

    // Stop glow heartbeat
    if (glowHeartbeatInterval) {
      clearInterval(glowHeartbeatInterval);
      glowHeartbeatInterval = null;
    }

    if (glowBorder) {
      glowBorder.style.opacity = '0';
    }

    if (stopContainer) {
      const btn = stopContainer.querySelector('#claude-agent-stop-button');
      if (btn) {
        btn.style.transform = 'translateY(100px)';
        btn.style.opacity = '0';
      }
    }

    // Remove after animation
    setTimeout(() => {
      if (!isAgentActive) {
        if (glowBorder && glowBorder.parentNode) {
          glowBorder.parentNode.removeChild(glowBorder);
          glowBorder = null;
        }
        if (stopContainer && stopContainer.parentNode) {
          stopContainer.parentNode.removeChild(stopContainer);
          stopContainer = null;
        }
      }
    }, 300);
  }

  /**
   * Show static indicator
   */
  function showStaticIndicator() {
    isStaticMode = true;

    if (!staticIndicator) {
      staticIndicator = createStaticIndicator();
      document.body.appendChild(staticIndicator);
    } else {
      staticIndicator.style.display = '';
    }

    // Start heartbeat to verify active instance
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(async () => {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'STATIC_INDICATOR_HEARTBEAT' });
        if (!response?.success) {
          hideStaticIndicator();
        }
      } catch (e) {
        hideStaticIndicator();
      }
    }, 5000);
  }

  /**
   * Hide static indicator
   */
  function hideStaticIndicator() {
    isStaticMode = false;

    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    if (staticIndicator && staticIndicator.parentNode) {
      staticIndicator.parentNode.removeChild(staticIndicator);
      staticIndicator = null;
    }
  }

  /**
   * Temporarily hide for tool use (screenshot, etc.)
   */
  function hideForToolUse() {
    wasActiveBeforeToolUse = isAgentActive;
    wasStaticBeforeToolUse = isStaticMode;

    if (glowBorder) glowBorder.style.display = 'none';
    if (stopContainer) stopContainer.style.display = 'none';
    if (staticIndicator && isStaticMode) staticIndicator.style.display = 'none';
  }

  /**
   * Show after tool use
   */
  function showAfterToolUse() {
    if (wasActiveBeforeToolUse) {
      if (glowBorder) glowBorder.style.display = '';
      if (stopContainer) stopContainer.style.display = '';
    }
    if (wasStaticBeforeToolUse && staticIndicator) {
      staticIndicator.style.display = '';
    }
    wasActiveBeforeToolUse = false;
    wasStaticBeforeToolUse = false;
  }

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'SHOW_AGENT_INDICATORS':
        isMcpMode = isMcpMode || message.isMcp === true;
        showAgentIndicators({ isMcp: message.isMcp });
        sendResponse({ success: true });
        break;
      case 'HIDE_AGENT_INDICATORS':
        hideAgentIndicators();
        sendResponse({ success: true });
        break;
      case 'HIDE_FOR_TOOL_USE':
        hideForToolUse();
        sendResponse({ success: true });
        break;
      case 'SHOW_AFTER_TOOL_USE':
        showAfterToolUse();
        sendResponse({ success: true });
        break;
      case 'SHOW_STATIC_INDICATOR':
        showStaticIndicator();
        sendResponse({ success: true });
        break;
      case 'HIDE_STATIC_INDICATOR':
        hideStaticIndicator();
        sendResponse({ success: true });
        break;
    }
    return false;
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (glowHeartbeatInterval) {
      clearInterval(glowHeartbeatInterval);
      glowHeartbeatInterval = null;
    }
    hideAgentIndicators();
    hideStaticIndicator();
  });

  console.log('[VisualIndicator] Claude-style visual indicator loaded');
})();
