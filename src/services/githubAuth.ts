
export interface GitHubDeviceFlow {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export class GitHubAuthService {
  private static readonly CLIENT_ID = 'Ov23liJfTs91MQkp5rQ2'; // PLYNK-IO GitHub OAuth App
  private static readonly SCOPE = 'read:user public_repo';

  static async initiateDeviceFlow(): Promise<GitHubDeviceFlow> {
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

  static async pollForToken(deviceCode: string): Promise<string> {
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

          const data: GitHubTokenResponse = await response.json();

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

  static async validateToken(token: string): Promise<any> {
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

  static async getUserRepositories(token: string): Promise<any[]> {
    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=10', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch repositories');
    }

    return response.json();
  }
}
