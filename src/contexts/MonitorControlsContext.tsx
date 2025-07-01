
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface MonitorControlsState {
  isProcessMonitorRunning: boolean;
  isMessageListenerEnabled: boolean;
  setProcessMonitorRunning: (running: boolean) => void;
  setMessageListenerEnabled: (enabled: boolean) => void;
}

const MonitorControlsContext = createContext<MonitorControlsState | undefined>(undefined);

interface MonitorControlsProviderProps {
  children: ReactNode;
}

export function MonitorControlsProvider({ children }: MonitorControlsProviderProps) {
  const [isProcessMonitorRunning, setProcessMonitorRunning] = useState(false);
  const [isMessageListenerEnabled, setMessageListenerEnabled] = useState(false);

  // Load initial states when the component mounts
  useEffect(() => {
    const loadInitialStates = async () => {
      if (!window.electron?.ipcRenderer) return;
      
      try {
        // Load process monitor state
        const processResult = await window.electron.ipcRenderer.invoke('process-monitor:get-config');
        if (processResult.success) {
          setProcessMonitorRunning(processResult.isRunning);
        }

        // Load message listener state
        const messageResult = await window.electron.ipcRenderer.invoke('message-listener:get-config');
        if (messageResult.success) {
          setMessageListenerEnabled(messageResult.isEnabled);
        }
      } catch (error) {
        console.error('Failed to load initial monitor states:', error);
      }
    };

    loadInitialStates();
  }, []);

  const contextValue: MonitorControlsState = {
    isProcessMonitorRunning,
    isMessageListenerEnabled,
    setProcessMonitorRunning,
    setMessageListenerEnabled,
  };

  return (
    <MonitorControlsContext.Provider value={contextValue}>
      {children}
    </MonitorControlsContext.Provider>
  );
}

export function useMonitorControlsContext(): MonitorControlsState {
  const context = useContext(MonitorControlsContext);
  if (!context) {
    throw new Error('useMonitorControlsContext must be used within a MonitorControlsProvider');
  }
  return context;
}
