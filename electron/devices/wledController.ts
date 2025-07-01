
/**
 * WLED Controller for Electron
 * Provides functionality to interact with WLED devices and import their configurations
 */

const uuid = require('uuid').v4;
const { logger } = require('../logger');
const fetch = require('node-fetch');

/**
 * Fetches device information from a WLED device
 * @param ipAddress IP address of the WLED device
 * @returns Promise with the device information
 */
async function getWLEDDeviceInfo(ipAddress) {
  try {
    const response = await fetch(`http://${ipAddress}/json/info`, { timeout: 3000 });
    if (!response.ok) {
      throw new Error(`Failed to fetch WLED info: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Fetches the current state from a WLED device
 * @param ipAddress IP address of the WLED device
 * @returns Promise with the device state
 */
async function getWLEDDeviceState(ipAddress) {
  try {
    const response = await fetch(`http://${ipAddress}/json/state`, { timeout: 3000 });
    if (!response.ok) {
      throw new Error(`Failed to fetch WLED state: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Fetches available effects from a WLED device
 * @param ipAddress IP address of the WLED device
 * @returns Promise with an array of effect names
 */
async function getWLEDEffects(ipAddress) {
  try {
    const response = await fetch(`http://${ipAddress}/json/eff`, { timeout: 3000 });
    if (!response.ok) {
      throw new Error(`Failed to fetch WLED effects: ${response.statusText}`);
    }
    const effects = await response.json();
    
    if (!Array.isArray(effects) || effects.length === 0) {
      throw new Error('No effects found in WLED response');
    }
    
    return effects;
  } catch (error) {
    throw error;
  }
}

/**
 * Imports the current configuration from a WLED device and returns it as a profile
 * @param ipAddress IP address of the WLED device
 * @returns Promise with the imported WLED profile
 */
async function importWLEDProfileFromDevice(ipAddress) {
  try {
    // Fetch device info and state using our new functions
    const info = await getWLEDDeviceInfo(ipAddress);
    const state = await getWLEDDeviceState(ipAddress);
    
    // Create profile from device data
    const profile = {
      id: uuid(),
      name: `${info.name || 'WLED'} - Imported`,
      deviceIP: ipAddress,
      importedAt: new Date().toISOString(),
      segmentCount: info.leds.seglens ? info.leds.seglens.length : (state.seg ? state.seg.length : 1),
      totalLEDs: info.leds.count || 0,
      segments: state.seg.map((seg) => ({
        id: seg.id ?? 0,
        color: seg.col[0] || [255, 255, 255],
        effect: seg.fx || 0,
        brightness: seg.bri || 128,
        speed: seg.sx || 128
      }))
    };

    return profile;
  } catch (error) {
    throw error;
  }
}

/**
 * Saves a WLED profile to disk
 * @param profile The WLED profile to save
 * @param fileName Optional file name override
 * @returns Promise resolving to the file path where the profile was saved
 */
async function saveWLEDProfile(profile, fileName) {
  const fs = require('fs');
  const path = require('path');
  const { app } = require('electron');
  
  try {
    // Determine the profiles directory
    const appPath = app.getAppPath();
    const projectRoot = path.dirname(appPath);
    const profilesDir = path.join(projectRoot, 'public', 'wledProfiles');
    
    // Ensure the directory exists
    if (!fs.existsSync(profilesDir)) {
      fs.mkdirSync(profilesDir, { recursive: true });
    }
    
    // Generate file name based on profile ID or provided name
    const fn = fileName || `${profile.id}.json`;
    const filePath = path.join(profilesDir, fn);
    
    // Write the profile to disk
    fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf8');
    
    // Update the index file
    const indexPath = path.join(profilesDir, 'wledProfiles.json');
    let profiles = [];
    
    if (fs.existsSync(indexPath)) {
      profiles = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    }
    
    if (!profiles.includes(fn)) {
      profiles.push(fn);
      fs.writeFileSync(indexPath, JSON.stringify(profiles, null, 2), 'utf8');
    }
    
    return filePath;
  } catch (error) {
    throw error;
  }
}

/**
 * Lists all saved WLED profiles
 * @returns Promise resolving to an array of profile file names
 */
async function listWLEDProfiles() {
  const fs = require('fs');
  const path = require('path');
  const { app } = require('electron');
  
  try {
    const appPath = app.getAppPath();
    const projectRoot = path.dirname(appPath);
    const profilesDir = path.join(projectRoot, 'public', 'wledProfiles');
    const indexPath = path.join(profilesDir, 'wledProfiles.json');
    
    if (!fs.existsSync(profilesDir)) {
      fs.mkdirSync(profilesDir, { recursive: true });
    }
    
    if (fs.existsSync(indexPath)) {
      return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    }
    
    // If index doesn't exist, create it from directory contents
    const files = fs.readdirSync(profilesDir)
      .filter((file) => file.endsWith('.json') && file !== 'wledProfiles.json');
      
    fs.writeFileSync(indexPath, JSON.stringify(files, null, 2), 'utf8');
    return files;
  } catch (error) {
    return [];
  }
}

/**
 * Loads a specific WLED profile by filename
 * @param fileName The profile filename to load
 * @returns Promise resolving to the loaded profile or null if not found
 */
async function loadWLEDProfile(fileName) {
  const fs = require('fs');
  const path = require('path');
  const { app } = require('electron');
  
  try {
    const appPath = app.getAppPath();
    const projectRoot = path.dirname(appPath);
    const filePath = path.join(projectRoot, 'public', 'wledProfiles', fileName);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const profile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return profile;
  } catch (error) {
    return null;
  }
}

module.exports = {
  importWLEDProfileFromDevice,
  saveWLEDProfile,
  listWLEDProfiles,
  loadWLEDProfile,
  getWLEDDeviceInfo,
  getWLEDDeviceState,
  getWLEDEffects
};
