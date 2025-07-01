
import { profileManager } from "./profileManager";
import { profileStorage } from "./profileStorage";
import { MemoryProfile } from "@/types/memoryProfiles";
import { MessageProfile } from "@/types/messageProfiles";
import { GameProfile } from "@/types/profiles";
import { toast } from "sonner";

/**
 * Promotes a default memory profile to user profiles directory
 */
export const promoteDefaultMemoryProfileToUser = async (fileName: string): Promise<boolean> => {
  try {
    // Load the default profile
    const defaultProfile = await profileManager.getMemoryProfile(fileName, 'default');
    if (!defaultProfile) {
      console.error(`Default memory profile not found: ${fileName}`);
      return false;
    }

    // Create user profile with correct type metadata
    const userProfile: MemoryProfile = {
      ...defaultProfile,
      memoryProfileType: 'user' // Ensure the type is set to 'user'
    };

    // Save as user profile
    const success = await profileStorage.saveMemoryProfile(fileName, userProfile);
    if (success) {
      console.log(`Promoted default memory profile to user: ${fileName}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error promoting memory profile ${fileName}:`, error);
    return false;
  }
};

/**
 * Promotes a default message profile to user profiles directory
 */
export const promoteDefaultMessageProfileToUser = async (fileName: string): Promise<boolean> => {
  try {
    // Load the default profile
    const defaultProfile = await profileManager.getMessageProfile(fileName, 'default');
    if (!defaultProfile) {
      console.error(`Default message profile not found: ${fileName}`);
      return false;
    }

    // Create user profile with correct type metadata
    const userProfile: MessageProfile = {
      ...defaultProfile,
      messageProfileType: 'user' // Ensure the type is set to 'user'
    };

    // Save as user profile
    const success = await profileStorage.saveMessageProfile(fileName, userProfile);
    if (success) {
      console.log(`Promoted default message profile to user: ${fileName}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error promoting message profile ${fileName}:`, error);
    return false;
  }
};

/**
 * Promotes default profiles to user profiles when Game Profile is edited
 */
export const promoteGameProfileDefaultsToUser = async (gameProfile: GameProfile): Promise<{
  memoryPromoted: boolean;
  messagePromoted: boolean;
  updatedProfile: GameProfile;
}> => {
  let memoryPromoted = false;
  let messagePromoted = false;
  const updatedProfile = { ...gameProfile };

  // Promote memory profile if it's a default
  if (gameProfile.memoryFile && gameProfile.memoryProfileType === 'default') {
    memoryPromoted = await promoteDefaultMemoryProfileToUser(gameProfile.memoryFile);
    if (memoryPromoted) {
      updatedProfile.memoryProfileType = 'user';
      console.log(`Memory profile promoted: ${gameProfile.memoryFile}`);
    }
  }

  // Promote message profile if it's a default
  if (gameProfile.messageFile && gameProfile.messageProfileType === 'default') {
    messagePromoted = await promoteDefaultMessageProfileToUser(gameProfile.messageFile);
    if (messagePromoted) {
      updatedProfile.messageProfileType = 'user';
      console.log(`Message profile promoted: ${gameProfile.messageFile}`);
    }
  }

  return {
    memoryPromoted,
    messagePromoted,
    updatedProfile
  };
};

/**
 * Checks if a Game Profile uses any default profiles
 */
export const gameProfileUsesDefaultProfiles = (gameProfile: GameProfile): boolean => {
  return (
    (gameProfile.memoryFile && gameProfile.memoryProfileType === 'default') ||
    (gameProfile.messageFile && gameProfile.messageProfileType === 'default')
  );
};
