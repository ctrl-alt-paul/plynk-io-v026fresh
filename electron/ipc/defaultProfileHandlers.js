
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
}

module.exports = { registerDefaultProfileHandlers };
