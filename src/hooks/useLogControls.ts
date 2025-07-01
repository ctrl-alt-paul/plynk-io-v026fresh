import { useState, useEffect } from 'react';
import { useLogContext } from '@/contexts/LogContext';
import { isElectron } from '@/utils/isElectron';

export const useLogControls = () => {
  const { maxLogEntries: contextMaxLogEntries, updateMaxLogEntries: contextUpdateMaxLogEntries } = useLogContext();
  const [isLoading, setIsLoading] = useState(true);

  // Load log configuration on mount
  useEffect(() => {
    const loadLogConfig = async () => {
      if (!window.electron?.ipcRenderer) {
        setIsLoading(false);
        return;
      }

      try {
        // The LogContext already loads this, so we can just use its value
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load log configuration:', error);
        setIsLoading(false);
      }
    };

    loadLogConfig();
  }, []);

  // Listen for settings changes from other parts of the app
  useEffect(() => {
    if (isElectron() && window.electron?.ipcRenderer) {
      const handleSettingsChange = (event: any, data: any) => {
        console.log('Received log config settings change:', data);
        
        if (data.maxLogEntries !== undefined) {
          console.log('Updating maxLogEntries to:', data.maxLogEntries);
          // Update through the context to keep everything synchronized
          contextUpdateMaxLogEntries(data.maxLogEntries);
        }
      };

      // Listen for settings change broadcasts
      window.electron.ipcRenderer.on('settings:logConfigChanged', handleSettingsChange);
      
      return () => {
        window.electron.ipcRenderer.removeAllListeners('settings:logConfigChanged');
      };
    }
  }, [contextUpdateMaxLogEntries]);

  // Update max log entries using the LogContext function for synchronization
  const updateMaxLogEntries = async (newMaxEntries: number): Promise<boolean> => {
    return await contextUpdateMaxLogEntries(newMaxEntries);
  };

  return {
    maxLogEntries: contextMaxLogEntries,
    updateMaxLogEntries,
    isLoading
  };
};
