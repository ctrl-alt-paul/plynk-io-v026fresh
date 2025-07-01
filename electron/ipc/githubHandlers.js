
const { GitHubAuthService } = require('../services/githubAuthService');
const { logToDevTools } = require('../logger');

// GitHub OAuth IPC handlers
const registerGitHubHandlers = (ipcMain) => {
  // Start GitHub device flow
  ipcMain.handle('github:start-device-flow', async () => {
    try {
      logToDevTools('Starting GitHub device flow');
      const deviceFlow = await GitHubAuthService.initiateDeviceFlow();
      logToDevTools(`Device flow initiated: ${deviceFlow.user_code}`);
      return { success: true, data: deviceFlow };
    } catch (error) {
      logToDevTools(`Error starting GitHub device flow: ${error.message}`);
      return { success: false, error: error.message };
    }
  });

  // Poll for GitHub access token
  ipcMain.handle('github:poll-for-token', async (_, deviceCode) => {
    try {
      logToDevTools(`Polling for GitHub token with device code: ${deviceCode}`);
      const token = await GitHubAuthService.pollForToken(deviceCode);
      logToDevTools('GitHub token received successfully');
      return { success: true, token };
    } catch (error) {
      logToDevTools(`Error polling for GitHub token: ${error.message}`);
      return { success: false, error: error.message };
    }
  });

  // Validate GitHub token
  ipcMain.handle('github:validate-token', async (_, token) => {
    try {
      logToDevTools('Validating GitHub token');
      const user = await GitHubAuthService.validateToken(token);
      logToDevTools(`GitHub token validated for user: ${user.login}`);
      return { success: true, user };
    } catch (error) {
      logToDevTools(`Error validating GitHub token: ${error.message}`);
      return { success: false, error: error.message };
    }
  });
};

module.exports = { registerGitHubHandlers };
