/**
 * WLED Controller for Electron
 * Provides functionality to interact with WLED devices and import their configurations
 */

const uuid = require('uuid').v4;
const { logger } = require('../logger');
const { logEvent } = require('../loggerBridge');
const fetch = require('node-fetch');

/**
 * Fetches device information from a WLED device
 * @param ipAddress IP address of the WLED device
 * @returns Promise with the device information
 */
async function getWLEDDeviceInfo(ipAddress) {
  try {
    logger.debug(`Fetching WLED device info from ${ipAddress}`);
    logEvent('wled', `WLED ${ipAddress} - Device Info: Fetching device information...`);
    
    const response = await fetch(`http://${ipAddress}/json/info`, { timeout: 3000 });
    if (!response.ok) {
      const error = `Failed to fetch WLED info: ${response.statusText}`;
      logEvent('wled', `WLED ${ipAddress} - Device Info: ERROR - ${error}`);
      throw new Error(error);
    }
    
    const info = await response.json();
    
    // Log the JSON response for WLED Scripts category
    logEvent('wled-scripts', `WLED ${ipAddress} - RECEIVED FROM DEVICE (Info):\n${JSON.stringify(info, null, 2)}`);
    
    logEvent('wled', `WLED ${ipAddress} - Device Info: SUCCESS - Device "${info.name || 'Unknown'}" with ${info.leds?.count || 0} LEDs`);
    return info;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error fetching WLED device info: ${errorMessage}`);
    logEvent('wled', `WLED ${ipAddress} - Device Info: ERROR - ${errorMessage}`);
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
    logger.debug(`Fetching WLED device state from ${ipAddress}`);
    logEvent('wled', `WLED ${ipAddress} - Device State: Fetching current state...`);
    
    const response = await fetch(`http://${ipAddress}/json/state`, { timeout: 3000 });
    if (!response.ok) {
      const error = `Failed to fetch WLED state: ${response.statusText}`;
      logEvent('wled', `WLED ${ipAddress} - Device State: ERROR - ${error}`);
      throw new Error(error);
    }
    
    const state = await response.json();
    
    // Log the JSON response for WLED Scripts category
    logEvent('wled-scripts', `WLED ${ipAddress} - RECEIVED FROM DEVICE (State):\n${JSON.stringify(state, null, 2)}`);
    
    logEvent('wled', `WLED ${ipAddress} - Device State: SUCCESS - ${state.seg?.length || 0} segments found`);
    return state;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error fetching WLED device state: ${errorMessage}`);
    logEvent('wled', `WLED ${ipAddress} - Device State: ERROR - ${errorMessage}`);
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
    logger.debug(`Fetching WLED effects from ${ipAddress}`);
    logEvent('wled', `WLED ${ipAddress} - Effects: Fetching available effects...`);
    
    const response = await fetch(`http://${ipAddress}/json/eff`, { timeout: 3000 });
    if (!response.ok) {
      const error = `Failed to fetch WLED effects: ${response.statusText}`;
      logEvent('wled', `WLED ${ipAddress} - Effects: ERROR - ${error}`);
      throw new Error(error);
    }
    const effects = await response.json();
    
    // Log the JSON response for WLED Scripts category
    logEvent('wled-scripts', `WLED ${ipAddress} - RECEIVED FROM DEVICE (Effects):\n${JSON.stringify(effects, null, 2)}`);
    
    if (!Array.isArray(effects) || effects.length === 0) {
      const error = 'No effects found in WLED response';
      logEvent('wled', `WLED ${ipAddress} - Effects: ERROR - ${error}`);
      throw new Error(error);
    }
    
    logger.debug(`Successfully fetched ${effects.length} effects from WLED device`);
    logEvent('wled', `WLED ${ipAddress} - Effects: SUCCESS - ${effects.length} effects available`);
    return effects;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error fetching WLED effects: ${errorMessage}`);
    logEvent('wled', `WLED ${ipAddress} - Effects: ERROR - ${errorMessage}`);
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
    logger.info(`Importing WLED profile from device at ${ipAddress}`);
    logEvent('wled', `WLED ${ipAddress} - Import Profile: Starting profile import...`);
    
    // Fetch device info and state using our new functions
    const info = await getWLEDDeviceInfo(ipAddress);
    const state = await getWLEDDeviceState(ipAddress);
    
    // Create profile from device data - updated to include exactValue and triggerType
    const profile = {
      id: uuid(),
      name: `${info.name || 'WLED'} - Imported`,
      deviceIP: ipAddress,
      importedAt: new Date().toISOString(),
      // Create rules directly from segments with exactValue and triggerType
      rules: state.seg.map((seg) => ({
        id: uuid(),
        triggerType: 'exact',
        exactValue: 1,
        segments: [seg.id],
        effect: seg.fx || 0,
        color: seg.col[0] || [255, 255, 255],
        brightness: seg.bri || 128,
        imported: true
      }))
    };

    logger.info(`Successfully imported WLED profile: ${profile.name} with ${profile.rules.length} segment rules`);
    logEvent('wled', `WLED ${ipAddress} - Import Profile: SUCCESS - Profile "${profile.name}" created with ${profile.rules.length} rules`);
    return profile;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error importing WLED profile: ${errorMessage}`);
    logEvent('wled', `WLED ${ipAddress} - Import Profile: ERROR - ${errorMessage}`);
    throw error;
  }
}

/**
 * Sends a WLED profile to the associated device for live preview
 * @param profile The WLED profile to send to the device
 * @returns Promise resolving to an object with success status and error message if applicable
 */
async function sendWLEDProfileToDevice(profile) {
  try {
    if (!profile || !profile.deviceIP) {
      const error = "Missing profile or device IP";
      logger.error("Cannot send profile to device: missing profile or device IP");
      logEvent('wled', `WLED Profile Send: ERROR - ${error}`);
      return { success: false, error };
    }

    logger.info(`Sending WLED profile ${profile.name} to device at ${profile.deviceIP} for testing`);
    logEvent('wled', `WLED ${profile.deviceIP} - Profile Send: Sending profile "${profile.name}" to device...`);
    
    // Create the payload for the WLED API
    const payload = {
      on: true,
      tt: 0,  // Add transition time of 0 for instant transitions
      seg: []
    };

    // Add each rule to the payload
    for (const rule of profile.rules) {
      // Skip rules with no segments defined
      if (!rule.segments || rule.segments.length === 0) {
        logger.warn(`Skipping rule ${rule.id} with no segments defined`);
        continue;
      }

      // Handle turnOffSegment flag first if present
      if (rule.turnOffSegment) {
        // Add all segments that should be turned off
        for (const segmentId of rule.segments) {
          payload.seg.push({ id: segmentId, on: false });
          logger.debug(`Adding segment ${segmentId} to turn OFF`);
        }
        continue;
      }

      // For active segments, add each segment from the rule with the same settings
      for (const segmentId of rule.segments) {
        payload.seg.push({
          id: segmentId,
          on: true,
          col: [rule.color], // WLED expects format [[r,g,b]]
          fx: rule.effect,
          bri: rule.brightness || 128
        });
        
        logger.debug(`Adding segment ${segmentId} with effect ${rule.effect} and brightness ${rule.brightness || 128}`);
      }
    }

    // Log the JSON payload being sent for WLED Scripts category
    logEvent('wled-scripts', `WLED ${profile.deviceIP} - SENT TO DEVICE (Profile "${profile.name}"):\n${JSON.stringify(payload, null, 2)}`);

    // Send the payload to the WLED device
    const response = await fetch(`http://${profile.deviceIP}/json/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 3000
    });

    if (!response.ok) {
      const error = `Failed to send profile to device: ${response.statusText}`;
      logger.error(error);
      logEvent('wled', `WLED ${profile.deviceIP} - Profile Send: ERROR - ${error}`);
      return { success: false, error };
    }

    logger.info(`Successfully sent profile ${profile.name} to device at ${profile.deviceIP}`);
    logEvent('wled', `WLED ${profile.deviceIP} - Profile Send: SUCCESS - Profile "${profile.name}" applied to device`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error sending WLED profile to device: ${errorMessage}`);
    logEvent('wled', `WLED Profile Send: ERROR - ${errorMessage}`);
    return { success: false, error: errorMessage };
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
    
    // Remove the segments array if it exists (migration)
    if (profile.segments) {
      logger.info(`Removing legacy segments array from profile ${profile.id}`);
      const updatedProfile = { ...profile };
      delete updatedProfile.segments;
      profile = updatedProfile;
    }
    
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
    
    logger.info(`WLED profile saved to ${filePath}`);
    return filePath;
  } catch (error) {
    logger.error(`Error saving WLED profile: ${error instanceof Error ? error.message : String(error)}`);
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
    logger.error(`Error listing WLED profiles: ${error instanceof Error ? error.message : String(error)}`);
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
    
    let profile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Migration for backward compatibility - convert old format profiles
    if (profile.segments && Array.isArray(profile.segments) && profile.segments.length > 0) {
      // If no rules exist, create them from segments
      if (!profile.rules || !Array.isArray(profile.rules) || profile.rules.length === 0) {
        logger.info(`Migrating legacy profile format for ${fileName}: creating rules from segments`);
        profile.rules = profile.segments.map((segment) => ({
          id: uuid(),
          triggerType: 'external',
          segments: [segment.id],
          effect: segment.effect,
          color: segment.color,
          brightness: segment.brightness,
          imported: true
        }));
      }
      
      // Remove the segments array since we've migrated to rules
      logger.info(`Removing legacy segments array from ${fileName}`);
      const { segments, ...updatedProfile } = profile;
      profile = updatedProfile;
      
      // Save the updated profile back to disk
      fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf8');
      logger.info(`Updated ${fileName} to new format without global segments array`);
    }
    
    return profile;
  } catch (error) {
    logger.error(`Error loading WLED profile: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Deletes a WLED profile by filename
 * @param fileName The profile filename to delete
 * @returns Promise resolving to an object with success status and error message if applicable
 */
async function deleteWLEDProfile(fileName) {
  const fs = require('fs');
  const path = require('path');
  const { app } = require('electron');
  
  try {
    logger.info(`Deleting WLED profile: ${fileName}`);
    
    // Determine the profiles directory and file path
    const appPath = app.getAppPath();
    const projectRoot = path.dirname(appPath);
    const profilesDir = path.join(projectRoot, 'public', 'wledProfiles');
    const filePath = path.join(profilesDir, fileName);
    const indexPath = path.join(profilesDir, 'wledProfiles.json');
    
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      logger.warn(`WLED profile not found for deletion: ${fileName}`);
      return { success: false, error: 'Profile not found' };
    }
    
    // Delete the profile file
    fs.unlinkSync(filePath);
    logger.info(`Deleted WLED profile file: ${filePath}`);
    
    // Update the index file to remove the deleted profile
    if (fs.existsSync(indexPath)) {
      const profiles = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      const updatedProfiles = profiles.filter(profile => profile !== fileName);
      fs.writeFileSync(indexPath, JSON.stringify(updatedProfiles, null, 2), 'utf8');
      logger.info(`Updated WLED profiles index, removed: ${fileName}`);
    }
    
    return { success: true };
  } catch (error) {
    logger.error(`Error deleting WLED profile: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, error: String(error) };
  }
}

module.exports = {
  importWLEDProfileFromDevice,
  saveWLEDProfile,
  listWLEDProfiles,
  loadWLEDProfile,
  getWLEDDeviceInfo,
  getWLEDDeviceState,
  getWLEDEffects,
  deleteWLEDProfile,
  sendWLEDProfileToDevice
};
