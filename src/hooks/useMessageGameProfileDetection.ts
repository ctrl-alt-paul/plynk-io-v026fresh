
import { useState, useEffect, useCallback } from 'react';
import { useMessageListener } from './useMessageListener';
import { messageProfiles } from '@/lib/messageProfiles';
import { toast } from 'sonner';

interface DetectedGameProfile {
  gameProfile: any;
  messageProfile: any;
  gameName: string;
}

export function useMessageGameProfileDetection(
  isEnabled: boolean,
  logEvent: (category: string, message: string) => void
) {
  const [detectedProfile, setDetectedProfile] = useState<DetectedGameProfile | null>(null);
  const [isWaitingForMameStart, setIsWaitingForMameStart] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  // Handle message output from the listener
  const handleMessageOutput = useCallback(async (data: any) => {
    try {
      logEvent("debug", `Received message: ${JSON.stringify(data)}`);

      // Check for MAME_START message
      if (data.key === '__MAME_START__') {
        logEvent("message-detection", "MAME_START detected, waiting for game name...");
        setIsWaitingForMameStart(true);
        setIsDetecting(true);
        return;
      }

      // Check for GAME_NAME message when we're waiting
      if (isWaitingForMameStart && data.key === '__GAME_NAME__' && (data.label || data.text)) {
        const gameName = data.label || data.text;
        logEvent("message-detection", `Game name detected: ${gameName}`);
        
        // Search for matching game profile
        try {
          if (!window.electron?.getGameProfiles) {
            logEvent("warning", "Game profile API not available");
            setIsWaitingForMameStart(false);
            setIsDetecting(false);
            return;
          }

          const gameProfilesList = await window.electron.getGameProfiles();
          if (!gameProfilesList || gameProfilesList.length === 0) {
            logEvent("warning", "No game profiles found");
            setIsWaitingForMameStart(false);
            setIsDetecting(false);
            return;
          }

          logEvent("message-detection", `Searching through ${gameProfilesList.length} game profiles...`);

          // Find game profile with matching message profile that contains this game name
          for (const profileName of gameProfilesList) {
            try {
              logEvent("debug", `Checking game profile: ${profileName}`);
              const gameProfileResult = await window.electron.getGameProfile(profileName);
              if (!gameProfileResult.success || !gameProfileResult.profile) {
                logEvent("debug", `Failed to load game profile ${profileName}`);
                continue;
              }

              const gameProfile = gameProfileResult.profile;
              if (!gameProfile.messageFile) {
                logEvent("debug", `Game profile ${profileName} has no message file`);
                continue;
              }

              try {
                const messageProfileName = gameProfile.messageFile.replace('.json', '');
                logEvent("debug", `Loading message profile: ${messageProfileName}`);
                const messageProfile = await messageProfiles.loadMessageProfile(messageProfileName);
                
                if (messageProfile && messageProfile.outputs) {
                  logEvent("debug", `Message profile loaded with ${messageProfile.outputs.length} outputs`);
                  
                  // Look for __GAME_NAME__ output with matching label
                  const gameNameOutput = messageProfile.outputs.find(
                    output => output.key === '__GAME_NAME__' && output.label === gameName
                  );
                  
                  if (gameNameOutput) {
                    logEvent("message-detection", `Found matching game profile: ${gameProfile.profileName}`);
                    
                    const detectedProfile: DetectedGameProfile = {
                      gameProfile,
                      messageProfile,
                      gameName
                    };
                    
                    setDetectedProfile(detectedProfile);
                    toast.success(`Auto-detected game: ${gameName} (Profile: ${gameProfile.profileName})`);
                    setIsWaitingForMameStart(false);
                    setIsDetecting(false);
                    
                    // Dispatch custom event for dashboard data hook
                    const event = new CustomEvent('gameProfileDetected', { 
                      detail: detectedProfile 
                    });
                    window.dispatchEvent(event);
                    
                    return;
                  } else {
                    logEvent("debug", `No matching __GAME_NAME__ output found in ${messageProfileName}`);
                  }
                } else {
                  logEvent("debug", `Message profile ${messageProfileName} has no outputs`);
                }
              } catch (error) {
                logEvent("warning", `Failed to load message profile for ${gameProfile.profileName}: ${error}`);
              }
            } catch (error) {
              logEvent("warning", `Failed to load game profile ${profileName}: ${error}`);
            }
          }

          // No matching profile found
          logEvent("message-detection", `No matching game profile found for: ${gameName}`);
          toast.info(`Game detected: ${gameName}, but no matching profile found`);
          setIsWaitingForMameStart(false);
          setIsDetecting(false);
        } catch (error) {
          logEvent("warning", `Error searching for game profiles: ${error}`);
          setIsWaitingForMameStart(false);
          setIsDetecting(false);
        }
      } else if (isWaitingForMameStart) {
        // Log any other messages we receive while waiting
        logEvent("debug", `Received message while waiting for game name: key=${data.key}, label=${data.label}, text=${data.text}`);
      }
    } catch (error) {
      logEvent("warning", `Error in message game profile detection: ${error}`);
      setIsWaitingForMameStart(false);
      setIsDetecting(false);
    }
  }, [isWaitingForMameStart, logEvent]);

  // Use the message listener
  const { isListening, startListening, stopListening } = useMessageListener(
    handleMessageOutput,
    logEvent
  );

  // Start/stop listening based on enabled state
  useEffect(() => {
    if (isEnabled && !isListening) {
      startListening();
      logEvent("message-detection", "Started message-based game profile detection");
    } else if (!isEnabled && isListening) {
      stopListening();
      setDetectedProfile(null);
      setIsWaitingForMameStart(false);
      setIsDetecting(false);
      logEvent("message-detection", "Stopped message-based game profile detection");
    }
  }, [isEnabled, isListening, startListening, stopListening, logEvent]);

  // Reset detection state when listener stops
  useEffect(() => {
    if (!isListening) {
      setIsWaitingForMameStart(false);
      setIsDetecting(false);
    }
  }, [isListening]);

  return {
    isListening,
    detectedProfile,
    isDetecting,
    isWaitingForMameStart,
    clearDetectedProfile: () => setDetectedProfile(null)
  };
}
