
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { GitHubAuthService, GitHubDeviceFlow } from '@/services/githubAuth';

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
}

interface GitHubAuthState {
  isAuthenticated: boolean;
  user: GitHubUser | null;
  token: string | null;
  isConnecting: boolean;
  deviceFlow: GitHubDeviceFlow | null;
  error: string | null;
}

interface GitHubAuthContextType extends GitHubAuthState {
  startAuthentication: () => Promise<void>;
  cancelAuthentication: () => void;
  logout: () => void;
  clearError: () => void;
}

const GitHubAuthContext = createContext<GitHubAuthContextType | undefined>(undefined);

const STORAGE_KEY = 'github_auth_token';

// Simple encryption for token storage
const encryptToken = (token: string): string => {
  return btoa(token + '_plynk_salt');
};

const decryptToken = (encrypted: string): string | null => {
  try {
    const decoded = atob(encrypted);
    return decoded.replace('_plynk_salt', '');
  } catch {
    return null;
  }
};

export const GitHubAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GitHubAuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    isConnecting: false,
    deviceFlow: null,
    error: null,
  });

  // Load stored token on mount
  useEffect(() => {
    const loadStoredAuth = async () => {
      const encrypted = localStorage.getItem(STORAGE_KEY);
      if (encrypted) {
        const token = decryptToken(encrypted);
        if (token) {
          try {
            console.log('Validating stored GitHub token...');
            const user = await GitHubAuthService.validateToken(token);
            setState(prev => ({
              ...prev,
              isAuthenticated: true,
              user,
              token,
            }));
            console.log('Stored GitHub token is valid');
          } catch (error) {
            console.warn('Stored GitHub token is invalid, clearing...');
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      }
    };

    loadStoredAuth();
  }, []);

  const startAuthentication = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isConnecting: true, error: null }));
      console.log('Starting GitHub authentication flow...');

      // Step 1: Initiate device flow
      const deviceFlow = await GitHubAuthService.initiateDeviceFlow();
      setState(prev => ({ ...prev, deviceFlow }));
      console.log('GitHub device flow initiated, user code:', deviceFlow.user_code);

      // Step 2: Start polling for token
      try {
        const token = await GitHubAuthService.pollForToken(deviceFlow.device_code);
        console.log('GitHub token received, validating...');

        // Step 3: Validate token and get user info
        const user = await GitHubAuthService.validateToken(token);
        
        // Step 4: Store token and update state
        const encrypted = encryptToken(token);
        localStorage.setItem(STORAGE_KEY, encrypted);

        setState(prev => ({
          ...prev,
          isAuthenticated: true,
          user,
          token,
          isConnecting: false,
          deviceFlow: null,
          error: null,
        }));

        console.log('GitHub authentication completed successfully for user:', user.login);
      } catch (pollingError) {
        console.error('GitHub polling failed:', pollingError);
        setState(prev => ({
          ...prev,
          isConnecting: false,
          error: pollingError instanceof Error ? pollingError.message : 'Authentication failed',
        }));
      }
    } catch (error) {
      console.error('GitHub authentication failed:', error);
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Failed to start authentication',
      }));
    }
  }, []);

  const cancelAuthentication = useCallback(() => {
    console.log('Cancelling GitHub authentication');
    GitHubAuthService.stopPolling();
    setState(prev => ({
      ...prev,
      isConnecting: false,
      deviceFlow: null,
      error: null,
    }));
  }, []);

  const logout = useCallback(() => {
    console.log('Logging out of GitHub');
    GitHubAuthService.stopPolling();
    localStorage.removeItem(STORAGE_KEY);
    setState({
      isAuthenticated: false,
      user: null,
      token: null,
      isConnecting: false,
      deviceFlow: null,
      error: null,
    });
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const value: GitHubAuthContextType = {
    ...state,
    startAuthentication,
    cancelAuthentication,
    logout,
    clearError,
  };

  return (
    <GitHubAuthContext.Provider value={value}>
      {children}
    </GitHubAuthContext.Provider>
  );
};

export const useGitHubAuth = (): GitHubAuthContextType => {
  const context = useContext(GitHubAuthContext);
  if (context === undefined) {
    throw new Error('useGitHubAuth must be used within a GitHubAuthProvider');
  }
  return context;
};
