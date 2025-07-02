
const { GitHubAuthService } = require('../services/githubAuthService');
const { logToDevTools } = require('../logger');
const { getMainWindow } = require('../state/globals');
const fetch = require('node-fetch');

let handlersRegistered = false;
let currentPolling = null; // Track current polling operation

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

  // Start background polling (non-blocking)
  ipcMain.handle('github:start-background-polling', async (_, deviceCode) => {
    try {
      logToDevTools(`Starting background polling for device code: ${deviceCode}`);
      
      // Stop any existing polling
      if (currentPolling) {
        currentPolling.stop = true;
      }
      
      // Create new polling operation
      currentPolling = { deviceCode, stop: false };
      
      // Start polling in background (don't await)
      backgroundPoll(deviceCode, currentPolling);
      
      return { success: true };
    } catch (error) {
      logToDevTools(`Error starting background polling: ${error.message}`);
      return { success: false, error: error.message };
    }
  });

  // Stop polling
  ipcMain.handle('github:stop-polling', async () => {
    try {
      logToDevTools('Stopping GitHub polling');
      if (currentPolling) {
        currentPolling.stop = true;
        currentPolling = null;
      }
      return { success: true };
    } catch (error) {
      logToDevTools(`Error stopping polling: ${error.message}`);
      return { success: false, error: error.message };
    }
  });

  // Poll for GitHub access token (single check)
  ipcMain.handle('github:poll-for-token', async (_, deviceCode) => {
    try {
      logToDevTools(`Single token check for device code: ${deviceCode}`);
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: GitHubAuthService.CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });

      const data = await response.json();
      
      if (data.access_token) {
        return { success: true, token: data.access_token };
      } else {
        return { success: false, error: data.error_description || data.error || 'No token received' };
      }
    } catch (error) {
      logToDevTools(`Error in single token check: ${error.message}`);
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
  ipcMain.handle('github:create-issue', async (_, owner, repo, issueData, token) => {
    try {
      logToDevTools(`Creating GitHub issue in ${owner}/${repo}`);
      
      if (!token) {
        throw new Error('No GitHub token provided');
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
          throw new Error('Repository not found or insufficient permissions. Please ensure you have write access to the repository and your GitHub token has the correct permissions.');
        } else if (response.status === 403) {
          const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
          if (rateLimitRemaining === '0') {
            throw new Error('GitHub API rate limit exceeded. Please wait before trying again.');
          } else {
            throw new Error('Insufficient permissions to create issues. Please ensure your GitHub token has the correct permissions.');
          }
        } else if (response.status === 401) {
          throw new Error('Invalid or expired GitHub token. Please reconnect your GitHub account.');
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

// Background polling function
async function backgroundPoll(deviceCode, pollingOperation) {
  logToDevTools('Starting background GitHub polling');
  let pollCount = 0;
  const maxPolls = 180; // 15 minutes max
  const mainWindow = getMainWindow();
  
  const poll = async () => {
    try {
      // Check if polling was stopped
      if (pollingOperation.stop) {
        logToDevTools('Background polling stopped');
        return;
      }
      
      pollCount++;
      logToDevTools(`Background polling attempt ${pollCount}/${maxPolls}`);
      
      if (pollCount > maxPolls) {
        logToDevTools('Background polling timeout');
        if (mainWindow) {
          mainWindow.webContents.send('github-auth-timeout', {});
        }
        return;
      }

      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: GitHubAuthService.CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });

      const data = await response.json();

      if (data.access_token) {
        logToDevTools('Background polling successful - token received');
        
        // Validate token and get user info
        try {
          const user = await GitHubAuthService.validateToken(data.access_token);
          if (mainWindow) {
            mainWindow.webContents.send('github-auth-success', {
              token: data.access_token,
              user: user
            });
          }
        } catch (validationError) {
          logToDevTools(`Token validation failed: ${validationError.message}`);
          if (mainWindow) {
            mainWindow.webContents.send('github-auth-error', {
              error: 'Token validation failed'
            });
          }
        }
        return;
      } else if (data.error && data.error !== 'authorization_pending') {
        logToDevTools(`Background polling error: ${data.error}`);
        if (mainWindow) {
          mainWindow.webContents.send('github-auth-error', {
            error: data.error_description || data.error
          });
        }
        return;
      }
      
      // Continue polling after delay
      setTimeout(() => {
        if (!pollingOperation.stop) {
          poll();
        }
      }, 5000); // 5 second intervals
      
    } catch (error) {
      logToDevTools(`Background polling error: ${error.message}`);
      if (mainWindow) {
        mainWindow.webContents.send('github-auth-error', {
          error: error.message
        });
      }
    }
  };

  // Start polling
  poll();
}

module.exports = { registerGitHubHandlers };
