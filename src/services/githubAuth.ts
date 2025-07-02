
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
  private static activePolling: { intervalId?: NodeJS.Timeout; deviceCode?: string } = {};

  static async initiateDeviceFlow(): Promise<GitHubDeviceFlow> {
    console.log('Initiating GitHub device flow via IPC...');
    
    if (!window.electron?.githubStartDeviceFlow) {
      throw new Error('Electron IPC not available');
    }

    const result = await window.electron.githubStartDeviceFlow();
    
    if (!result.success) {
      console.error('GitHub device flow error:', result.error);
      throw new Error(result.error || 'Failed to initiate GitHub device flow');
    }

    console.log('Device flow initiated successfully:', result.data);
    return result.data;
  }

  static async pollForToken(deviceCode: string): Promise<string> {
    // Clear any existing polling to prevent duplicates
    this.stopPolling();
    
    return new Promise((resolve, reject) => {
      console.log('Starting GitHub token polling via IPC for device code:', deviceCode);
      
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

          if (!window.electron?.githubPollForToken) {
            this.stopPolling();
            reject(new Error('Electron IPC not available'));
            return;
          }

          const result = await window.electron.githubPollForToken(deviceCode);
          console.log('GitHub polling response via IPC:', { success: result.success, hasToken: !!result.token });

          if (result.success && result.token) {
            console.log('GitHub access token received successfully via IPC!');
            this.stopPolling();
            resolve(result.token);
          } else if (!result.success) {
            console.error('GitHub polling error via IPC:', result.error);
            this.stopPolling();
            reject(new Error(result.error || 'Authorization failed'));
          }
          // If no success and no error, continue polling
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
    console.log('Validating GitHub token via IPC...');
    
    if (!window.electron?.githubValidateToken) {
      throw new Error('Electron IPC not available');
    }

    const result = await window.electron.githubValidateToken(token);
    
    if (!result.success) {
      console.error('Token validation error via IPC:', result.error);
      throw new Error(result.error || 'Invalid token');
    }

    const user = result.user;
    console.log('Token validated via IPC for user:', user.login);
    return user;
  }

  static async getUserRepositories(token: string): Promise<any[]> {
    if (!window.electron?.githubCreateIssue) {
      throw new Error('Electron IPC not available');
    }

    // This would need a new IPC handler if you want to implement it
    // For now, we'll just return an empty array
    console.log('getUserRepositories not implemented via IPC yet');
    return [];
  }
}
