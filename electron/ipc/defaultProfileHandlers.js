
const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

function registerDefaultProfileHandlers(app) {
  // Handler for listing default memory profiles
  ipcMain.handle('memory-profile:list-default', async () => {
    try {
      const appPath = app.getAppPath();
      const projectRoot = path.dirname(appPath);
      const defaultMemoryProfilesPath = path.join(projectRoot, 'public', 'default', 'memoryProfiles');
      
      if (!fs.existsSync(defaultMemoryProfilesPath)) {
        return { success: true, profiles: [] };
      }
      
      const files = fs.readdirSync(defaultMemoryProfilesPath);
      const profiles = files.filter(file => file.endsWith('.json'));
      
      return { success: true, profiles };
    } catch (error) {
      console.error('Error listing default memory profiles:', error);
      return { success: false, error: error.message };
    }
  });

  // Handler for getting a specific default memory profile
  ipcMain.handle('memory-profile:get-default', async (_, fileName) => {
    try {
      const appPath = app.getAppPath();
      const projectRoot = path.dirname(appPath);
      const profilePath = path.join(projectRoot, 'public', 'default', 'memoryProfiles', fileName);
      
      if (!fs.existsSync(profilePath)) {
        return { success: false, error: `Default profile file not found: ${fileName}` };
      }
      
      const profileJson = fs.readFileSync(profilePath, 'utf8');
      const profile = JSON.parse(profileJson);
      
      return { success: true, profile };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Handler for listing community memory profiles
  ipcMain.handle('memory-profile:list-community', async () => {
    try {
      const appPath = app.getAppPath();
      const projectRoot = path.dirname(appPath);
      const communityMemoryProfilesPath = path.join(projectRoot, 'public', 'community', 'memoryProfiles');
      
      if (!fs.existsSync(communityMemoryProfilesPath)) {
        return { success: true, profiles: [] };
      }
      
      const files = fs.readdirSync(communityMemoryProfilesPath);
      const profiles = files.filter(file => file.endsWith('.json'));
      
      return { success: true, profiles };
    } catch (error) {
      console.error('Error listing community memory profiles:', error);
      return { success: false, error: error.message };
    }
  });

  // Handler for getting a specific community memory profile
  ipcMain.handle('memory-profile:get-community', async (_, fileName) => {
    try {
      const appPath = app.getAppPath();
      const projectRoot = path.dirname(appPath);
      const profilePath = path.join(projectRoot, 'public', 'community', 'memoryProfiles', fileName);
      
      if (!fs.existsSync(profilePath)) {
        return { success: false, error: `Community profile file not found: ${fileName}` };
      }
      
      const profileJson = fs.readFileSync(profilePath, 'utf8');
      const profile = JSON.parse(profileJson);
      
      return { success: true, profile };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Handler for saving community memory profiles
  ipcMain.handle('memory-profile:save-community', async (_, fileName, profileData) => {
    try {
      const appPath = app.getAppPath();
      const projectRoot = path.dirname(appPath);
      const communityMemoryProfilesPath = path.join(projectRoot, 'public', 'community', 'memoryProfiles');
      
      // Ensure directory exists
      if (!fs.existsSync(communityMemoryProfilesPath)) {
        fs.mkdirSync(communityMemoryProfilesPath, { recursive: true });
      }
      
      const profilePath = path.join(communityMemoryProfilesPath, fileName);
      fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2));
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Handler for listing default message profiles
  ipcMain.handle('message-profile:list-default', async () => {
    try {
      const appPath = app.getAppPath();
      const projectRoot = path.dirname(appPath);
      const defaultMessageProfilesPath = path.join(projectRoot, 'public', 'default', 'messageProfiles');
      
      if (!fs.existsSync(defaultMessageProfilesPath)) {
        return [];
      }
      
      const files = fs.readdirSync(defaultMessageProfilesPath);
      const profiles = files.filter(file => file.endsWith('.json'));
      
      return profiles;
    } catch (error) {
      console.error('Error listing default message profiles:', error);
      return [];
    }
  });

  // Handler for getting a specific default message profile
  ipcMain.handle('message-profile:get-default', async (_, fileName) => {
    try {
      const appPath = app.getAppPath();
      const projectRoot = path.dirname(appPath);
      const profilePath = path.join(projectRoot, 'public', 'default', 'messageProfiles', fileName);
      
      if (!fs.existsSync(profilePath)) {
        return { success: false, error: `Default profile file not found: ${fileName}` };
      }
      
      const profileJson = fs.readFileSync(profilePath, 'utf8');
      const profile = JSON.parse(profileJson);
      
      return { success: true, profile };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Handler for listing community message profiles
  ipcMain.handle('message-profile:list-community', async () => {
    try {
      const appPath = app.getAppPath();
      const projectRoot = path.dirname(appPath);
      const communityMessageProfilesPath = path.join(projectRoot, 'public', 'community', 'messageProfiles');
      
      if (!fs.existsSync(communityMessageProfilesPath)) {
        return [];
      }
      
      const files = fs.readdirSync(communityMessageProfilesPath);
      const profiles = files.filter(file => file.endsWith('.json'));
      
      return profiles;
    } catch (error) {
      console.error('Error listing community message profiles:', error);
      return [];
    }
  });

  // Handler for getting a specific community message profile
  ipcMain.handle('message-profile:get-community', async (_, fileName) => {
    try {
      const appPath = app.getAppPath();
      const projectRoot = path.dirname(appPath);
      const profilePath = path.join(projectRoot, 'public', 'community', 'messageProfiles', fileName);
      
      if (!fs.existsSync(profilePath)) {
        return { success: false, error: `Community profile file not found: ${fileName}` };
      }
      
      const profileJson = fs.readFileSync(profilePath, 'utf8');
      const profile = JSON.parse(profileJson);
      
      return { success: true, profile };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Handler for saving community message profiles
  ipcMain.handle('message-profile:save-community', async (_, fileName, profileData) => {
    try {
      const appPath = app.getAppPath();
      const projectRoot = path.dirname(appPath);
      const communityMessageProfilesPath = path.join(projectRoot, 'public', 'community', 'messageProfiles');
      
      // Ensure directory exists
      if (!fs.existsExists(communityMessageProfilesPath)) {
        fs.mkdirSync(communityMessageProfilesPath, { recursive: true });
      }
      
      const profilePath = path.join(communityMessageProfilesPath, fileName);
      fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2));
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerDefaultProfileHandlers };
