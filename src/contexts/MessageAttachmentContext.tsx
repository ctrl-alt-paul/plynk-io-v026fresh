import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useLogContext } from './LogContext';
import { useMonitorControlsContext } from './MonitorControlsContext';
import { useMessageSpeed } from '@/hooks/useMessageSpeed';
import { useMessageTimeout } from '@/hooks/useMessageTimeout';
import { useMessageTimeoutControls } from '@/hooks/useMessageTimeoutControls';
import { isElectron } from '@/utils/isElectron';
import { toast } from 'sonner';
import { MessageProfileOutput } from '@/types/messageProfiles';

interface DetectedGameProfile {
  gameProfile: any;
  gameName: string;
}

type MessageStatus = 'off' | 'listening' | 'active';

interface MessageAttachmentContextType {
  // Game detection state
  detectedProfile: DetectedGameProfile | null;
  isDetecting: boolean;
  isWaitingForMameStart: boolean;
  clearDetectedProfile: () => void;
  
  // Message outputs state
  messageOutputs: MessageProfileOutput[];
  clearOutputs: () => void;
  
  // Message status
  messageStatus: MessageStatus;
  isListening: boolean;
  
  // Message speed tracking
  messageSpeed: number;
  
  // Game profile active state
  isGameProfileActive: boolean;
  
  // Timeout countdown
  timeoutCountdown: number | null;
}

const MessageAttachmentContext = createContext<MessageAttachmentContextType | undefined>(undefined);

export const MessageAttachmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoggingEnabled } = useLogContext();
  const { isMessageListenerEnabled } = useMonitorControlsContext();
  const { messageSpeed, recordMessage, resetSpeed } = useMessageSpeed();
  
  // Get reactive timeout settings - these will update when changed in UI
  const { 
    timeout: messageTimeoutSeconds, 
    isTimeoutEnabled,
    isLoading: isTimeoutSettingsLoading 
  } = useMessageTimeoutControls();
  
  // Game detection state
  const [detectedProfile, setDetectedProfile] = useState<DetectedGameProfile | null>(null);
  const [isWaitingForMameStart, setIsWaitingForMameStart] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  
  // Message outputs state
  const [messageOutputs, setMessageOutputs] = useState<MessageProfileOutput[]>([]);
  
  // Message status
  const [isListening, setIsListening] = useState(false);

  // Timeout countdown state - managed internally
  const [timeoutCountdown, setTimeoutCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Computed property for game profile active state
  const isGameProfileActive = Boolean(detectedProfile);

  // Use refs to prevent stale closures
  const detectedProfileRef = useRef<DetectedGameProfile | null>(null);
  const isMessageListenerEnabledRef = useRef(false);
  const isWaitingForMameStartRef = useRef(false);

  // Update refs when state changes
  useEffect(() => {
    detectedProfileRef.current = detectedProfile;
  }, [detectedProfile]);

  useEffect(() => {
    isMessageListenerEnabledRef.current = isMessageListenerEnabled;
  }, [isMessageListenerEnabled]);

  useEffect(() => {
    isWaitingForMameStartRef.current = isWaitingForMameStart;
  }, [isWaitingForMameStart]);

  // Sync tray icon with game profile state
  useEffect(() => {
    if (isElectron() && window.electron?.ipcRenderer) {
      const iconPath = isGameProfileActive ? '/icon2.png' : '/icon.png';
      window.electron.ipcRenderer.invoke('tray:set-icon', iconPath).catch(() => {
        // Ignore errors when setting tray icon
      });
    }
  }, [isGameProfileActive]);
  
  const logEvent = useCallback((category: string, message: string) => {
    if (isLoggingEnabled) {
      console.log(`[${category}] ${message}`);
    }
  }, [isLoggingEnabled]);

  // Clear functions
  const clearDetectedProfile = useCallback(() => {
    setDetectedProfile(null);
    detectedProfileRef.current = null;
  }, []);

  const clearOutputs = useCallback(() => {
    setMessageOutputs([]);
  }, []);

  // Handle timeout when game closes
  const handleGameTimeout = useCallback(() => {
    if (detectedProfileRef.current) {
      const gameName = detectedProfileRef.current.gameName;
      
      // Clear detected profile and outputs
      setDetectedProfile(null);
      detectedProfileRef.current = null;
      setMessageOutputs([]);
      
      // Reset detection state
      setIsWaitingForMameStart(false);
      setIsDetecting(false);
      
      // Clear countdown
      setTimeoutCountdown(null);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      
      // Clear active profiles
      if (isElectron() && window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.invoke('message:clearActiveProfile').catch(() => {
          // Ignore errors when clearing
        });
      }
      
      // Reset message speed
      resetSpeed();
      
      // Show notification
      toast.info(`Game disconnected: ${gameName} (timeout after ${messageTimeoutSeconds}s)`);
    }
  }, [messageTimeoutSeconds, resetSpeed]);

  // Set up timeout detection - KEY FIX: Make this reactive to settings changes
  const { startTimeout, stopTimeout, recordMessage: recordTimeoutMessage, lastMessageTime } = useMessageTimeout({
    timeoutSeconds: messageTimeoutSeconds, // This will now update reactively
    onTimeout: handleGameTimeout,
    enabled: Boolean(detectedProfile) && isTimeoutEnabled // This will now update reactively
  });

  // Log timeout state changes for debugging - KEY FIX: Add reactive logging
  useEffect(() => {
    if (detectedProfile) {
      if (isTimeoutEnabled) {
        // Restart timeout with new settings
        startTimeout();
      } else {
        stopTimeout();
      }
    }
  }, [detectedProfile, isTimeoutEnabled, messageTimeoutSeconds, startTimeout, stopTimeout]);

  // Synchronize timeout timer with message speed - KEY FIX
  useEffect(() => {
    if (detectedProfile && messageSpeed > 0 && isTimeoutEnabled) {
      // When messages are being received and timeout is enabled, reset the timeout timer
      recordTimeoutMessage();
      // Hide countdown immediately when messages are active
      setTimeoutCountdown(null);
    }
  }, [messageSpeed, detectedProfile, isTimeoutEnabled, recordTimeoutMessage]);

  // Countdown management using lastMessageTime from useMessageTimeout hook
  useEffect(() => {
    // Only show countdown when game profile is active AND timeout is enabled
    if (!detectedProfile || !isTimeoutEnabled) {
      setTimeoutCountdown(null);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    const updateCountdown = () => {
      // Only show countdown when no messages are being received and timeout is enabled
      if (messageSpeed > 0) {
        setTimeoutCountdown(null);
        return;
      }

      const now = Date.now();
      const timeSinceLastMessage = (now - lastMessageTime) / 1000;
      const timeUntilTimeout = messageTimeoutSeconds - timeSinceLastMessage;

      if (timeUntilTimeout <= 10 && timeUntilTimeout > 0) {
        // Show countdown only in last 10 seconds when no messages are active and timeout is enabled
        setTimeoutCountdown(Math.ceil(timeUntilTimeout));
      } else {
        // Hide countdown if more than 10 seconds remaining or already timed out
        setTimeoutCountdown(null);
      }
    };

    // Clear existing interval
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    // Start new interval
    countdownIntervalRef.current = setInterval(updateCountdown, 1000);
    
    // Run immediately
    updateCountdown();

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [detectedProfile, isTimeoutEnabled, messageSpeed, messageTimeoutSeconds, lastMessageTime]);

  // Handle message outputs - use functional updates to avoid stale closures
  const handleMessageOutput = useCallback((data: any) => {
    // Record message for timeout detection only if timeout is enabled
    if (isTimeoutEnabled) {
      recordTimeoutMessage();
    }
    
    // Handle LABEL or TEXT packets: { key, label } or { key, text }
    if (
      data &&
      typeof data === "object" &&
      "key" in data &&
      ("label" in data || "text" in data)
    ) {
      const key = data.key as string;
      const name = (("label" in data ? data.label : data.text) as string);

      setMessageOutputs(prev => {
        const idx = prev.findIndex(o => o.key === key);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx].label = name;
          return copy;
        }
        return [...prev, { key, label: name, lastValue: 0, format: "", script: "" }];
      });
      return;
    }

    // Handle VALUE packets: { key, value }
    if (
      data &&
      typeof data === "object" &&
      "key" in data &&
      "value" in data
    ) {
      const key = data.key as string;
      const value = data.value as number | string;

      setMessageOutputs(prev => {
        const idx = prev.findIndex(o => o.key === key);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx].lastValue = value;
          return copy;
        }
        return [...prev, { key, label: key, lastValue: value, format: "", script: "" }];
      });
      return;
    }
  }, [isTimeoutEnabled, recordTimeoutMessage]);

  // Load game profile outputs - use functional updates
  const loadGameProfileOutputs = useCallback((gameProfile: any) => {
    if (gameProfile?.outputs) {
      const messageProfileOutputs = gameProfile.outputs
        .filter((output: any) => output.type === 'Message')
        .map((output: any) => ({
          key: output.key,
          label: output.label,
          lastValue: 0,
          format: output.format || "",
          script: output.script || ""
        }));
      setMessageOutputs(messageProfileOutputs);
    }
  }, []);

  // Handle game detection - use refs to avoid stale closures
  const handleGameDetection = useCallback(async (data: any) => {
    const currentIsMessageListenerEnabled = isMessageListenerEnabledRef.current;
    const currentIsWaitingForMameStart = isWaitingForMameStartRef.current;

    if (!currentIsMessageListenerEnabled) return;

    try {
      // Check for MAME_START message
      if (data.key === '__MAME_START__') {
        logEvent("game-detection", "MAME_START detected, waiting for game name...");
        setIsWaitingForMameStart(true);
        setIsDetecting(true);
        return;
      }

      // Check for GAME_NAME message when waiting
      if (currentIsWaitingForMameStart && data.key === '__GAME_NAME__' && (data.label || data.text)) {
        const gameName = data.label || data.text;
        logEvent("game-detection", `Game name detected: ${gameName}`);
        
        if (!window.electron?.getGameProfiles) {
          setIsWaitingForMameStart(false);
          setIsDetecting(false);
          return;
        }

        const gameProfilesList = await window.electron.getGameProfiles();
        if (!gameProfilesList?.length) {
          setIsWaitingForMameStart(false);
          setIsDetecting(false);
          return;
        }

        // Search for matching game profile
        for (const profileName of gameProfilesList) {
          try {
            const gameProfileResult = await window.electron.getGameProfile(profileName);
            if (!gameProfileResult.success || !gameProfileResult.profile) continue;

            const gameProfile = gameProfileResult.profile;
            
            // Skip inactive profiles
            if (gameProfile.isActive === false) continue;

            // Check if this game profile has a __GAME_NAME__ output matching the detected game
            const gameNameOutput = gameProfile.outputs?.find(
              (output: any) => output.key === '__GAME_NAME__' && output.label === gameName
            );
            
            if (gameNameOutput) {
              const detectedGameProfile: DetectedGameProfile = {
                gameProfile,
                gameName
              };
              
              setDetectedProfile(detectedGameProfile);
              detectedProfileRef.current = detectedGameProfile;
              setIsWaitingForMameStart(false);
              setIsDetecting(false);
              
              logEvent("game-detection", `Setting active profile in process monitor: ${gameProfile.profileName}`);
              
              // Set the game profile as active in the process monitor system
              if (isElectron() && window.electron?.ipcRenderer) {
                try {
                  const result = await window.electron.ipcRenderer.invoke('process-monitor:set-active-profile', {
                    profileName: gameProfile.profileName,
                    profile: gameProfile
                  });
                  
                  if (result.success) {
                    logEvent("game-detection", `Successfully set active profile: ${gameProfile.profileName}`);
                  } else {
                    logEvent("warning", `Failed to set active profile: ${result.error}`);
                  }
                } catch (error) {
                  logEvent("warning", `Error setting active profile: ${error}`);
                }
              }

              // Set the game profile for message dispatch
              try {
                await window.electron.ipcRenderer.invoke('message:setActiveProfile', {
                  gameProfile: gameProfile
                });
                
                logEvent("game-detection", `Set active game profile for message dispatch: ${gameProfile.profileName}`);
              } catch (error) {
                logEvent("warning", `Error setting up message dispatch profile: ${error}`);
              }
              
              toast.success(`Game detected: ${gameName} (Profile: ${gameProfile.profileName})`);
              loadGameProfileOutputs(gameProfile);
              return;
            }
          } catch (error) {
            logEvent("warning", `Error checking game profile ${profileName}: ${error}`);
          }
        }

        // No matching profile found
        toast.info(`Game detected: ${gameName}, but no matching profile found`);
        setIsWaitingForMameStart(false);
        setIsDetecting(false);
      }
    } catch (error) {
      logEvent("warning", `Error in game detection: ${error}`);
      setIsWaitingForMameStart(false);
      setIsDetecting(false);
    }
  }, [logEvent, loadGameProfileOutputs]);

  // Stable IPC message handler - use refs to avoid stale closures
  const handleMessageFromIPC = useCallback((event: any, data: any) => {
    const currentDetectedProfile = detectedProfileRef.current;
    
    logEvent("message-ipc", `Received IPC message: key=${data.key}, type=${data.label ? 'label' : data.text ? 'text' : 'value'}`);
    
    // Record message for speed tracking (exclude system messages)
    if (data.key !== '__MAME_START__' && data.key !== '__GAME_NAME__') {
      recordMessage();
    }
    
    // Handle game detection messages
    if (data.key === '__MAME_START__' || data.key === '__GAME_NAME__') {
      handleGameDetection(data);
      return;
    }

    // Handle regular message outputs (only if we have a detected profile)
    if (currentDetectedProfile) {
      // Check if this message key exists in the detected game profile outputs
      const isRelevantOutput = currentDetectedProfile.gameProfile?.outputs?.some(
        (output: any) => output.key === data.key
      );
      
      if (isRelevantOutput) {
        logEvent("message-ipc", `Processing relevant output for key: ${data.key}`);
        handleMessageOutput(data);
      } else {
        logEvent("message-ipc", `Ignoring irrelevant output for key: ${data.key}`);
      }
    } else {
      logEvent("message-ipc", `No detected profile, ignoring message for key: ${data.key}`);
    }
  }, [handleGameDetection, handleMessageOutput, logEvent, recordMessage]);

  // Start native message listener
  const startNativeListener = useCallback(() => {
    if (window.messageAPI?.startListener) {
      window.messageAPI.startListener();
      logEvent("message-listen", "Win32 message listener started successfully");
    } else {
      logEvent("warning", "Win32 message listener not available - platform may not be supported");
    }
    setIsListening(true);
    logEvent("message-listen", "Started listening for message outputs");
  }, [logEvent]);

  // Stop native message listener
  const stopNativeListener = useCallback(() => {
    if (window.messageAPI && typeof (window.messageAPI as any).stopListener === 'function') {
      (window.messageAPI as any).stopListener();
      logEvent("message-listen", "Win32 message listener stopped successfully");
    } else {
      logEvent("warning", "Win32 message listener stop not available");
    }
    setIsListening(false);
    resetSpeed(); // Reset message speed when stopping
    logEvent("message-listen", "Stopped listening for message outputs");
  }, [logEvent, resetSpeed]);

  // Set up IPC listener (STABLE - only register once)
  useEffect(() => {
    if (isElectron() && window.electron?.ipcRenderer) {
      logEvent("message-ipc", "Registering IPC listener for message:outputDetected");
      window.electron.ipcRenderer.on('message:outputDetected', handleMessageFromIPC);
      
      return () => {
        logEvent("message-ipc", "Unregistering IPC listener for message:outputDetected");
        window.electron.ipcRenderer.removeAllListeners('message:outputDetected');
      };
    }
  }, []); // Empty dependency array - register once and keep stable

  // Start/stop native listener based on enabled state
  useEffect(() => {
    if (isMessageListenerEnabled && !isListening) {
      logEvent("message-listen", "Starting native listener (enabled and not listening)");
      startNativeListener();
    } else if (!isMessageListenerEnabled && isListening) {
      logEvent("message-listen", "Stopping native listener (disabled but listening)");
      stopNativeListener();
      clearOutputs();
      clearDetectedProfile();
      setIsWaitingForMameStart(false);
      setIsDetecting(false);
      
      // Clear active profiles when listener stops
      if (isElectron() && window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.invoke('message:clearActiveProfile').catch(() => {
          // Ignore errors when clearing
        });
      }
    }
  }, [isMessageListenerEnabled, isListening, startNativeListener, stopNativeListener, clearOutputs, clearDetectedProfile, logEvent]);

  // Reset detection state when listener stops
  useEffect(() => {
    if (!isListening) {
      setIsWaitingForMameStart(false);
      setIsDetecting(false);
    }
  }, [isListening]);

  // Calculate message status
  const messageStatus: MessageStatus = !isMessageListenerEnabled 
    ? 'off' 
    : detectedProfile 
    ? 'active' 
    : 'listening';

  const value: MessageAttachmentContextType = {
    detectedProfile,
    isDetecting,
    isWaitingForMameStart,
    clearDetectedProfile,
    messageOutputs,
    clearOutputs,
    messageStatus,
    isListening,
    messageSpeed,
    isGameProfileActive,
    timeoutCountdown
  };

  return (
    <MessageAttachmentContext.Provider value={value}>
      {children}
    </MessageAttachmentContext.Provider>
  );
};

export const useMessageAttachment = () => {
  const context = useContext(MessageAttachmentContext);
  if (context === undefined) {
    throw new Error('useMessageAttachment must be used within a MessageAttachmentProvider');
  }
  return context;
};
