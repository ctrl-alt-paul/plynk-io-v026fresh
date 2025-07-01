import { GameProfile, GameProfileOutput } from "../types/profiles";
import { MemoryProfile, MemoryProfileOutput } from "../types/memoryProfiles";
import { MessageProfile } from "../types/messageProfiles";
import { profileStorage } from "./profileStorage";
import { toast } from "sonner";

/**
 * Saves a game profile to disk using Electron API with selective updates
 * Only updates the properties that have changed, preserving all other data
 * @param gameProfile The game profile to save
 * @param originalFileName The original filename to preserve
 * @returns Promise resolving to success status
 */
const saveGameProfileToDisk = async (gameProfile: GameProfile, originalFileName?: string): Promise<boolean> => {
  if (!window.electron?.saveGameProfile) {
    //console.warn("Electron saveGameProfile API not available");
    return false;
  }

  try {
    // Use original filename if provided, otherwise create from profile ID
    const filename = originalFileName || `${gameProfile.id}.json`;
    
    // Load the existing profile to preserve all existing properties
    let existingProfile: any = null;
    try {
      const response = await window.electron.getGameProfile(filename);
      if (response && response.success && response.profile) {
        existingProfile = response.profile;
        //console.log(`Loaded existing profile for selective update: ${filename}`);
      }
    } catch (error) {
      //console.log(`No existing profile found for ${filename}, creating new one`);
    }
    
    let profileToSave: any;
    
    if (existingProfile) {
      // Merge with existing profile, preserving all properties except those being updated
      profileToSave = {
        ...existingProfile, // Keep all existing properties
        // Only update these specific fields from the new profile
        processName: gameProfile.processName,
        profileName: gameProfile.profileName,
        memoryFile: gameProfile.memoryFile,
        messageFile: gameProfile.messageFile,
        pollInterval: gameProfile.pollInterval,
        lastModified: gameProfile.lastModified,
        lastSyncedWithMemory: gameProfile.lastSyncedWithMemory,
        lastSyncedWithMessage: gameProfile.lastSyncedWithMessage,
        isActive: gameProfile.isActive,
        // For outputs, merge selectively to preserve game-specific settings
        outputs: gameProfile.outputs.map(newOutput => {
          // Find matching existing output by label
          const existingOutput = existingProfile.outputs?.find((existing: any) => existing.label === newOutput.label);
          
          if (existingOutput) {
            // Merge new memory-related properties with existing game-specific properties
            return {
              ...existingOutput, // Keep all existing properties (device, channel, notes, etc.)
              // Update only memory-related properties
              type: newOutput.type,
              address: newOutput.address,
              key: newOutput.key,
              useModuleOffset: newOutput.useModuleOffset,
              moduleName: newOutput.moduleName,
              offset: newOutput.offset,
              offsets: newOutput.offsets,
              bitmask: newOutput.bitmask,
              bitwiseOp: newOutput.bitwiseOp,
              bitfield: newOutput.bitfield,
              isPointerChain: newOutput.isPointerChain,
              invert: newOutput.invert,
              format: newOutput.format,
              script: newOutput.script,
              lastSyncedWithMemory: newOutput.lastSyncedWithMemory,
              lastSyncedWithMessage: newOutput.lastSyncedWithMessage
            };
          } else {
            // New output, use defaults for game-specific properties
            return {
              ...newOutput,
              device: newOutput.device || "",
              channel: newOutput.channel || 0,
              notes: newOutput.notes || "",
              targetDevice: newOutput.targetDevice || ""
            };
          }
        })
      };
    } else {
      // No existing profile, create new one with proper structure
      profileToSave = {
        processName: gameProfile.processName,
        profileName: gameProfile.profileName,
        memoryFile: gameProfile.memoryFile,
        messageFile: gameProfile.messageFile,
        pollInterval: gameProfile.pollInterval,
        outputs: gameProfile.outputs.map(output => ({
          label: output.label,
          type: output.type,
          address: output.address,
          key: output.key,
          notes: output.notes || "",
          device: output.device || "",
          channel: output.channel || 0,
          invert: output.invert,
          format: output.format,
          script: output.script || "",
          moduleName: output.moduleName,
          useModuleOffset: output.useModuleOffset,
          offsets: output.offsets,
          lastSyncedWithMemory: output.lastSyncedWithMemory,
          lastSyncedWithMessage: output.lastSyncedWithMessage,
          bitmask: output.bitmask,
          bitwiseOp: output.bitwiseOp,
          bitfield: output.bitfield,
          isPointerChain: output.isPointerChain,
          targetDevice: output.targetDevice || ""
        })),
        isActive: gameProfile.isActive,
        lastModified: gameProfile.lastModified,
        lastSyncedWithMemory: gameProfile.lastSyncedWithMemory,
        lastSyncedWithMessage: gameProfile.lastSyncedWithMessage
      };
    }
    
    //console.log(`Saving game profile to disk with selective updates: ${filename}`);
    const result = await window.electron.saveGameProfile(filename, profileToSave);
    
    if (!result.success) {
      //console.error(`Failed to save game profile to disk: ${result.error}`);
      return false;
    }
    
    //console.log(`Game profile ${filename} saved to disk successfully with selective updates`);
    return true;
  } catch (error) {
    //console.error("Error saving game profile to disk:", error);
    return false;
  }
};

/**
 * Loads all game profiles from the file system with their original filenames
 * @returns Promise resolving to array of game profiles with filename metadata
 */
const loadGameProfilesFromFileSystem = async (): Promise<{ profile: GameProfile; fileName: string }[]> => {
  try {
    //console.log("Loading game profiles from file system...");
    
    // Get list of game profile files
    const profileNames = await profileStorage.listGameProfiles();
    //console.log(`Found ${profileNames.length} game profile files:`, profileNames);
    
    const gameProfiles: { profile: GameProfile; fileName: string }[] = [];
    
    // Load each profile
    for (const profileName of profileNames) {
      try {
        // Skip invalid filenames
        if (!profileName || profileName === 'undefined.json') {
          //console.warn(`Skipping invalid profile name: ${profileName}`);
          continue;
        }
        
        // Extract ID from filename (remove .json extension if present)
        const profileId = profileName.replace('.json', '');
        //console.log(`Loading game profile: ${profileId} from file: ${profileName}`);
        
        const profile = await profileStorage.getGameProfile(profileId);
        if (profile) {
          //console.log(`Successfully loaded game profile: ${profile.profileName}, memoryFile: ${profile.memoryFile}`);
          gameProfiles.push({ profile, fileName: profileName });
        } else {
          //console.warn(`Failed to load game profile: ${profileId}`);
        }
      } catch (error) {
        //console.error(`Error loading game profile ${profileName}:`, error);
      }
    }
    
    //console.log(`Successfully loaded ${gameProfiles.length} game profiles from file system`);
    return gameProfiles;
  } catch (error) {
    //console.error("Error loading game profiles from file system:", error);
    return [];
  }
};

/**
 * Updates game profiles when a memory profile has been changed
 * Only updates core memory properties and formatting/display properties for memory-based outputs
 * Preserves game-specific output settings (device, channel, notes, etc.)
 * Preserves all message-based outputs (those with key field) during memory profile sync
 * Removes only memory-based outputs that no longer exist in the memory profile
 * Updates the game profile's processName to match the memory profile's process
 * @param memoryProfile The updated memory profile
 * @returns The number of game profiles that were updated
 */
export const syncGameProfilesToMemoryProfile = async (memoryProfile: MemoryProfile): Promise<number> => {
  try {
    //console.log(`🔄 Starting sync of game profiles to memory profile: ${memoryProfile.fileName}`);
    
    // Load all game profiles from file system with their original filenames
    const gameProfilesWithFilenames = await loadGameProfilesFromFileSystem();
    //console.log(`📋 Loaded ${gameProfilesWithFilenames.length} game profiles from file system`);
    
    // Find all game profiles that use this memory profile
    const affectedProfilesWithFilenames = gameProfilesWithFilenames.filter(
      ({ profile }) => profile.memoryFile === memoryProfile.fileName
    );
    
    //console.log(`🎯 Found ${affectedProfilesWithFilenames.length} game profiles using memory profile ${memoryProfile.fileName}`);
    affectedProfilesWithFilenames.forEach(({ profile, fileName }) => {
      //console.log(`   - ${profile.profileName} (ID: ${profile.id}, File: ${fileName})`);
    });
    
    if (affectedProfilesWithFilenames.length === 0) {
      //console.log("❌ No game profiles to update");
      return 0; // No profiles to update
    }
    
    // Create a set of memory profile output labels for quick lookup
    const memoryOutputLabels = new Set(memoryProfile.outputs.map(output => output.label));
    
    // For each affected game profile, update only memory-related properties
    const updatedGameProfilesWithFilenames = gameProfilesWithFilenames.map(({ profile: gameProfile, fileName }) => {
      // If this profile doesn't use the memory profile, return it unchanged
      if (gameProfile.memoryFile !== memoryProfile.fileName) {
        return { profile: gameProfile, fileName };
      }
      
      //console.log(`🔧 Updating game profile: ${gameProfile.profileName} (File: ${fileName})`);
      
      // Update processName to match memory profile's process
      const processChanged = gameProfile.processName !== memoryProfile.process;
      if (processChanged) {
        //console.log(`  🔄 Updating processName from "${gameProfile.processName}" to "${memoryProfile.process}"`);
      }
      
      // Update memory profile type to match the actual profile type being used
      // If we're syncing to a user-created memory profile, update the game profile to reference the user type
      const memoryProfileTypeToUse = memoryProfile.memoryProfileType || 'user';
      
      // Separate memory-based and message-based outputs
      const memoryBasedOutputs = gameProfile.outputs.filter(output => 
        !output.key && (output.address || output.useModuleOffset)
      );
      const messageBasedOutputs = gameProfile.outputs.filter(output => 
        output.key && !output.address && !output.useModuleOffset
      );
      
      //console.log(`  📊 Found ${memoryBasedOutputs.length} memory-based outputs and ${messageBasedOutputs.length} message-based outputs`);
      
      // Filter out only memory-based outputs that no longer exist in the memory profile
      const existingMemoryOutputs = memoryBasedOutputs.filter(output => {
        const exists = memoryOutputLabels.has(output.label);
        if (!exists) {
          //console.log(`  ❌ Removing deleted memory output '${output.label}' from game profile`);
        }
        return exists;
      });
      
      // Track removed memory outputs for logging
      const removedMemoryOutputs = memoryBasedOutputs.filter(output => !memoryOutputLabels.has(output.label));
      if (removedMemoryOutputs.length > 0) {
        //console.log(`  🗑️ Removed ${removedMemoryOutputs.length} deleted memory outputs: ${removedMemoryOutputs.map(o => o.label).join(', ')}`);
      }
      
      // Update existing memory-based outputs based on memory profile, preserving game-specific settings
      const updatedMemoryOutputs = existingMemoryOutputs.map(output => {
        // Find a matching memory output by label
        const matchingMemoryOutput = memoryProfile.outputs.find(
          memOutput => memOutput.label === output.label
        );
        
        if (matchingMemoryOutput) {
          //console.log(`  📝 Syncing memory properties for output '${output.label}'`);
          //console.log(`    Before script: "${output.script}"`);
          //console.log(`    After script: "${matchingMemoryOutput.script}"`);
          
          // Only update core memory properties and formatting/display properties
          // Preserve all game-specific settings (device, channel, notes, etc.)
          const updatedOutput = {
            ...output, // Keep all existing properties first
            // Core memory properties
            type: matchingMemoryOutput.type,
            address: matchingMemoryOutput.address,
            useModuleOffset: matchingMemoryOutput.useModuleOffset,
            moduleName: matchingMemoryOutput.moduleName,
            offset: matchingMemoryOutput.offset,
            offsets: matchingMemoryOutput.offsets || output.offsets || [],
            bitmask: matchingMemoryOutput.bitmask,
            bitwiseOp: matchingMemoryOutput.bitwiseOp,
            bitfield: matchingMemoryOutput.bitfield,
            isPointerChain: matchingMemoryOutput.isPointerChain,
            // Formatting/display properties
            invert: matchingMemoryOutput.invert,
            format: matchingMemoryOutput.format,
            script: matchingMemoryOutput.script || "", // Ensure script is properly synced
            // Update sync timestamp
            lastSyncedWithMemory: Date.now()
          };
          
          return updatedOutput;
        }
        
        return output; // No matching memory output, keep unchanged
      });
      
      // Check if we need to add new memory outputs from the memory profile
      const existingMemoryLabels = new Set(updatedMemoryOutputs.map(o => o.label));
      const newMemoryOutputsFromProfile = memoryProfile.outputs
        .filter(memOutput => !existingMemoryLabels.has(memOutput.label))
        .map(memOutput => ({
          label: memOutput.label,
          type: memOutput.type,
          address: memOutput.address,
          notes: "", // Default game-specific setting
          device: "", // Changed from "arduino" to ""
          channel: 0, // Default game-specific setting
          invert: memOutput.invert,
          format: memOutput.format,
          script: memOutput.script || "",
          useModuleOffset: memOutput.useModuleOffset,
          moduleName: memOutput.moduleName,
          offset: memOutput.offset,
          offsets: memOutput.offsets || [],
          bitmask: memOutput.bitmask,
          bitwiseOp: memOutput.bitwiseOp,
          bitfield: memOutput.bitfield,
          isPointerChain: memOutput.isPointerChain,
          lastSyncedWithMemory: Date.now()
        }));
      
      if (newMemoryOutputsFromProfile.length > 0) {
        //console.log(`  ➕ Adding ${newMemoryOutputsFromProfile.length} new memory outputs from memory profile`);
      }
      
      // Preserve all message-based outputs unchanged during memory profile sync
      //console.log(`  🔒 Preserving ${messageBasedOutputs.length} message-based outputs unchanged`);
      
      const updatedProfile = {
        ...gameProfile,
        processName: memoryProfile.process, // Update processName to match memory profile's process
        memoryProfileType: memoryProfileTypeToUse, // Update the memory profile type to match the actual profile being used
        outputs: [...updatedMemoryOutputs, ...newMemoryOutputsFromProfile, ...messageBasedOutputs],
        lastModified: Date.now(),
        lastSyncedWithMemory: Date.now()
      };
      
      return { profile: updatedProfile, fileName };
    });
    
    // Save each affected profile to disk using their original filenames with selective updates
    //console.log(`💾 Starting to save affected game profiles to disk with selective updates...`);
    const savingPromises: Promise<boolean>[] = [];
    const affectedUpdatedProfilesWithFilenames = updatedGameProfilesWithFilenames.filter(
      ({ profile }) => profile.memoryFile === memoryProfile.fileName
    );
    
    for (const { profile, fileName } of affectedUpdatedProfilesWithFilenames) {
      //console.log(`💾 Saving game profile to disk: ${profile.profileName} (File: ${fileName})`);
      savingPromises.push(saveGameProfileToDisk(profile, fileName));
    }
    
    // Wait for all save operations to complete
    //console.log(`⏳ Waiting for ${savingPromises.length} disk save operations to complete...`);
    const results = await Promise.all(savingPromises);
    const successCount = results.filter(result => result).length;
    
    if (successCount < affectedUpdatedProfilesWithFilenames.length) {
      //console.warn(`⚠️ Only ${successCount} of ${affectedUpdatedProfilesWithFilenames.length} profiles were saved to disk successfully`);
      toast.warning(`Warning: ${affectedUpdatedProfilesWithFilenames.length - successCount} game profiles could not be saved to disk`);
    }
    
    // Show individual success toast for each updated game profile with specific profile names
    affectedUpdatedProfilesWithFilenames.forEach(({ profile }) => {
      //console.log(`✅ Game profile "${profile.profileName}" automatically synced`);
      toast.success(`Game profile "${profile.profileName}" automatically synced from memory profile changes`, {
        duration: 4000,
      });
    });
    
    //console.log(`🎉 Sync completed! Updated ${affectedProfilesWithFilenames.length} game profiles`);
    return affectedProfilesWithFilenames.length;
  } catch (error) {
    //console.error("❌ Failed to sync game profiles to memory profile:", error);
    toast.error(`Sync error: Failed to sync game profiles: ${(error as Error).message}`);
    return 0;
  }
};

/**
 * Updates game profiles when a message profile has been changed
 * Only updates message-related properties and formatting/display properties
 * Preserves game-specific output settings (device, channel, notes, etc.)
 * Removes outputs that no longer exist in the message profile
 * @param messageProfile The updated message profile
 * @returns The number of game profiles that were updated
 */
export const syncGameProfilesToMessageProfile = async (messageProfile: MessageProfile): Promise<number> => {
  try {
    const messageFileName = `${messageProfile.profileName}.json`;
    
    // Load all game profiles from file system with their original filenames
    const gameProfilesWithFilenames = await loadGameProfilesFromFileSystem();
    
    // Find all game profiles that use this message profile
    const affectedProfilesWithFilenames = gameProfilesWithFilenames.filter(
      ({ profile }) => profile.messageFile === messageFileName
    );
    
    if (affectedProfilesWithFilenames.length === 0) {
      return 0; // No profiles to update
    }
    
    // Create a set of message profile output keys for quick lookup
    const messageOutputKeys = new Set(messageProfile.outputs.map(output => output.key));
    
    // For each affected game profile, update only message-related properties
    const updatedGameProfilesWithFilenames = gameProfilesWithFilenames.map(({ profile: gameProfile, fileName }) => {
      // If this profile doesn't use the message profile, return it unchanged
      if (gameProfile.messageFile !== messageFileName) {
        return { profile: gameProfile, fileName };
      }
      
      // Update message profile type to match the actual profile type being used
      const messageProfileTypeToUse = messageProfile.messageProfileType || 'user';
      
      // Filter out message-based outputs that no longer exist in the message profile
      const existingOutputs = gameProfile.outputs.filter(output => {
        // Keep memory-based outputs (those without key field or with memory indicators)
        if (!output.key || output.address || output.useModuleOffset) {
          return true;
        }
        
        // For message-based outputs, check if they still exist in the message profile
        const exists = messageOutputKeys.has(output.key);
        if (!exists) {
          // This is a message-based output that no longer exists
        }
        return exists;
      });
      
      // Update remaining message-based outputs based on message profile, preserving game-specific settings
      const updatedOutputs = existingOutputs.map(output => {
        // Only update message-based outputs (those with key field and no memory indicators)
        if (output.key && !output.address && !output.useModuleOffset) {
          // Find a matching message output by key
          const matchingMessageOutput = messageProfile.outputs.find(
            msgOutput => msgOutput.key === output.key
          );
          
          if (matchingMessageOutput) {
            // Only update message-related properties
            // Preserve all game-specific settings (device, channel, notes, etc.)
            const updatedOutput = {
              ...output, // Keep all existing properties first
              // Message-related properties
              label: matchingMessageOutput.label,
              // Formatting/display properties - always sync, including empty strings
              format: matchingMessageOutput.format, // This will be "" if empty, which is what we want
              script: matchingMessageOutput.script, // This will be "" if empty, which is what we want
              // Update sync timestamp
              lastSyncedWithMessage: Date.now()
            };
            
            return updatedOutput;
          }
        }
        
        return output; // No matching message output or not a message-based output, keep unchanged
      });
      
      // Check if we need to add new message-based outputs from the message profile
      const existingKeys = new Set(updatedOutputs.filter(o => o.key).map(o => o.key));
      const newOutputsFromMessage = messageProfile.outputs
        .filter(msgOutput => !existingKeys.has(msgOutput.key))
        .map(msgOutput => ({
          label: msgOutput.label,
          type: "message", // Mark as message type
          address: "", // Empty for message-based outputs
          key: msgOutput.key, // Use the message key
          notes: "", // Default game-specific setting
          device: "", // Default game-specific setting
          channel: 0, // Default game-specific setting
          invert: false, // Default
          format: msgOutput.format, // Include format even if empty string
          script: msgOutput.script, // Include script even if empty string
          useModuleOffset: false, // Not applicable for message outputs
          moduleName: "", // Not applicable for message outputs
          offset: undefined,
          offsets: [],
          bitmask: undefined,
          bitwiseOp: "" as const,
          bitfield: false,
          isPointerChain: false,
          lastSyncedWithMessage: Date.now()
        }));
      
      const updatedProfile = {
        ...gameProfile,
        messageProfileType: messageProfileTypeToUse, // Update the message profile type to match the actual profile being used
        outputs: [...updatedOutputs, ...newOutputsFromMessage],
        lastModified: Date.now(),
        lastSyncedWithMessage: Date.now()
      };
      
      return { profile: updatedProfile, fileName };
    });
    
    // Save each affected profile to disk using their original filenames with selective updates
    const savingPromises: Promise<boolean>[] = [];
    const affectedUpdatedProfilesWithFilenames = updatedGameProfilesWithFilenames.filter(
      ({ profile }) => profile.messageFile === messageFileName
    );
    
    for (const { profile, fileName } of affectedUpdatedProfilesWithFilenames) {
      savingPromises.push(saveGameProfileToDisk(profile, fileName));
    }
    
    // Wait for all save operations to complete
    const results = await Promise.all(savingPromises);
    const successCount = results.filter(result => result).length;
    
    if (successCount < affectedUpdatedProfilesWithFilenames.length) {
      toast.warning(`Warning: ${affectedUpdatedProfilesWithFilenames.length - successCount} game profiles could not be saved to disk`);
    }
    
    // Show individual success toast for each updated game profile with specific profile names
    affectedUpdatedProfilesWithFilenames.forEach(({ profile }) => {
      toast.success(`Game profile "${profile.profileName}" automatically synced from message profile changes`, {
        duration: 4000,
      });
    });
    
    return affectedProfilesWithFilenames.length;
  } catch (error) {
    toast.error(`Sync error: Failed to sync game profiles: ${(error as Error).message}`);
    return 0;
  }
};

/**
 * Updates a memory profile based on changes made to a game profile
 * @param gameProfile The game profile that was updated
 * @param memoryProfile The memory profile to update
 * @returns The updated memory profile or null if no updates were made
 */
export const syncMemoryProfileToGameProfile = (
  gameProfile: GameProfile,
  memoryProfile: MemoryProfile
): MemoryProfile | null => {
  try {
    //console.log(`Syncing memory profile ${memoryProfile.fileName} to game profile ${gameProfile.profileName}`);
    let hasChanges = false;
    
    // Update memory profile outputs based on the game profile outputs
    const updatedOutputs = memoryProfile.outputs.map(memOutput => {
      // Find matching game output by label
      const matchingGameOutput = gameProfile.outputs.find(
        output => output.label === memOutput.label
      );
      
      if (matchingGameOutput) {
        // Check if there are any differences that need to be synced
        const needsUpdate = 
          memOutput.invert !== matchingGameOutput.invert ||
          memOutput.format !== matchingGameOutput.format ||
          memOutput.script !== matchingGameOutput.script;
        
        if (needsUpdate) {
          //console.log(`Updating memory output '${memOutput.label}' from game profile`);
          //console.log(`Before: invert=${memOutput.invert}, format=${memOutput.format}, script=${memOutput.script || ''}`);
          //console.log(`After: invert=${matchingGameOutput.invert}, format=${matchingGameOutput.format}, script=${matchingGameOutput.script || ''}`);
          
          hasChanges = true;
          return {
            ...memOutput,
            invert: matchingGameOutput.invert,
            format: matchingGameOutput.format,
            script: matchingGameOutput.script || memOutput.script
          };
        }
      }
      
      return memOutput;
    });
    
    if (hasChanges) {
      const updatedMemoryProfile = {
        ...memoryProfile,
        outputs: updatedOutputs,
        lastModified: Date.now() // Add timestamp of last modification
      };
      
      // Update the content string to reflect the changes
      const contentObj = JSON.parse(memoryProfile.content || "{}");
      contentObj.outputs = updatedOutputs.map(output => ({
        ...output,
        address: output.address.replace(/^.*\+/, "") // Strip module prefix if any
      }));
      
      updatedMemoryProfile.content = JSON.stringify(contentObj, null, 2);
      
      // Save the updated memory profile to the cache
      profileStorage.updateCachedMemoryProfile(updatedMemoryProfile);
      
      //console.log(`Memory profile ${memoryProfile.fileName} updated successfully`);
      return updatedMemoryProfile;
    }
    
    //console.log(`No changes needed for memory profile ${memoryProfile.fileName}`);
    return null; // No changes were made
  } catch (error) {
    //console.error("Failed to sync memory profile to game profile:", error);
    toast(`Failed to sync memory profile to game profile: ${(error as Error).message}`);
    return null;
  }
};

/**
 * Gets a list of game profile names that use a specific memory profile
 * @param memoryProfileFileName The filename of the memory profile
 * @returns Array of game profile names
 */
export const getGameProfilesUsingMemoryProfile = (memoryProfileFileName: string): string[] => {
  try {
    const gameProfiles = profileStorage.loadProfiles();
    const matchingProfiles = gameProfiles.filter(
      profile => profile.memoryFile === memoryProfileFileName
    );
    
    return matchingProfiles.map(profile => profile.profileName);
  } catch (error) {
    //console.error("Error finding game profiles using memory profile:", error);
    return [];
  }
};

/**
 * Gets a list of game profile names that use a specific message profile
 * @param messageProfileFileName The filename of the message profile
 * @returns Array of game profile names
 */
export const getGameProfilesUsingMessageProfile = (messageProfileFileName: string): string[] => {
  try {
    const gameProfiles = profileStorage.loadProfiles();
    const matchingProfiles = gameProfiles.filter(
      profile => profile.messageFile === messageProfileFileName
    );
    
    return matchingProfiles.map(profile => profile.profileName);
  } catch (error) {
    return [];
  }
};
