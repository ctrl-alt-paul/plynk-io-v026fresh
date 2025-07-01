const { ipcMain } = require('electron');
const { 
  importWLEDProfileFromDevice, 
  saveWLEDProfile, 
  listWLEDProfiles, 
  loadWLEDProfile,
  getWLEDDeviceInfo,
  getWLEDDeviceState,
  getWLEDEffects,
  deleteWLEDProfile,
  sendWLEDProfileToDevice
} = require('../devices/wledController');
const { logger } = require('../logger');
const { logEvent } = require('../loggerBridge');

const registerWLEDHandlers = () => {
  // Import WLED profile from device
  ipcMain.handle('wled:import-profile', async (event, ipAddress) => {
    try {
      const profile = await importWLEDProfileFromDevice(ipAddress);
      return profile;
    } catch (error) {
      throw error;
    }
  });
  
  // Save WLED profile
  ipcMain.handle('wled:save-profile', async (event, profile) => {
    try {
      // Make sure the profile doesn't have segments - part of migration
      if (profile.segments) {
        const { segments, ...updatedProfile } = profile;
        profile = updatedProfile;
      }
      
      const filePath = await saveWLEDProfile(profile);
      return filePath;
    } catch (error) {
      throw error;
    }
  });
  
  // List available profiles
  ipcMain.handle('wled:list-profiles', async () => {
    try {
      const profiles = await listWLEDProfiles();
      return profiles;
    } catch (error) {
      return [];
    }
  });
  
  // Load specific profile
  ipcMain.handle('wled:load-profile', async (event, fileName) => {
    try {
      const profile = await loadWLEDProfile(fileName);
      return profile;
    } catch (error) {
      return null;
    }
  });
  
  // Delete specific profile
  ipcMain.handle('wled:delete-profile', async (event, fileName) => {
    try {
      const result = await deleteWLEDProfile(fileName);
      return result;
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
  
  // Get device info
  ipcMain.handle('wled:getDeviceInfo', async (event, ipAddress) => {
    try {
      const info = await getWLEDDeviceInfo(ipAddress);
      return info;
    } catch (error) {
      throw error;
    }
  });
  
  // Get device state
  ipcMain.handle('wled:getDeviceState', async (event, ipAddress) => {
    try {
      const state = await getWLEDDeviceState(ipAddress);
      return state;
    } catch (error) {
      throw error;
    }
  });
  
  // Get WLED effects
  ipcMain.handle('wled:getEffects', async (event, ipAddress) => {
    try {
      const effects = await getWLEDEffects(ipAddress);
      return effects;
    } catch (error) {
      throw error;
    }
  });
  
  // New handler for sending a profile to a device
  ipcMain.handle('wled:sendProfileToDevice', async (event, profile) => {
    try {
      const result = await sendWLEDProfileToDevice(profile);
      return result;
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
  
  // Add handlers for frontend logging events
  ipcMain.on('log:frontend-event', (event, logData) => {
    if (logData && logData.category && logData.message) {
      logEvent(logData.category, logData.message);
    }
  });
  
  ipcMain.on('log:frontend-error', (event, logData) => {
    if (logData && logData.category && logData.message) {
      logEvent(logData.category, logData.message);
    }
  });
};

module.exports = { registerWLEDHandlers };
