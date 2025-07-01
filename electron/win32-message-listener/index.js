// electron/win32-message-listener/index.js
// Wrapper around the native C++ addon

const bindings = require('bindings');
let native;
try {
  native = bindings('message_listener');
} catch (e) {
  console.warn('[Win32Listener] Native addon not loaded:', e.message);
}

function startListener(callback) {
  if (!native?.startListener) {
    console.error('[Win32Listener] Native module not available.');
    return;
  }

  console.log('[Win32Listener] startListener called');

  // Wrap the callback so we can log everything coming from C++
  native.startListener((msg) => {
    console.log('[Win32Listener] received', msg);   // ← debug line
    callback(msg);                                 // pass through to caller
  });
}

function stopListener() {
  native?.stopListener?.();
}

module.exports = {
  startListener,
  stopListener,
};
