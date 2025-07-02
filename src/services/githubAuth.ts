
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

export interface GitHubAuthEvents {
  'github-auth-success': { token: string; user: any };
  'github-auth-error': { error: string };
  'github-auth-timeout': {};
  'github-auth-cancelled': {};
}

export class GitHubAuthService {
  private static eventListeners: Map<string, Function[]> = new Map();

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

  static async startBackgroundPolling(deviceCode: string): Promise<void> {
    console.log('Starting background GitHub polling for device code:', deviceCode);
    
    if (!window.electron?.invoke) {
      throw new Error('Electron IPC not available');
    }

    // Start background polling - this returns immediately
    window.electron.invoke('github:start-background-polling', deviceCode);
  }

  static addEventListener<K extends keyof GitHubAuthEvents>(
    event: K,
    callback: (data: GitHubAuthEvents[K]) => void
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  static removeEventListener<K extends keyof GitHubAuthEvents>(
    event: K,
    callback: (data: GitHubAuthEvents[K]) => void
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  static emit<K extends keyof GitHubAuthEvents>(event: K, data: GitHubAuthEvents[K]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  static stopPolling(): void {
    console.log('Stopping GitHub polling');
    if (window.electron?.invoke) {
      window.electron.invoke('github:stop-polling');
    }
    this.emit('github-auth-cancelled', {});
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

// Initialize event listeners for IPC events
if (typeof window !== 'undefined' && window.electron) {
  // Set up IPC event listeners
  const { ipcRenderer } = window.require('electron');
  
  ipcRenderer.on('github-auth-success', (_, data) => {
    console.log('GitHub auth success event received');
    GitHubAuthService.emit('github-auth-success', data);
  });
  
  ipcRenderer.on('github-auth-error', (_, data) => {
    console.log('GitHub auth error event received');
    GitHubAuthService.emit('github-auth-error', data);
  });
  
  ipcRenderer.on('github-auth-timeout', (_, data) => {
    console.log('GitHub auth timeout event received');
    GitHubAuthService.emit('github-auth-timeout', data);
  });
}
