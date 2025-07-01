
import { useState, useCallback, useEffect } from 'react';
import { isElectron } from '@/utils/isElectron';

interface MessageCoordinatorProps {
  isEnabled: boolean;
  onGameDetection: (data: any) => void;
  onDashboardOutput: (data: any) => void;
  logEvent: (category: string, message: string) => void;
  detectedProfile?: any;
}

export const useMessageCoordinator = ({
  isEnabled,
  onGameDetection,
  onDashboardOutput,
  logEvent,
  detectedProfile
}: MessageCoordinatorProps) => {
  const [isListening, setIsListening] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<any>(null);

  // Centralized message handler that routes messages to appropriate handlers
  const handleMessageOutput = useCallback((event: any, data: any) => {
    // Only log essential messages to reduce spam
    if (data.key === '__MAME_START__' || data.key === '__GAME_NAME__') {
      logEvent("message-scan", `System message: ${data.key} = ${data.label || data.text || data.value}`);
      // Route to game detection handler
      onGameDetection(data);
      return;
    }

    // For value updates, only process if we have a detected profile and the message is relevant
    if (data.key && 'value' in data && detectedProfile) {
      // Check if this key exists in the current profile outputs
      const isRelevantOutput = detectedProfile.gameProfile?.outputs?.some(
        (output: any) => output.key === data.key || output.label === data.key
      );
      
      if (isRelevantOutput) {
        // Route to dashboard handler (no logging to reduce spam)
        onDashboardOutput(data);
      }
      return;
    }

    // For label/text updates, route to dashboard handler
    if (data.key && ('label' in data || 'text' in data)) {
      onDashboardOutput(data);
      return;
    }
  }, [onGameDetection, onDashboardOutput, detectedProfile]); // REMOVED logEvent dependency to prevent loops

  // Set up IPC listener
  useEffect(() => {
    if (isElectron() && window.electron?.ipcRenderer) {
      const cleanup = () => {
        window.electron.ipcRenderer.removeAllListeners('message:outputDetected');
      };

      if (isListening) {
        window.electron.ipcRenderer.on('message:outputDetected', handleMessageOutput);
        // Only log once when actually setting up the listener, not from the effect
        console.log("[message-coordinator] IPC listener attached");
      } else {
        cleanup();
      }

      return cleanup;
    }
  }, [isListening, handleMessageOutput]); // REMOVED logEvent dependency to prevent loops

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (isElectron() && window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.removeAllListeners('message:outputDetected');
      }
    };
  }, []);

  // Start the native listener - stable function that doesn't recreate unnecessarily
  const startListening = useCallback(async () => {
    // Use functional update to get current state without dependency
    setIsListening(prevIsListening => {
      // Guard: don't start if already listening
      if (prevIsListening) {
        logEvent("message-coordinator", "Listener already active, skipping start");
        return prevIsListening;
      }

      if (window.messageAPI?.startListener) {
        window.messageAPI.startListener();
        logEvent("message-coordinator", "Win32 message listener started");
      }

      return true;
    });
  }, [logEvent]);

  // Stop the native listener
  const stopListening = useCallback(() => {
    // Use functional update to get current state without dependency
    setIsListening(prevIsListening => {
      // Guard: don't stop if not listening
      if (!prevIsListening) {
        logEvent("message-coordinator", "Listener already stopped, skipping stop");
        return prevIsListening;
      }

      if (window.messageAPI && typeof (window.messageAPI as any).stopListener === 'function') {
        (window.messageAPI as any).stopListener();
        logEvent("message-coordinator", "Win32 message listener stopped");
      }
      
      return false;
    });
  }, [logEvent]);

  // Separate function to update active profiles without restarting listener
  const updateActiveProfiles = useCallback(async (gameProfile?: any, messageProfile?: any) => {
    if (isElectron() && window.electron?.ipcRenderer && (gameProfile || messageProfile)) {
      try {
        logEvent("message-coordinator", "Updating active profiles for message dispatching...");
        const result = await window.electron.ipcRenderer.invoke('message:setActiveProfiles', {
          gameProfile,
          messageProfile
        });
        
        if (result?.success) {
          logEvent("message-coordinator", "Active profiles updated successfully for message dispatching");
        } else {
          logEvent("warning", `Failed to update active profiles: ${result?.error || 'Unknown error'}`);
        }
      } catch (error) {
        logEvent("warning", `Error updating active profiles: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }, [logEvent]);

  // MAIN EFFECT: Start/stop listening based on enabled state ONLY
  // CRITICAL FIX: Remove logEvent from dependencies to prevent infinite loop
  useEffect(() => {
    if (isEnabled && !isListening) {
      // Don't use the callback - just inline the logic to avoid dependency issues
      if (window.messageAPI?.startListener) {
        window.messageAPI.startListener();
        logEvent("message-coordinator", "Win32 message listener started");
      }
      setIsListening(true);
    } else if (!isEnabled && isListening) {
      // Don't use the callback - just inline the logic to avoid dependency issues
      if (window.messageAPI && typeof (window.messageAPI as any).stopListener === 'function') {
        (window.messageAPI as any).stopListener();
        logEvent("message-coordinator", "Win32 message listener stopped");
      }
      setIsListening(false);
    }
  }, [isEnabled, isListening]); // REMOVED logEvent from dependencies - this was causing the infinite loop!

  // SEPARATE EFFECT: Update active profiles when detected profile changes (but don't restart listener)
  useEffect(() => {
    // Only update if we have a new profile and listener is active
    if (detectedProfile && isListening && detectedProfile !== currentProfile) {
      logEvent("message-coordinator", `Profile changed, updating active profiles: ${detectedProfile.gameProfile?.profileName}`);
      updateActiveProfiles(detectedProfile.gameProfile, detectedProfile.messageProfile);
      setCurrentProfile(detectedProfile);
    }
  }, [detectedProfile, isListening, currentProfile, updateActiveProfiles, logEvent]);

  return {
    isListening,
    startListening,
    stopListening
  };
};
