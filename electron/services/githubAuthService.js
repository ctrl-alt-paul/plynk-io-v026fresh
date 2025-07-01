
const fetch = require('node-fetch');

class GitHubAuthService {
  static CLIENT_ID = 'Ov23liJfTs91MQkp5rQ2'; // PLYNK-IO GitHub OAuth App
  static SCOPE = 'read:user';

  static async initiateDeviceFlow() {
    try {
      console.log('Initiating GitHub device flow...');
      const response = await fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.CLIENT_ID,
          scope: this.SCOPE,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('GitHub device flow error:', response.status, errorText);
        throw new Error(`Failed to initiate GitHub device flow: ${response.status}`);
      }

      const result = await response.json();
      console.log('Device flow initiated successfully');
      return result;
    } catch (error) {
      console.error('Device flow error:', error);
      throw error;
    }
  }

  static async pollForToken(deviceCode) {
    return new Promise((resolve, reject) => {
      console.log('Starting token polling...');
      const poll = async () => {
        try {
          const response = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              client_id: this.CLIENT_ID,
              device_code: deviceCode,
              grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            }),
          });

          const data = await response.json();

          if (data.access_token) {
            console.log('Access token received');
            resolve(data.access_token);
          } else if (data.error && data.error !== 'authorization_pending') {
            console.error('Authorization error:', data.error, data.error_description);
            reject(new Error(data.error_description || 'Authorization failed'));
          }
        } catch (error) {
          console.error('Polling error:', error);
          reject(error);
        }
      };

      const interval = setInterval(poll, 5000); // Poll every 5 seconds
      
      // Timeout after 15 minutes
      setTimeout(() => {
        console.log('Authorization timeout');
        clearInterval(interval);
        reject(new Error('Authorization timeout'));
      }, 15 * 60 * 1000);

      poll(); // Initial poll
    });
  }

  static async validateToken(token) {
    try {
      console.log('Validating GitHub token...');
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Token validation error:', response.status, errorText);
        throw new Error('Invalid token');
      }

      const user = await response.json();
      console.log('Token validated for user:', user.login);
      return user;
    } catch (error) {
      console.error('Token validation error:', error);
      throw error;
    }
  }
}

module.exports = { GitHubAuthService };
