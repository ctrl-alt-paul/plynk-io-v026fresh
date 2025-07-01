
import { useState, useEffect, useCallback } from 'react';
import { isElectron } from '@/utils/isElectron';

interface OutputOptimizationConfig {
  sendOnlyChangedValues: boolean;
  forceUpdateInterval: number;
}

export function useOutputOptimizationControls() {
  const [config, setConfig] = useState<OutputOptimizationConfig>({
    sendOnlyChangedValues: false,
    forceUpdateInterval: 200
  });
  const [isLoading, setIsLoading] = useState(false);

  // Load initial configuration
  useEffect(() => {
    const loadConfig = async () => {
      if (!isElectron() || !window.electron?.ipcRenderer) return;
      
      try {
        setIsLoading(true);
        const result = await window.electron.ipcRenderer.invoke('output-optimization:get-config');
        setConfig(result);
      } catch (error) {
        console.error('Failed to load output optimization config:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  // Listen for settings changes from other parts of the app
  useEffect(() => {
    if (isElectron() && window.electron?.ipcRenderer) {
      const handleSettingsChange = (event: any, data: any) => {
        console.log('Received output optimization settings change:', data);
        
        // Update the entire config with the new data
        setConfig(prevConfig => ({
          ...prevConfig,
          ...data
        }));
      };

      // Listen for settings change broadcasts
      window.electron.ipcRenderer.on('settings:outputOptimizationChanged', handleSettingsChange);
      
      return () => {
        window.electron.ipcRenderer.removeAllListeners('settings:outputOptimizationChanged');
      };
    }
  }, []);

  // Update configuration
  const updateConfig = useCallback(async (updates: Partial<OutputOptimizationConfig>) => {
    if (!isElectron() || !window.electron?.ipcRenderer) return;
    
    try {
      setIsLoading(true);
      const newConfig = { ...config, ...updates };
      await window.electron.ipcRenderer.invoke('output-optimization:update-config', newConfig);
      setConfig(newConfig);
    } catch (error) {
      console.error('Failed to update output optimization config:', error);
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  const setSendOnlyChangedValues = useCallback((enabled: boolean) => {
    updateConfig({ sendOnlyChangedValues: enabled });
  }, [updateConfig]);

  const setForceUpdateInterval = useCallback((interval: number) => {
    updateConfig({ forceUpdateInterval: interval });
  }, [updateConfig]);

  return {
    sendOnlyChangedValues: config.sendOnlyChangedValues,
    forceUpdateInterval: config.forceUpdateInterval,
    isLoading,
    setSendOnlyChangedValues,
    setForceUpdateInterval
  };
}
