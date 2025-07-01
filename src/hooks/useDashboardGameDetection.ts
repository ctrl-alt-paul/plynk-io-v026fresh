
import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { isElectron } from '@/utils/isElectron';

interface DetectedGameProfile {
  gameProfile: any;
  gameName: string;
}

export const useDashboardGameDetection = (
  isListening: boolean,
  onGameProfileDetected: (profile: DetectedGameProfile) => void,
  logEvent: (category: string, message: string) => void
) => {
  const [detectedProfile, setDetectedProfile] = useState<DetectedGameProfile | null>(null);
  const [isWaitingForMameStart, setIsWaitingForMameStart] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  const clearDetectedProfile = useCallback(() => {
    setDetectedProfile(null);
  }, []);

  const handleGameDetection = useCallback(async (data: any) => {
    if (!isListening) return;

    try {
      // Check for MAME_START message
      if (data.key === '__MAME_START__') {
        logEvent("game-detection", "MAME_START detected, waiting for game name...");
        setIsWaitingForMameStart(true);
        setIsDetecting(true);
        return;
      }

      // Check for GAME_NAME message when waiting
      if (isWaitingForMameStart && data.key === '__GAME_NAME__' && (data.label || data.text)) {
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
              const detectedProfile: DetectedGameProfile = {
                gameProfile,
                gameName
              };
              
              setDetectedProfile(detectedProfile);
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

              // SIMPLIFIED: Only set the game profile for message dispatch (no message profile needed)
              try {
                await window.electron.ipcRenderer.invoke('message:setActiveProfile', {
                  gameProfile: gameProfile
                });
                
                logEvent("game-detection", `Set active game profile for message dispatch: ${gameProfile.profileName}`);
              } catch (error) {
                logEvent("warning", `Error setting up message dispatch profile: ${error}`);
                // Don't fail the entire detection process for this
              }
              
              toast.success(`Game detected: ${gameName} (Profile: ${gameProfile.profileName})`);
              onGameProfileDetected(detectedProfile);
              return;
            }
          } catch (error) {
            logEvent("warning", `Error checking game profile ${profileName}: ${error}`);
            // Continue searching
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
  }, [isListening, isWaitingForMameStart, onGameProfileDetected, logEvent]);

  // Reset detection state when listener stops
  useEffect(() => {
    if (!isListening) {
      setIsWaitingForMameStart(false);
      setIsDetecting(false);
      setDetectedProfile(null);
      
      // Clear active profiles when listener stops
      if (isElectron() && window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.invoke('message:clearActiveProfile').catch(() => {
          // Ignore errors when clearing
        });
      }
    }
  }, [isListening]);

  return {
    detectedProfile,
    isDetecting,
    isWaitingForMameStart,
    handleGameDetection,
    clearDetectedProfile
  };
};
