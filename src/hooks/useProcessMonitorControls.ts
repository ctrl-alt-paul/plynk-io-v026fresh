
import { useState, useEffect } from 'react';
import { useMonitorControlsContext } from '@/contexts/MonitorControlsContext';
import { isElectron } from '@/utils/isElectron';

interface ProcessMonitorConfig {
  isRunning: boolean;
  scanInterval: number;
}

interface ProcessMonitorControls {
  isRunning: boolean;
  scanInterval: number;
  isLoading: boolean;
  toggleMonitor: () => Promise<void>;
  setScanInterval: (interval: number) => Promise<void>;
}

export function useProcessMonitorControls(): ProcessMonitorControls {
  const { isProcessMonitorRunning, setProcessMonitorRunning } = useMonitorControlsContext();
  const [scanInterval, setScanIntervalState] = useState(3000);
  const [isLoading, setIsLoading] = useState(false);

  // Load initial scan interval from persistent settings
  useEffect(() => {
    const loadConfig = async () => {
      if (!window.electron?.ipcRenderer) return;
      
      try {
        const result = await window.electron.ipcRenderer.invoke('process-monitor:get-config');
        if (result.success) {
          setScanIntervalState(result.scanInterval);
        }
      } catch (error) {
        console.error('Failed to load process monitor config:', error);
      }
    };

    loadConfig();
  }, []);

  // Listen for settings changes from other parts of the app
  useEffect(() => {
    if (isElectron() && window.electron?.ipcRenderer) {
      const handleSettingsChange = (event: any, data: any) => {
        console.log('Received process monitor settings change:', data);
        
        if (data.scanInterval !== undefined) {
          console.log('Updating scan interval to:', data.scanInterval);
          setScanIntervalState(data.scanInterval);
        }
        if (data.isRunning !== undefined) {
          console.log('Updating process monitor running state to:', data.isRunning);
          setProcessMonitorRunning(data.isRunning);
        }
      };

      // Listen for settings change broadcasts
      window.electron.ipcRenderer.on('settings:processMonitorChanged', handleSettingsChange);
      
      return () => {
        window.electron.ipcRenderer.removeAllListeners('settings:processMonitorChanged');
      };
    }
  }, [setProcessMonitorRunning]);

  const toggleMonitor = async () => {
    if (!window.electron?.ipcRenderer) return;
    
    setIsLoading(true);
    
    try {
      let result;
      if (isProcessMonitorRunning) {
        result = await window.electron.ipcRenderer.invoke('process-monitor:stop');
      } else {
        result = await window.electron.ipcRenderer.invoke('process-monitor:start');
      }
      
      if (result.success) {
        // Update the context state immediately for UI updates
        setProcessMonitorRunning(!isProcessMonitorRunning);
      } else {
        console.error('Failed to toggle process monitor:', result.error);
      }
    } catch (error) {
      console.error('Error toggling process monitor:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setScanInterval = async (interval: number) => {
    if (!window.electron?.ipcRenderer) return;
    
    try {
      const result = await window.electron.ipcRenderer.invoke('process-monitor:set-interval', interval);
      if (result.success) {
        setScanIntervalState(interval);
      } else {
        console.error('Failed to set scan interval:', result.error);
      }
    } catch (error) {
      console.error('Error setting scan interval:', error);
    }
  };

  return {
    isRunning: isProcessMonitorRunning,
    scanInterval,
    isLoading,
    toggleMonitor,
    setScanInterval,
  };
}
