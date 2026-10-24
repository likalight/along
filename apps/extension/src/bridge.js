(() => {
  if (globalThis.__alongBridgeInstalled) return;
  globalThis.__alongBridgeInstalled = true;
  const status = connection => window.postMessage({ type: 'ALONG_EXTENSION_STATUS', extensionId: chrome.runtime.id, connected: Boolean(connection), sessionId: connection?.sessionId, epoch: connection?.epoch }, location.origin);
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.extensionId !== chrome.runtime.id) return;
    if (event.data.type === 'ALONG_VIDEO_OPEN') {
      const { sessionId, epoch, videoId, requestId } = event.data;
      chrome.runtime.sendMessage({ type: 'ALONG_VIDEO_OPEN', sessionId, epoch, videoId }).then(result => {
        window.postMessage({ type: 'ALONG_VIDEO_RESULT', extensionId: chrome.runtime.id, requestId, ok: result.ok === true, error: result.error }, location.origin);
      }).catch(() => {});
      return;
    }
    if (event.data.type === 'ALONG_EXTENSION_STATUS_REQUEST') { chrome.runtime.sendMessage({ type: 'ALONG_PAIR_STATUS' }).then(result => status(result.connection)).catch(() => {}); return; }
    if (event.data.type !== 'ALONG_PAIR_CODE' || typeof event.data.code !== 'string') return;
    const requestId = typeof event.data.requestId === 'string' ? event.data.requestId.slice(0, 100) : undefined;
    chrome.runtime.sendMessage({ type: 'ALONG_PAIR_CODE', extensionId: event.data.extensionId, code: event.data.code }).then(result => {
      window.postMessage({ type: 'ALONG_PAIR_RESULT', extensionId: chrome.runtime.id, requestId, ok: result.ok === true, sessionId: result.sessionId, epoch: result.epoch, error: result.error }, location.origin);
    }).catch(() => { /* Extension was reloaded. */ });
  });
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id) return false;
    if (message.type === 'ALONG_VIDEO_RETURNED') { window.postMessage({ type: 'ALONG_VIDEO_RETURNED', extensionId: chrome.runtime.id, sessionId: message.sessionId }, location.origin); return false; }
    if (message.type === 'ALONG_SESSION_CHECK') { reply({ same: location.pathname === '/' && sessionStorage.getItem('along.sessionId') === message.sessionId }); return false; }
    if (message.type === 'ALONG_CONNECTION_STATUS') { status(message.connection); return false; }
    if (message.type === 'ALONG_CONNECT_REQUEST') { window.postMessage({ type: 'ALONG_EXTENSION_CONNECT', extensionId: chrome.runtime.id }, location.origin); return false; }
    return false;
  });
  // A pairing page can wait for this rather than racing script injection.
  window.postMessage({ type: 'ALONG_EXTENSION_READY', extensionId: chrome.runtime.id }, location.origin);
  chrome.runtime.sendMessage({ type: 'ALONG_PAIR_STATUS' }).then(result => status(result.connection)).catch(() => {});
})();
