/**
 * Offscreen Document for Clipboard Operations
 * Bypass Manifest V3 clipboard restrictions
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'CLIPBOARD_WRITE' || message.target !== 'offscreen') {
    return;
  }

  handleClipboardWrite(message.data)
    .then(() => sendResponse({ success: true }))
    .catch(error => sendResponse({ success: false, error: error.message }));

  return true; // Keep channel open for async response
});

async function handleClipboardWrite({ mimeType, payload }) {
  try {
    // Create appropriate blob based on MIME type
    const blob = new Blob([payload], { type: mimeType });

    // Build clipboard items with fallback text
    const clipboardItems = {
      [mimeType]: blob
    };

    // Always include text/plain for compatibility
    if (mimeType !== 'text/plain') {
      clipboardItems['text/plain'] = new Blob([payload], { type: 'text/plain' });
    }

    // For HTML content, also include text/html
    if (mimeType === 'image/svg+xml') {
      clipboardItems['text/html'] = new Blob([payload], { type: 'text/html' });
    }

    const item = new ClipboardItem(clipboardItems);
    await navigator.clipboard.write([item]);

    console.log('[Offscreen] Clipboard written successfully:', mimeType);

  } catch (error) {
    console.error('[Offscreen] Clipboard write failed:', error);

    // Fallback: Try document.execCommand
    try {
      const textarea = document.createElement('textarea');
      textarea.value = payload;
      textarea.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      console.log('[Offscreen] Clipboard written via execCommand fallback');
    } catch (fallbackError) {
      throw new Error(`Both clipboard methods failed: ${error.message}`);
    }
  }
}
