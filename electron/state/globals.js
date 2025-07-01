
// Global state management for the electron app
let mainWindow = null;
let tray = null;
let currentGameProfile = null;
let outputOverrides = {};

// Track initialization status
let pacDriveInitialized = false;
let wledHandlersRegistered = false;
let processMonitorStarted = false;

// App state flags
let hasShownTrayNotification = false;
let isQuitting = false;

function initializeGlobalState() {
  // Set global references
  global.mainWindow = null;
  global.outputOverrides = {};
  global.pacDriveInitialized = false;
  global.wledHandlersRegistered = false;
  global.processMonitorStarted = false;
}

function setMainWindow(window) {
  mainWindow = window;
  global.mainWindow = window;
}

function getMainWindow() {
  return mainWindow;
}

function setTray(trayInstance) {
  tray = trayInstance;
}

function getTray() {
  return tray;
}

function setCurrentGameProfile(profile) {
  currentGameProfile = profile;
}

function getCurrentGameProfile() {
  return currentGameProfile;
}

function setOutputOverrides(overrides) {
  outputOverrides = overrides || {};
  global.outputOverrides = outputOverrides;
}

function getOutputOverrides() {
  return outputOverrides;
}

function setPacDriveInitialized(status) {
  pacDriveInitialized = status;
  global.pacDriveInitialized = status;
}

function isPacDriveInitialized() {
  return pacDriveInitialized;
}

function setWledHandlersRegistered(status) {
  wledHandlersRegistered = status;
  global.wledHandlersRegistered = status;
}

function isWledHandlersRegistered() {
  return wledHandlersRegistered;
}

function setProcessMonitorStarted(status) {
  processMonitorStarted = status;
  global.processMonitorStarted = status;
}

function isProcessMonitorStarted() {
  return processMonitorStarted;
}

function setHasShownTrayNotification(shown) {
  hasShownTrayNotification = shown;
}

function getHasShownTrayNotification() {
  return hasShownTrayNotification;
}

function setIsQuitting(quitting) {
  isQuitting = quitting;
}

function getIsQuitting() {
  return isQuitting;
}

module.exports = {
  initializeGlobalState,
  setMainWindow,
  getMainWindow,
  setTray,
  getTray,
  setCurrentGameProfile,
  getCurrentGameProfile,
  setOutputOverrides,
  getOutputOverrides,
  setPacDriveInitialized,
  isPacDriveInitialized,
  setWledHandlersRegistered,
  isWledHandlersRegistered,
  setProcessMonitorStarted,
  isProcessMonitorStarted,
  setHasShownTrayNotification,
  getHasShownTrayNotification,
  setIsQuitting,
  getIsQuitting
};
