
const fetch = require('node-fetch');

class GitHubAuthService {
  static CLIENT_ID = 'Ov23liAm6kOcI9CcO5Qy'; // PLYNK-IO GitHub OAuth App
  static SCOPE = 'read:user';

  static async initiateDeviceFlow() {
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
      throw new Error('Failed to initiate GitHub device flow');
    }

    return response.json();
  }

  static async pollForToken(deviceCode) {
    return new Promise((resolve, reject) => {
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
            resolve(data.access_token);
          } else if (data.error && data.error !== 'authorization_pending') {
            reject(new Error(data.error_description || 'Authorization failed'));
          }
        } catch (error) {
          reject(error);
        }
      };

      const interval = setInterval(poll, 5000); // Poll every 5 seconds
      
      // Timeout after 15 minutes
      setTimeout(() => {
        clearInterval(interval);
        reject(new Error('Authorization timeout'));
      }, 15 * 60 * 1000);

      poll(); // Initial poll
    });
  }

  static async validateToken(token) {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error('Invalid token');
    }

    return response.json();
  }
}

module.exports = { GitHubAuthService };
