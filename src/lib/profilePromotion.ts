
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
 * Promotes a community memory profile to user profiles directory
 */
export const promoteCommunityMemoryProfileToUser = async (fileName: string): Promise<boolean> => {
  try {
    // Load the community profile
    const communityProfile = await profileManager.getMemoryProfile(fileName, 'community');
    if (!communityProfile) {
      console.error(`Community memory profile not found: ${fileName}`);
      return false;
    }

    // Create user profile with correct type metadata
    const userProfile: MemoryProfile = {
      ...communityProfile,
      memoryProfileType: 'user' // Ensure the type is set to 'user'
    };

    // Save as user profile
    const success = await profileStorage.saveMemoryProfile(fileName, userProfile);
    if (success) {
      console.log(`Promoted community memory profile to user: ${fileName}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error promoting community memory profile ${fileName}:`, error);
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
 * Promotes a community message profile to user profiles directory
 */
export const promoteCommunityMessageProfileToUser = async (fileName: string): Promise<boolean> => {
  try {
    // Load the community profile
    const communityProfile = await profileManager.getMessageProfile(fileName, 'community');
    if (!communityProfile) {
      console.error(`Community message profile not found: ${fileName}`);
      return false;
    }

    // Create user profile with correct type metadata
    const userProfile: MessageProfile = {
      ...communityProfile,
      messageProfileType: 'user' // Ensure the type is set to 'user'
    };

    // Save as user profile
    const success = await profileStorage.saveMessageProfile(fileName, userProfile);
    if (success) {
      console.log(`Promoted community message profile to user: ${fileName}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error promoting community message profile ${fileName}:`, error);
    return false;
  }
};

/**
 * Promotes non-user profiles (default and community) to user profiles when Game Profile is edited
 */
export const promoteGameProfileNonUserProfilesToUser = async (gameProfile: GameProfile): Promise<{
  memoryPromoted: boolean;
  messagePromoted: boolean;
  updatedProfile: GameProfile;
}> => {
  let memoryPromoted = false;
  let messagePromoted = false;
  const updatedProfile = { ...gameProfile };

  // Promote memory profile if it's a default or community profile
  if (gameProfile.memoryFile && (gameProfile.memoryProfileType === 'default' || gameProfile.memoryProfileType === 'community')) {
    if (gameProfile.memoryProfileType === 'default') {
      memoryPromoted = await promoteDefaultMemoryProfileToUser(gameProfile.memoryFile);
    } else {
      memoryPromoted = await promoteCommunityMemoryProfileToUser(gameProfile.memoryFile);
    }
    
    if (memoryPromoted) {
      updatedProfile.memoryProfileType = 'user';
      console.log(`Memory profile promoted: ${gameProfile.memoryFile}`);
    }
  }

  // Promote message profile if it's a default or community profile
  if (gameProfile.messageFile && (gameProfile.messageProfileType === 'default' || gameProfile.messageProfileType === 'community')) {
    if (gameProfile.messageProfileType === 'default') {
      messagePromoted = await promoteDefaultMessageProfileToUser(gameProfile.messageFile);
    } else {
      messagePromoted = await promoteCommunityMessageProfileToUser(gameProfile.messageFile);
    }
    
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
 * Legacy function for backward compatibility - now calls the enhanced version
 */
export const promoteGameProfileDefaultsToUser = async (gameProfile: GameProfile): Promise<{
  memoryPromoted: boolean;
  messagePromoted: boolean;
  updatedProfile: GameProfile;
}> => {
  return promoteGameProfileNonUserProfilesToUser(gameProfile);
};

/**
 * Checks if a Game Profile uses any non-user profiles (default or community)
 */
export const gameProfileUsesNonUserProfiles = (gameProfile: GameProfile): boolean => {
  return (
    (gameProfile.memoryFile && (gameProfile.memoryProfileType === 'default' || gameProfile.memoryProfileType === 'community')) ||
    (gameProfile.messageFile && (gameProfile.messageProfileType === 'default' || gameProfile.messageProfileType === 'community'))
  );
};

/**
 * Legacy function for backward compatibility - now calls the enhanced version
 */
export const gameProfileUsesDefaultProfiles = (gameProfile: GameProfile): boolean => {
  return gameProfileUsesNonUserProfiles(gameProfile);
};
