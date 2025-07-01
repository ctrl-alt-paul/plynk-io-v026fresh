
const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

// Helper function to get the game profiles directory path
const getGameProfilesDir = (app) => {
  const appPath = app.getAppPath();
  const projectRoot = path.dirname(appPath);
  return path.join(projectRoot, 'public', 'gameProfiles');
};

// Helper function to ensure the game profiles directory exists
const ensureGameProfilesDir = (app) => {
  const gameProfilesDir = getGameProfilesDir(app);
  
  if (!fs.existsSync(gameProfilesDir)) {
    fs.mkdirSync(gameProfilesDir, { recursive: true });
  }
  
  return gameProfilesDir;
};

// Helper function to read all .json files from the game profiles directory
const readGameProfilesFromDirectory = (app) => {
  const gameProfilesDir = getGameProfilesDir(app);
  
  if (!fs.existsSync(gameProfilesDir)) {
    return [];
  }
  
  try {
    const files = fs.readdirSync(gameProfilesDir);
    return files.filter(file => file.toLowerCase().endsWith('.json'));
  } catch (error) {
    //console.error(`Error reading game profiles directory: ${error}`);
    return [];
  }
};

// Helper function to log to dev tools
const logToDevTools = (message) => {
  if (global.mainWindow) {
    global.mainWindow.webContents.send('log:devtools', message);
  }
};

// Helper function to migrate Arduino device types to Serial
const migrateGameProfile = (profile) => {
  if (!profile || !profile.outputs) {
    return profile;
  }
  
  // Migrate any Arduino device types to Serial
  const migratedOutputs = profile.outputs.map(output => {
    if (output.device === 'Arduino') {
      return {
        ...output,
        device: 'Serial'
      };
    }
    return output;
  });
  
  return {
    ...profile,
    outputs: migratedOutputs
  };
};

// Register all game profile handlers
function registerGameProfileHandlers(app) {
  const gameProfilesDir = ensureGameProfilesDir(app);

  // Get all game profiles - now reads directly from directory
  ipcMain.handle('game-profile-store:get-profiles', async () => {
    try {
      const profiles = readGameProfilesFromDirectory(app);
      return profiles;
    } catch (error) {
      //console.error('Error listing game profiles:', error);
      return [];
    }
  });

  // Add a game profile - simplified without index file management
  ipcMain.handle('game-profile-store:add-profile', async (_, profile) => {
    try {
      if (!profile || !profile.id) {
        return { success: false, error: 'Invalid profile data' };
      }
      
      const fileName = `${profile.id}.json`;
      const filePath = path.join(gameProfilesDir, fileName);
      
      // Migrate profile before saving
      const migratedProfile = migrateGameProfile(profile);
      
      // Ensure messageFile is preserved if present
      const profileToSave = {
        ...migratedProfile,
        messageFile: migratedProfile.messageFile || undefined
      };
      
      // Write the profile file
      fs.writeFileSync(filePath, JSON.stringify(profileToSave, null, 2), 'utf8');
      
      return { success: true };
    } catch (error) {
      //console.error('Error adding game profile:', error);
      return { success: false, error: error.message };
    }
  });

  // Update a game profile - simplified without index file management
  ipcMain.handle('game-profile-store:update-profile', async (_, id, profile) => {
    try {
      if (!id || !profile) {
        return { success: false, error: 'Invalid profile data' };
      }
      
      const fileName = `${id}.json`;
      const filePath = path.join(gameProfilesDir, fileName);
      
      // Migrate profile before saving
      const migratedProfile = migrateGameProfile(profile);
      
      // Ensure messageFile is preserved if present
      const profileToSave = {
        ...migratedProfile,
        messageFile: migratedProfile.messageFile || undefined
      };
      
      // Write the updated profile file
      fs.writeFileSync(filePath, JSON.stringify(profileToSave, null, 2), 'utf8');
      
      return { success: true };
    } catch (error) {
      //console.error('Error updating game profile:', error);
      return { success: false, error: error.message };
    }
  });

  // Remove a game profile - simplified without index file management
  ipcMain.handle('game-profile-store:remove-profile', async (_, id) => {
    try {
      if (!id) {
        return { success: false, error: 'Invalid profile ID' };
      }
      
      // Check if ID already has .json extension
      const hasJsonExt = id.toLowerCase().endsWith('.json');
      const fileName = hasJsonExt ? id : `${id}.json`;
      const filePath = path.join(gameProfilesDir, fileName);
      
      // Remove the file if it exists
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      return { success: true };
    } catch (error) {
      //console.error('Error removing game profile:', error);
      return { success: false, error: error.message };
    }
  });

  // Load a game profile
  ipcMain.handle('game-profile-store:load-profile', async (_, profile) => {
    try {
      if (!profile) {
        return { success: false, error: 'Invalid profile data' };
      }
      
      // Migrate profile before loading
      const migratedProfile = migrateGameProfile(profile);
      
      // Assuming mainWindow and startPollingMemory are accessible from the global scope
      if (global.mainWindow) {
        global.mainWindow.webContents.send('start-memory-read', migratedProfile);
      }
      
      return { success: true };
    } catch (error) {
      //console.error('Error loading game profile:', error);
      return { success: false, error: error.message };
    }
  });

  // Stop the current game profile
  ipcMain.handle('game-profile-store:stop-profile', async () => {
    try {
      // Assuming stopPollingMemory is accessible from the global scope
      if (global.mainWindow) {
        global.mainWindow.webContents.send('stop-memory-read');
      }
      
      return { success: true };
    } catch (error) {
      //console.error('Error stopping game profile:', error);
      return { success: false, error: error.message };
    }
  });

  // Get a game profile (new handler for retrieving profile data)
  ipcMain.handle('game-profile:get', async (_, profileName) => {
    try {
      if (!profileName) {
        return { success: false, error: 'Invalid profile name' };
      }
      
      // Automatically append .json extension if not present
      const fileName = profileName.endsWith('.json') ? profileName : `${profileName}.json`;
      const filePath = path.join(gameProfilesDir, fileName);
      
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `Profile not found: ${profileName}` };
      }
      
      const profileData = fs.readFileSync(filePath, 'utf8');
      const profile = JSON.parse(profileData);
      
      // Migrate profile after loading
      const migratedProfile = migrateGameProfile(profile);
      
      // Ensure messageFile is safely handled
      const profileWithMessageFile = {
        ...migratedProfile,
        messageFile: migratedProfile.messageFile || undefined
      };
      
      return { success: true, profile: profileWithMessageFile };
    } catch (error) {
      //console.error('Error getting game profile:', error);
      return { success: false, error: error.message };
    }
  });

  // Save a game profile - simplified without index file management
  ipcMain.handle('game-profile:save', async (_, fileName, profileJson) => {
    try {
      const gameProfilesDir = ensureGameProfilesDir(app);
      
      const profilePath = path.join(gameProfilesDir, fileName);
      
      // Migrate profile before saving
      const migratedProfile = migrateGameProfile(profileJson);
      
      // Ensure messageFile is preserved if present
      const profileToSave = {
        ...migratedProfile,
        messageFile: migratedProfile.messageFile || undefined
      };
      
      fs.writeFileSync(profilePath, JSON.stringify(profileToSave, null, 2), 'utf8');
      
      if (global.mainWindow) {
        global.mainWindow.webContents.send('log:devtools', `Game profile successfully saved to: ${profilePath}`);
      }
      
      return { success: true, message: `Profile saved to ${fileName}` };
    } catch (error) {
      if (global.mainWindow) {
        global.mainWindow.webContents.send('log:devtools', `Error saving game profile: ${error.message}`);
      }
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerGameProfileHandlers };
