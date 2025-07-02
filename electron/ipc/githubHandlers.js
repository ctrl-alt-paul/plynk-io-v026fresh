
const { GitHubAuthService } = require('../services/githubAuthService');
const { logToDevTools } = require('../logger');
const fetch = require('node-fetch');

let handlersRegistered = false;

// GitHub OAuth IPC handlers
const registerGitHubHandlers = (ipcMain) => {
  // Prevent duplicate registration
  if (handlersRegistered) {
    logToDevTools('GitHub handlers already registered, skipping...');
    return;
  }

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

  // Create GitHub issue
  ipcMain.handle('github:create-issue', async (_, owner, repo, issueData) => {
    try {
      logToDevTools(`Creating GitHub issue in ${owner}/${repo}`);
      
      // Get token from global scope (set by the renderer process)
      const token = global.githubToken;
      
      if (!token) {
        throw new Error('No GitHub token available');
      }
      
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: issueData.title,
          body: issueData.body,
          labels: issueData.labels
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logToDevTools(`GitHub issue creation error: ${response.status} - ${errorText}`);
        
        if (response.status === 404) {
          throw new Error('Repository not found or insufficient permissions');
        } else if (response.status === 403) {
          throw new Error('Rate limit exceeded or insufficient permissions');
        } else if (response.status === 401) {
          throw new Error('Invalid or expired GitHub token');
        } else {
          throw new Error(`GitHub API error: ${response.status}`);
        }
      }

      const issue = await response.json();
      logToDevTools(`GitHub issue created successfully: ${issue.html_url}`);
      
      return { 
        success: true, 
        issueUrl: issue.html_url,
        issueNumber: issue.number
      };
    } catch (error) {
      logToDevTools(`Error creating GitHub issue: ${error.message}`);
      return { success: false, error: error.message };
    }
  });

  handlersRegistered = true;
  logToDevTools('GitHub handlers registered successfully');
};

module.exports = { registerGitHubHandlers };
