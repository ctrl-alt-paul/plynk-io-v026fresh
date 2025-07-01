import React, { createContext, useContext, useEffect, useState } from 'react';

export interface GitHubUser {
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
}

export interface GitHubAuthState {
  isConnected: boolean;
  isLoading: boolean;
  status: 'disconnected' | 'connected' | 'invalid' | 'loading';
  user: GitHubUser | null;
  error: string | null;
}

export interface GitHubAuthContextType extends GitHubAuthState {
  connectGitHub: () => Promise<void>;
  disconnect: () => void;
  checkTokenValidity: () => Promise<void>;
  viewSubmissions: () => void;
}

const GitHubAuthContext = createContext<GitHubAuthContextType | undefined>(undefined);

const STORAGE_KEY = 'github_auth_token';

// Simple encryption for local storage (basic obfuscation)
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
    isConnected: false,
    isLoading: true,
    status: 'loading',
    user: null,
    error: null,
  });

  const getStoredToken = (): string | null => {
    const encrypted = localStorage.getItem(STORAGE_KEY);
    return encrypted ? decryptToken(encrypted) : null;
  };

  const storeToken = (token: string): void => {
    const encrypted = encryptToken(token);
    localStorage.setItem(STORAGE_KEY, encrypted);
  };

  const removeToken = (): void => {
    localStorage.removeItem(STORAGE_KEY);
  };

  const checkTokenValidity = async (): Promise<void> => {
    const token = getStoredToken();
    if (!token) {
      setState(prev => ({ ...prev, status: 'disconnected', isLoading: false, isConnected: false }));
      return;
    }

    try {
      const result = await window.electron?.githubValidateToken(token);
      
      if (result?.success && result.user) {
        setState(prev => ({
          ...prev,
          status: 'connected',
          isConnected: true,
          isLoading: false,
          user: result.user,
          error: null,
        }));
      } else {
        // Token is invalid
        removeToken();
        setState(prev => ({
          ...prev,
          status: 'invalid',
          isConnected: false,
          isLoading: false,
          user: null,
          error: result?.error || 'Token expired or invalid',
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        status: 'invalid',
        isConnected: false,
        isLoading: false,
        error: 'Failed to validate token',
      }));
    }
  };

  const connectGitHub = async (): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Start device flow using IPC
      const deviceResult = await window.electron?.githubStartDeviceFlow();
      
      if (!deviceResult?.success) {
        throw new Error(deviceResult?.error || 'Failed to start OAuth flow');
      }

      const deviceData = deviceResult.data;
      
      // Open GitHub authorization URL in external browser
      if (window.electron?.openExternal) {
        window.electron.openExternal(deviceData.verification_uri);
      } else {
        window.open(deviceData.verification_uri, '_blank');
      }

      // Show user code and poll for completion
      alert(`Please authorize PLYNK-IO on GitHub using this code: ${deviceData.user_code}`);

      // Poll for access token using IPC
      const tokenResult = await window.electron?.githubPollForToken(deviceData.device_code);
      
      if (!tokenResult?.success) {
        throw new Error(tokenResult?.error || 'Failed to get access token');
      }

      storeToken(tokenResult.token);
      await checkTokenValidity();
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to connect to GitHub',
      }));
    }
  };

  const disconnect = (): void => {
    removeToken();
    setState({
      isConnected: false,
      isLoading: false,
      status: 'disconnected',
      user: null,
      error: null,
    });
  };

  const viewSubmissions = (): void => {
    if (state.user) {
      const url = `${state.user.html_url}?tab=repositories`;
      if (window.electron?.openExternal) {
        window.electron.openExternal(url);
      } else {
        window.open(url, '_blank');
      }
    }
  };

  // Auto-check token validity on mount
  useEffect(() => {
    checkTokenValidity();
  }, []);

  const value: GitHubAuthContextType = {
    ...state,
    connectGitHub,
    disconnect,
    checkTokenValidity,
    viewSubmissions,
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
