import React, { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { GitHubDeviceDialog } from '@/components/GitHubDeviceDialog';

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

  // Add dialog state
  const [deviceDialog, setDeviceDialog] = useState({
    open: false,
    userCode: '',
    verificationUri: '',
    isPolling: false,
  });

  const { toast } = useToast();

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
      console.error('Token validation error:', error);
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
      console.log('Starting GitHub device flow...');
      const deviceResult = await window.electron?.githubStartDeviceFlow();
      
      if (!deviceResult?.success) {
        throw new Error(deviceResult?.error || 'Failed to start OAuth flow');
      }

      const deviceData = deviceResult.data;
      console.log('Device flow started, showing dialog...');
      
      // Show device dialog instead of toast and opening browser immediately
      setDeviceDialog({
        open: true,
        userCode: deviceData.user_code,
        verificationUri: deviceData.verification_uri,
        isPolling: false,
      });

      // Start polling in the background
      console.log('Polling for access token...');
      setDeviceDialog(prev => ({ ...prev, isPolling: true }));
      
      const tokenResult = await window.electron?.githubPollForToken(deviceData.device_code);
      
      // Close dialog and reset state
      setDeviceDialog({
        open: false,
        userCode: '',
        verificationUri: '',
        isPolling: false,
      });
      
      if (!tokenResult?.success) {
        throw new Error(tokenResult?.error || 'Failed to get access token');
      }

      console.log('Token received, validating...');
      storeToken(tokenResult.token);
      await checkTokenValidity();
      
      toast({
        title: "GitHub Connected",
        description: "Successfully connected to GitHub!",
      });
    } catch (error) {
      console.error('GitHub connection error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to GitHub';
      
      // Close dialog on error
      setDeviceDialog({
        open: false,
        userCode: '',
        verificationUri: '',
        isPolling: false,
      });
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      
      toast({
        title: "GitHub Connection Failed",
        description: errorMessage,
        variant: "destructive",
      });
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
    
    toast({
      title: "GitHub Disconnected",
      description: "Successfully disconnected from GitHub",
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
      {/* Add the device dialog */}
      <GitHubDeviceDialog
        open={deviceDialog.open}
        onOpenChange={(open) => {
          if (!open && deviceDialog.isPolling) {
            // Don't allow closing while polling unless there's an error
            return;
          }
          setDeviceDialog(prev => ({ ...prev, open }));
        }}
        userCode={deviceDialog.userCode}
        verificationUri={deviceDialog.verificationUri}
        isPolling={deviceDialog.isPolling}
      />
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
