
// src/hooks/useMessageListener.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { isElectron } from '@/utils/isElectron';
import { MessageProfileOutput } from '@/types/messageProfiles';

export const useMessageListener = (
  onMessageOutput: (data: any) => void,
  logEvent: (category: string, message: string) => void
) => {
  const [isListening, setIsListening] = useState(false);
  
  // Use ref to store the latest callback without causing re-renders
  const onMessageOutputRef = useRef(onMessageOutput);
  const logEventRef = useRef(logEvent);
  
  // Update refs when callbacks change
  useEffect(() => {
    onMessageOutputRef.current = onMessageOutput;
    logEventRef.current = logEvent;
  }, [onMessageOutput, logEvent]);

  // Create a stable IPC handler that doesn't change between renders
  const stableIpcHandler = useCallback((event: any, data: any) => {
    logEventRef.current("debug", `RAW IPC → ${JSON.stringify(data)}`);

    // 1) LABEL / TEXT packets
    if (
      data &&
      typeof data === "object" &&
      "key" in data &&
      ("label" in data || "text" in data)
    ) {
      const key = data.key as string;
      const name = ("label" in data ? data.label : data.text) as string;
      logEventRef.current("message-scan", `LABEL/TEXT: ${key} → ${name}`);
      onMessageOutputRef.current(data);
      return;
    }

    // 2) VALUE packets
    if (
      data &&
      typeof data === "object" &&
      "key" in data &&
      "value" in data
    ) {
      const key = data.key as string;
      const value = data.value as number | string;
      logEventRef.current("message-scan", `VALUE: ${key} = ${value}`);
      onMessageOutputRef.current(data);
      return;
    }

    // Anything else
    logEventRef.current("warning", `Malformed message output: ${JSON.stringify(data)}`);
  }, []); // Empty dependency array - this function never changes

  // Single consolidated effect for IPC listener management
  useEffect(() => {
    if (isElectron() && window.electron?.ipcRenderer) {
      if (isListening) {
        window.electron.ipcRenderer.on('message:outputDetected', stableIpcHandler);
        logEventRef.current("message-listen", "IPC listener attached");
      } else {
        window.electron.ipcRenderer.removeListener('message:outputDetected', stableIpcHandler);
        logEventRef.current("message-listen", "IPC listener removed");
      }

      // Cleanup function
      return () => {
        window.electron.ipcRenderer.removeListener('message:outputDetected', stableIpcHandler);
      };
    }
  }, [isListening]); // Only depend on isListening state

  // Separate unmount cleanup - stop Win32 listener when component unmounts
  useEffect(() => {
    return () => {
      if (isListening) {
        if (window.messageAPI && typeof (window.messageAPI as any).stopListener === 'function') {
          (window.messageAPI as any).stopListener();
          logEventRef.current("message-listen", "Win32 message listener stopped due to page navigation");
        }
      }
    };
  }, [isListening]);

  // Start the native listener and set active profiles
  const startListening = useCallback(async (gameProfile?: any, messageProfile?: any) => {
    if (window.messageAPI?.startListener) {
      window.messageAPI.startListener();
      logEventRef.current("message-listen", "Win32 message listener started successfully");
    } else {
      logEventRef.current("warning", "Win32 message listener not available - platform may not be supported");
    }

    // Set active profiles for message dispatching
    if (isElectron() && window.electron?.ipcRenderer && (gameProfile || messageProfile)) {
      try {
        const result = await window.electron.ipcRenderer.invoke('message:setActiveProfiles', {
          gameProfile,
          messageProfile
        });
        
        if (result?.success) {
          logEventRef.current("message-listen", "Active profiles set for message dispatching");
        } else {
          logEventRef.current("warning", `Failed to set active profiles: ${result?.error || "Unknown error"}`);
        }
      } catch (error) {
        logEventRef.current("warning", `Error setting active profiles: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    setIsListening(true);
    logEventRef.current("message-listen", "Started listening for message outputs");
  }, []);

  // Stop the native listener as well as turn off our flag
  const stopListening = useCallback(() => {
    // Check if messageAPI exists and has a method to stop listening
    if (window.messageAPI && typeof (window.messageAPI as any).stopListener === 'function') {
      (window.messageAPI as any).stopListener();
      logEventRef.current("message-listen", "Win32 message listener stopped successfully");
    } else {
      logEventRef.current("warning", "Win32 message listener stop not available");
    }
    setIsListening(false);
    logEventRef.current("message-listen", "Stopped listening for message outputs");
  }, []);

  return {
    isListening,
    startListening,
    stopListening
  };
};
