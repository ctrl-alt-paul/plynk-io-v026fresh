
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
  private static readonly CLIENT_ID = 'Ov23liJfTs91MQkp5rQ2';
  private static readonly SCOPE = 'read:user public_repo';
  private static activePolling: { intervalId?: NodeJS.Timeout; deviceCode?: string } = {};

  static async initiateDeviceFlow(): Promise<GitHubDeviceFlow> {
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
    console.log('Device flow initiated successfully:', result);
    return result;
  }

  static async pollForToken(deviceCode: string): Promise<string> {
    // Clear any existing polling to prevent duplicates
    this.stopPolling();
    
    return new Promise((resolve, reject) => {
      console.log('Starting GitHub token polling for device code:', deviceCode);
      
      this.activePolling.deviceCode = deviceCode;
      let pollCount = 0;
      const maxPolls = 180; // 15 minutes max
      
      const poll = async () => {
        try {
          // Check if polling was cancelled
          if (this.activePolling.deviceCode !== deviceCode) {
            console.log('Polling cancelled for device code:', deviceCode);
            return;
          }
          
          pollCount++;
          console.log(`GitHub polling attempt ${pollCount}/${maxPolls}`);
          
          if (pollCount > maxPolls) {
            this.stopPolling();
            reject(new Error('Authorization timeout - exceeded maximum polling attempts'));
            return;
          }

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

          if (response.status === 429) {
            console.warn('GitHub rate limit hit, stopping polling');
            this.stopPolling();
            reject(new Error('Too many requests to GitHub. Please wait a few minutes and try again.'));
            return;
          }

          const data: GitHubTokenResponse = await response.json();
          console.log('GitHub polling response:', { error: data.error, hasToken: !!data.access_token });

          if (data.access_token) {
            console.log('GitHub access token received successfully!');
            this.stopPolling();
            resolve(data.access_token);
          } else if (data.error) {
            if (data.error === 'authorization_pending') {
              console.log('Authorization still pending, continuing to poll...');
              // Continue polling
            } else if (data.error === 'slow_down') {
              console.warn('GitHub requested to slow down polling');
              this.stopPolling();
              reject(new Error('Polling too frequently. Please wait and try again.'));
            } else {
              console.error('GitHub authorization error:', data.error, data.error_description);
              this.stopPolling();
              reject(new Error(data.error_description || 'Authorization failed'));
            }
          }
        } catch (error) {
          console.error('Polling error:', error);
          this.stopPolling();
          reject(error);
        }
      };

      // Start polling with 5 second interval (GitHub recommended minimum)
      this.activePolling.intervalId = setInterval(poll, 5000);
      
      // Set overall timeout
      setTimeout(() => {
        if (this.activePolling.deviceCode === deviceCode) {
          console.log('GitHub authorization timeout');
          this.stopPolling();
          reject(new Error('Authorization timeout'));
        }
      }, 15 * 60 * 1000); // 15 minutes

      // Initial poll
      poll();
    });
  }

  static stopPolling(): void {
    if (this.activePolling.intervalId) {
      console.log('Stopping GitHub polling');
      clearInterval(this.activePolling.intervalId);
      this.activePolling.intervalId = undefined;
    }
    this.activePolling.deviceCode = undefined;
  }

  static async validateToken(token: string): Promise<any> {
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
