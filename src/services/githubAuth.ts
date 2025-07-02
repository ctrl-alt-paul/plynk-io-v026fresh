
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

  static async checkAuthStatus(deviceCode: string): Promise<string | null> {
    console.log('Checking GitHub authorization status via IPC for device code:', deviceCode);
    
    if (!window.electron?.githubCheckAuthStatus) {
      throw new Error('Electron IPC not available');
    }

    const result = await window.electron.githubCheckAuthStatus(deviceCode);
    console.log('GitHub status check response via IPC:', { success: result.success, hasToken: !!result.token, pending: result.pending });

    if (result.success && result.token) {
      console.log('GitHub access token received successfully via IPC!');
      return result.token;
    } else if (result.pending) {
      console.log('GitHub authorization still pending');
      return null; // Still pending, no error
    } else {
      console.error('GitHub status check error via IPC:', result.error);
      throw new Error(result.error || 'Authorization failed');
    }
  }

  static async pollForToken(deviceCode: string): Promise<string> {
    console.log('Starting GitHub token polling via IPC for device code:', deviceCode);
    
    if (!window.electron?.githubPollForToken) {
      throw new Error('Electron IPC not available');
    }

    // Let the backend handle all polling logic - this is now a single call that waits for completion
    const result = await window.electron.githubPollForToken(deviceCode);
    console.log('GitHub polling response via IPC:', { success: result.success, hasToken: !!result.token });

    if (result.success && result.token) {
      console.log('GitHub access token received successfully via IPC!');
      return result.token;
    } else {
      console.error('GitHub polling error via IPC:', result.error);
      throw new Error(result.error || 'Authorization failed');
    }
  }

  static stopPolling(): void {
    // No longer needed since we don't have frontend polling
    console.log('Stop polling called (no-op in backend-only approach)');
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
