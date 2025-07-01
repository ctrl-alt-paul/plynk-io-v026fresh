
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { isElectron } from '@/utils/isElectron';

interface StartupConfig {
  startMinimized: boolean;
  startWithWindows: boolean;
}

export function useStartupControls() {
  const [startMinimized, setStartMinimizedState] = useState(false);
  const [startWithWindows, setStartWithWindowsState] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Load startup config on mount
  useEffect(() => {
    const loadConfig = async () => {
      if (!window.electron?.ipcRenderer) return;
      
      try {
        const result = await window.electron.ipcRenderer.invoke('startup:get-config');
        if (result.success) {
          setStartMinimizedState(result.startMinimized);
          setStartWithWindowsState(result.startWithWindows);
        }
      } catch (error) {
        console.error('Failed to load startup config:', error);
      }
    };

    loadConfig();
  }, []);

  // Listen for settings changes from other parts of the app
  useEffect(() => {
    if (isElectron() && window.electron?.ipcRenderer) {
      const handleSettingsChange = (event: any, data: any) => {
        console.log('Received startup settings change:', data);
        
        if (data.startMinimized !== undefined) {
          console.log('Updating startMinimized to:', data.startMinimized);
          setStartMinimizedState(data.startMinimized);
        }
        if (data.startWithWindows !== undefined) {
          console.log('Updating startWithWindows to:', data.startWithWindows);
          setStartWithWindowsState(data.startWithWindows);
        }
      };

      // Listen for settings change broadcasts
      window.electron.ipcRenderer.on('settings:startupChanged', handleSettingsChange);
      
      return () => {
        window.electron.ipcRenderer.removeAllListeners('settings:startupChanged');
      };
    }
  }, []);

  const updateStartupSetting = async (setting: Partial<StartupConfig>) => {
    setIsLoading(true);
    try {
      const result = await window.electron.ipcRenderer.invoke('startup:update-config', setting);
      
      if (result.success) {
        // Update local state
        if (setting.hasOwnProperty('startMinimized')) {
          setStartMinimizedState(setting.startMinimized!);
        }
        if (setting.hasOwnProperty('startWithWindows')) {
          setStartWithWindowsState(setting.startWithWindows!);
        }
        
        toast({
          title: "Success",
          description: result.message || "Startup settings updated",
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update startup settings",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update startup settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const setStartMinimized = (value: boolean) => {
    updateStartupSetting({ startMinimized: value });
  };

  const setStartWithWindows = (value: boolean) => {
    updateStartupSetting({ startWithWindows: value });
  };

  return {
    startMinimized,
    startWithWindows,
    isLoading,
    setStartMinimized,
    setStartWithWindows
  };
}
