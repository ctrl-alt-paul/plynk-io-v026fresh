
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

  // Check GitHub authorization status once
  ipcMain.handle('github:check-auth-status', async (_, deviceCode) => {
    try {
      logToDevTools(`Checking GitHub authorization status for device code: ${deviceCode}`);
      
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

      if (response.status === 429) {
        logToDevTools('Rate limited by GitHub');
        return { success: false, error: 'Rate limited. Please wait a moment before checking again.' };
      }

      const data = await response.json();

      if (data.access_token) {
        logToDevTools('GitHub authorization successful');
        return { success: true, token: data.access_token };
      } else if (data.error) {
        if (data.error === 'authorization_pending') {
          logToDevTools('GitHub authorization still pending');
          return { success: false, error: 'authorization_pending', pending: true };
        } else if (data.error === 'slow_down') {
          logToDevTools('GitHub requests too frequent');
          return { success: false, error: 'Please wait a moment before checking again.' };
        } else {
          logToDevTools(`GitHub authorization error: ${data.error}`);
          return { success: false, error: data.error_description || 'Authorization failed' };
        }
      }

      return { success: false, error: 'Unknown response from GitHub' };
    } catch (error) {
      logToDevTools(`Error checking GitHub auth status: ${error.message}`);
      return { success: false, error: error.message };
    }
  });

  // Poll for GitHub access token (legacy - kept for compatibility)
  ipcMain.handle('github:poll-for-token', async (_, deviceCode) => {
    try {
      logToDevTools(`Polling for GitHub token with device code: ${deviceCode}`);
      const token = await GitHubAuthService.pollForToken(deviceCode);
      logToDevTools('GitHub token received successfully');
      return { success: true, token };
    } catch (error) {
      logToDevTools(`Error polling for GitHub token: ${error.message}`);
      
      // Provide more user-friendly error messages
      let userFriendlyError = error.message;
      if (error.message.includes('Too many requests')) {
        userFriendlyError = 'GitHub rate limit reached. Please wait 5-10 minutes before trying to connect again.';
      } else if (error.message.includes('slow_down')) {
        userFriendlyError = 'Polling too frequently. Please wait a moment and try again.';
      }
      
      return { success: false, error: userFriendlyError };
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

      // Log token scope for debugging
      try {
        const tokenInfoResponse = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });
        
        if (tokenInfoResponse.ok) {
          const scopes = tokenInfoResponse.headers.get('x-oauth-scopes') || 'No scopes header';
          logToDevTools(`GitHub Token Scopes: ${scopes}`);
        }
      } catch (scopeError) {
        logToDevTools(`Could not retrieve token scopes: ${scopeError.message}`);
      }

      // Log the labels being sent
      logToDevTools(`Labels being sent to GitHub: ${JSON.stringify(issueData.labels)}`);
      
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

module.exports = { registerGitHubHandlers };
