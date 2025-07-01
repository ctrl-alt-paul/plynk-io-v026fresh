
const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

function registerMessageProfileHandlers(app) {
  // Handler for listing message profiles
  ipcMain.handle('message-profile:list', async () => {
    try {
      const appPath = app.getAppPath();
      const projectRoot = path.dirname(appPath);
      const messageProfilesPath = path.join(projectRoot, 'public', 'messageProfiles');
      
      if (!fs.existsSync(messageProfilesPath)) {
        return [];
      }
      
      const files = fs.readdirSync(messageProfilesPath);
      const profiles = files.filter(file => file.endsWith('.json'));
      
      return profiles;
    } catch (error) {
      console.error('Error listing message profiles:', error);
      return [];
    }
  });

  // Handler for getting a specific message profile
  ipcMain.handle('message-profile:get', async (_, fileName) => {
    try {
      const appPath = app.getAppPath();
      const projectRoot = path.dirname(appPath);
      const profilePath = path.join(projectRoot, 'public', 'messageProfiles', fileName);
      
      if (!fs.existsSync(profilePath)) {
        return { success: false, error: `Profile file not found: ${fileName}` };
      }
      
      const profileJson = fs.readFileSync(profilePath, 'utf8');
      const profile = JSON.parse(profileJson);
      
      return { success: true, profile };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Handler for saving a message profile
  ipcMain.handle('message-profile:save', async (_, fileName, profileData) => {
    try {
      const appPath = app.getAppPath();
      const projectRoot = path.dirname(appPath);
      const messageProfilesPath = path.join(projectRoot, 'public', 'messageProfiles');
      
      if (!fs.existsSync(messageProfilesPath)) {
        fs.mkdirSync(messageProfilesPath, { recursive: true });
      }
      
      const profilePath = path.join(messageProfilesPath, fileName);
      fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2), 'utf8');
      
      return { success: true, message: `Profile saved to ${fileName}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Handler for deleting a message profile
  ipcMain.handle('message-profile:delete', async (_, fileName) => {
    try {
      const appPath = app.getAppPath();
      const projectRoot = path.dirname(appPath);
      const profilePath = path.join(projectRoot, 'public', 'messageProfiles', fileName);
      
      if (fs.existsSync(profilePath)) {
        fs.unlinkSync(profilePath);
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerMessageProfileHandlers };
