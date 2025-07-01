
// Disabled logger - all functions are stubbed but preserve signatures
// This ensures imports continue to work without any logging side effects

// No-op functions that return safe defaults
function logToFile(message) {
  return true;
}

function logToFileAsync(message) {
  return Promise.resolve(true);
}

function logToDevTools(message) {
  // No-op - no DevTools communication
}

function logCycleSeparator() {
  // No-op - no cycle logging
}

function flushLogBuffer() {
  return Promise.resolve();
}

function setHighPerformanceMode(enabled) {
  return false; // Return safe default
}

function isHighPerformanceMode() {
  return false; // Always return false as safe default
}

// Create a logger object that matches the interface expected by the PacDrive modules
const logger = {
  info: function(message) {
    return true;
  },
  debug: function(message) {
    return true;
  },
  error: function(message) {
    return true;
  },
  warn: function(message) {
    return true;
  }
};

// Export both the individual functions and the logger object (preserve exact same exports)
module.exports = {
  logger,
  logToFile,
  logToFileAsync,
  logToDevTools,
  logCycleSeparator,
  setHighPerformanceMode,
  isHighPerformanceMode,
  flushLogBuffer
};
