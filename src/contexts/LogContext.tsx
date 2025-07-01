import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface LogEntry {
  id: string;
  timestamp: string;
  category: string;
  description: string;
  data?: any;
}

interface LogContextType {
  logs: LogEntry[];
  clearLogs: () => void;
  isLoggingEnabled: boolean;
  setLoggingEnabled: (enabled: boolean) => void;
  maxLogEntries: number;
  updateMaxLogEntries: (newMax: number) => Promise<boolean>;
}

const LogContext = createContext<LogContextType | undefined>(undefined);

export const useLogContext = () => {
  const context = useContext(LogContext);
  if (!context) {
    throw new Error('useLogContext must be used within a LogProvider');
  }
  return context;
};

interface LogProviderProps {
  children: ReactNode;
}

export const LogProvider: React.FC<LogProviderProps> = ({ children }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoggingEnabled, setIsLoggingEnabled] = useState(false);
  const [maxLogEntries, setMaxLogEntries] = useState(5000); // Changed from 20000 to 5000

  // Load master logging setting and max log entries on component mount
  useEffect(() => {
    const loadSettings = async () => {
      if (!window.electron?.getMasterLoggingConfig || !window.electron?.ipcRenderer) return;

      try {
        // Load master logging setting
        const loggingResult = await window.electron.getMasterLoggingConfig();
        if (loggingResult.success) {
          setIsLoggingEnabled(loggingResult.enabled);
        }

        // Load max log entries setting
        const logConfigResult = await window.electron.ipcRenderer.invoke('log-config:get-config');
        if (logConfigResult.success) {
          setMaxLogEntries(logConfigResult.maxLogEntries);
        }
      } catch (error) {
        console.error('Failed to load logging settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Function to update max log entries and apply it immediately to existing logs
  const updateMaxLogEntries = useCallback(async (newMax: number): Promise<boolean> => {
    if (!window.electron?.ipcRenderer) return false;

    try {
      const result = await window.electron.ipcRenderer.invoke('log-config:update-config', {
        maxLogEntries: newMax
      });
      
      if (result.success) {
        setMaxLogEntries(newMax);
        // Immediately trim existing logs to the new limit
        setLogs(prevLogs => prevLogs.slice(-newMax));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update log configuration:', error);
      return false;
    }
  }, []);

  // Listen for log events from backend - only when logging is enabled
  useEffect(() => {
    if (!window.electron || !isLoggingEnabled) return;

    const handleLogEvent = (event: any, logData: any) => {
      const newLog: LogEntry = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        category: logData.category || 'debug',
        description: logData.description || logData.message || String(logData),
        data: logData.data
      };

      setLogs(prevLogs => {
        const updatedLogs = [...prevLogs, newLog];
        // Use the current maxLogEntries value
        return updatedLogs.slice(-maxLogEntries);
      });
    };

    window.electron.ipcRenderer.on('log:event', handleLogEvent);

    return () => {
      window.electron.ipcRenderer.removeAllListeners('log:event');
    };
  }, [isLoggingEnabled, maxLogEntries]);

  const clearLogs = () => {
    setLogs([]);
  };

  const handleSetLoggingEnabled = async (enabled: boolean) => {
    setIsLoggingEnabled(enabled);
    
    // Save the setting to backend
    if (window.electron?.updateMasterLoggingConfig) {
      try {
        await window.electron.updateMasterLoggingConfig({ enabled });
      } catch (error) {
        console.error('Failed to save master logging setting:', error);
      }
    }
  };

  const value = {
    logs,
    clearLogs,
    isLoggingEnabled,
    setLoggingEnabled: handleSetLoggingEnabled,
    maxLogEntries,
    updateMaxLogEntries
  };

  return (
    <LogContext.Provider value={value}>
      {children}
    </LogContext.Provider>
  );
};
