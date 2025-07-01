
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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

  // Updated dialog state to include success information
  const [deviceDialog, setDeviceDialog] = useState({
    open: false,
    userCode: '',
    verificationUri: '',
    isPolling: false,
    isConnected: false,
    connectedUser: null as GitHubUser | null,
  });

  // Track if a connection attempt is in progress
  const isConnectingRef = useRef(false);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const cancelGitHubAuth = (): void => {
    console.log('Cancelling GitHub authorization...');
    
    // Clear any ongoing polling
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    
    // Reset connection state
    isConnectingRef.current = false;
    
    // Reset dialog state
    setDeviceDialog({
      open: false,
      userCode: '',
      verificationUri: '',
      isPolling: false,
      isConnected: false,
      connectedUser: null,
    });
    
    setState(prev => ({
      ...prev,
      isLoading: false,
      error: null,
    }));
    
    toast({
      title: "GitHub Authorization Cancelled",
      description: "The GitHub connection process has been cancelled.",
    });
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
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      console.log('GitHub connection already in progress, ignoring request');
      return;
    }
    
    isConnectingRef.current = true;
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
      
      // Show device dialog
      setDeviceDialog({
        open: true,
        userCode: deviceData.user_code,
        verificationUri: deviceData.verification_uri,
        isPolling: false,
        isConnected: false,
        connectedUser: null,
      });

      // Start polling in the background
      console.log('Polling for access token...');
      setDeviceDialog(prev => ({ ...prev, isPolling: true }));
      
      const tokenResult = await window.electron?.githubPollForToken(deviceData.device_code);
      
      if (!tokenResult?.success) {
        throw new Error(tokenResult?.error || 'Failed to get access token');
      }

      console.log('Token received, validating...');
      storeToken(tokenResult.token);
      await checkTokenValidity();
      
      // Update dialog to show success state
      setDeviceDialog(prev => ({
        ...prev,
        isPolling: false,
        isConnected: true,
        connectedUser: state.user,
      }));

      // Wait a bit for state to update, then use the updated user info
      setTimeout(() => {
        setDeviceDialog(prev => ({
          ...prev,
          connectedUser: state.user,
        }));
      }, 100);
      
      toast({
        title: "GitHub Connected",
        description: "Successfully connected to GitHub!",
      });
    } catch (error) {
      console.error('GitHub connection error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to GitHub';
      
      // Update dialog to show error state but keep it open
      setDeviceDialog(prev => ({
        ...prev,
        isPolling: false,
        isConnected: false,
        connectedUser: null,
      }));
      
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
    } finally {
      isConnectingRef.current = false;
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
      {/* Updated device dialog with conditional close handling */}
      <GitHubDeviceDialog
        open={deviceDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            // If successfully connected, just close the dialog
            if (deviceDialog.isConnected) {
              setDeviceDialog(prev => ({ ...prev, open: false }));
            } else {
              // If not connected, cancel the auth process
              cancelGitHubAuth();
            }
          }
        }}
        userCode={deviceDialog.userCode}
        verificationUri={deviceDialog.verificationUri}
        isPolling={deviceDialog.isPolling}
        isConnected={deviceDialog.isConnected}
        connectedUser={deviceDialog.connectedUser}
        onCancel={cancelGitHubAuth}
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
