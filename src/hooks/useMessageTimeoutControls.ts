
import { useState, useEffect, useCallback } from 'react';
import { isElectron } from '@/utils/isElectron';

// Helper functions to convert between seconds and min:sec format
const formatSecondsToMinSec = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const parseMinSecToSeconds = (minSecString: string): number => {
  const parts = minSecString.split(':');
  if (parts.length !== 2) return -1;
  
  const minutes = parseInt(parts[0], 10);
  const seconds = parseInt(parts[1], 10);
  
  if (isNaN(minutes) || isNaN(seconds) || minutes < 0 || seconds < 0 || seconds >= 60) {
    return -1;
  }
  
  return minutes * 60 + seconds;
};

export const useMessageTimeoutControls = () => {
  const [timeout, setTimeout] = useState(120); // Default 120 seconds (2 minutes)
  const [isTimeoutEnabled, setIsTimeoutEnabled] = useState(true); // Default enabled (fallback only)
  const [isLoading, setIsLoading] = useState(true);

  // Load timeout settings on mount
  useEffect(() => {
    const loadTimeout = async () => {
      if (isElectron() && window.electron?.ipcRenderer) {
        try {
          const result = await window.electron.ipcRenderer.invoke('settings:getMessageListener');
          
          if (result?.timeout !== undefined) {
            setTimeout(result.timeout);
          }
          if (result?.timeoutEnabled !== undefined) {
            setIsTimeoutEnabled(result.timeoutEnabled);
          }
        } catch (error) {
          console.error('Failed to load message timeout setting:', error);
        }
      }
      setIsLoading(false);
    };

    loadTimeout();
  }, []);

  // Listen for settings changes from other parts of the app
  useEffect(() => {
    if (isElectron() && window.electron?.ipcRenderer) {
      const handleSettingsChange = (event: any, data: any) => {
        if (data.timeout !== undefined) {
          setTimeout(data.timeout);
        }
        if (data.timeoutEnabled !== undefined) {
          setIsTimeoutEnabled(data.timeoutEnabled);
        }
      };

      // Listen for settings change broadcasts
      window.electron.ipcRenderer.on('settings:messageListenerChanged', handleSettingsChange);
      
      return () => {
        window.electron.ipcRenderer.removeAllListeners('settings:messageListenerChanged');
      };
    }
  }, []);

  // Update timeout setting
  const setTimeoutValue = useCallback(async (newTimeout: number): Promise<boolean> => {
    // Validate timeout (1-999999 seconds)
    if (newTimeout < 1 || newTimeout > 999999) {
      return false;
    }

    if (isElectron() && window.electron?.ipcRenderer) {
      try {
        const result = await window.electron.ipcRenderer.invoke('settings:updateMessageListener', {
          timeout: newTimeout
        });
        
        if (result?.success) {
          setTimeout(newTimeout);
          return true;
        }
      } catch (error) {
        console.error('Failed to update message timeout setting:', error);
      }
    }
    
    return false;
  }, []);

  // Update timeout from min:sec string
  const setTimeoutFromMinSec = useCallback(async (minSecString: string): Promise<boolean> => {
    const seconds = parseMinSecToSeconds(minSecString);
    if (seconds < 1 || seconds > 999999) {
      return false;
    }
    return await setTimeoutValue(seconds);
  }, [setTimeoutValue]);

  // Update timeout enabled state
  const setTimeoutEnabled = useCallback(async (enabled: boolean): Promise<boolean> => {
    if (isElectron() && window.electron?.ipcRenderer) {
      try {
        const result = await window.electron.ipcRenderer.invoke('settings:updateMessageListener', {
          timeoutEnabled: enabled
        });
        
        if (result?.success) {
          setIsTimeoutEnabled(enabled);
          return true;
        } else {
          console.error('Failed to update timeoutEnabled, result:', result);
        }
      } catch (error) {
        console.error('Failed to update message timeout enabled setting:', error);
      }
    }
    
    return false;
  }, []);

  return {
    timeout,
    isTimeoutEnabled,
    setTimeoutValue,
    setTimeoutFromMinSec,
    setTimeoutEnabled,
    isLoading,
    formatSecondsToMinSec,
    parseMinSecToSeconds
  };
};
