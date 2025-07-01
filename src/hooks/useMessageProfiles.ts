import { useState, useEffect, useCallback } from 'react';
import { MessageProfile } from '@/types/messageProfiles';
import { messageProfiles } from '@/lib/messageProfiles';
import { profileManager, ProfileWithType } from '@/lib/profileManager';
import { syncGameProfilesToMessageProfile } from '@/lib/profileSynchronization';
import { useToast } from '@/hooks/use-toast';
import { useUnsavedChanges } from '@/components/UnsavedChangesProvider';

export const useMessageProfiles = (
  logEvent: (category: string, message: string) => void
) => {
  const { clearUnsavedChanges } = useUnsavedChanges();
  const [availableProfiles, setAvailableProfiles] = useState<string[]>([]);
  const [profilesWithType, setProfilesWithType] = useState<ProfileWithType[]>([]);
  const [currentProfileName, setCurrentProfileName] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<MessageProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const { toast } = useToast();

  // Load available profiles on mount using enhanced profileManager
  const loadAvailableProfiles = useCallback(async () => {
    try {
      setIsLoading(true);
      const profilesWithTypeData = await profileManager.listMessageProfiles();
      const profileNames = profilesWithTypeData.map(p => p.fileName);
      setProfilesWithType(profilesWithTypeData);
      setAvailableProfiles(profileNames);
    } catch (error) {
      console.error('Error loading message profiles:', error);
      toast({
        title: "Error",
        description: "Failed to load message profiles",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const handleProfileSelect = async (profileName: string) => {
    try {
      setIsLoadingProfile(true);
      
      // Clear unsaved changes first, before any state changes
      clearUnsavedChanges();
      
      // Find the profile type from our stored profiles
      const profileWithType = profilesWithType.find(p => p.fileName === profileName);
      const profileType = profileWithType?.type || 'user'; // Default to 'user' for backwards compatibility
      
      const profile = await profileManager.getMessageProfile(profileName, profileType);
      if (profile) {
        setCurrentProfile(profile);
        setCurrentProfileName(profileName);
        logEvent("message-listen", `Loaded message profile: ${profileName} with ${profile.outputs?.length || 0} outputs`);
        toast({
          title: "Profile Loaded",
          description: `Message profile "${profileName}" loaded successfully`
        });
        // Ensure all outputs have format and script fields as empty strings if missing
        const normalizedOutputs = profile.outputs.map(output => ({
          ...output,
          format: output.format ?? "",
          script: output.script ?? ""
        }));
        
        // Clear loading state after a brief delay to ensure all state updates complete
        setTimeout(() => {
          setIsLoadingProfile(false);
        }, 100);
        
        return normalizedOutputs || [];
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: "Error",
        description: "Failed to load message profile",
        variant: "destructive"
      });
    } finally {
      // Fallback in case setTimeout doesn't execute
      setTimeout(() => {
        setIsLoadingProfile(false);
      }, 200);
    }
    return [];
  };

  const handleSaveProfile = async (profileName: string, outputs: any[]): Promise<boolean> => {
    if (!profileName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a profile name",
        variant: "destructive"
      });
      return false;
    }

    if (outputs.length === 0) {
      toast({
        title: "Error", 
        description: "No message outputs captured. Start listening first.",
        variant: "destructive"
      });
      return false;
    }

    try {
      setIsSaving(true);
      const profile: MessageProfile = {
        profileName: profileName.trim(),
        outputs: outputs.map(output => ({
          key: output.key,
          label: output.label || output.key,
          lastValue: output.lastValue,
          format: output.format || "",
          script: output.script || ""
        }))
      };

      const success = await messageProfiles.saveMessageProfile(profile);
      
      if (success) {
        setCurrentProfile(profile);
        setCurrentProfileName(profileName.trim());
        await loadAvailableProfiles(); // Refresh the list
        logEvent("message-listen", `Saved message profile: ${profileName} with ${outputs.length} outputs`);
        
        // Clear unsaved changes after successful save
        clearUnsavedChanges();
        
        // Sync dependent game profiles
        try {
          const syncedCount = await syncGameProfilesToMessageProfile(profile);
          if (syncedCount > 0) {
            logEvent("message-sync", `Synced ${syncedCount} game profiles with message profile: ${profileName}`);
          }
        } catch (syncError) {
          console.warn('Error syncing game profiles:', syncError);
          // Don't fail the save operation if sync fails
        }
        
        toast({
          title: "Success",
          description: `Message profile "${profileName}" saved successfully`
        });
        return true;
      } else {
        logEvent("warning", `Failed to save message profile: ${profileName}`);
        toast({
          title: "Error",
          description: "Failed to save message profile",
          variant: "destructive"
        });
        return false;
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Error",
        description: "Failed to save message profile",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!currentProfileName) return;

    try {
      setIsSaving(true);
      const success = await messageProfiles.deleteMessageProfile(currentProfileName);
      
      if (success) {
        logEvent("message-listen", `Deleted message profile: ${currentProfileName}`);
        toast({
          title: "Success",
          description: `Message profile "${currentProfileName}" deleted successfully`
        });
        handleClear();
        await loadAvailableProfiles(); // Refresh the list
      } else {
        toast({
          title: "Error",
          description: "Failed to delete message profile",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error deleting profile:', error);
      toast({
        title: "Error",
        description: "Failed to delete message profile",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    // Clear unsaved changes first
    clearUnsavedChanges();
    
    setCurrentProfile(null);
    setCurrentProfileName(null);
    logEvent("message-listen", "Cleared message profile and outputs");
    toast({
      title: "Cleared",
      description: "Message profile and outputs cleared"
    });
  };

  // Load profiles on mount
  useEffect(() => {
    loadAvailableProfiles();
  }, [loadAvailableProfiles]);

  return {
    availableProfiles,
    currentProfileName,
    currentProfile,
    isLoading,
    isSaving,
    isLoadingProfile,
    handleProfileSelect,
    handleSaveProfile,
    handleDeleteProfile,
    handleClear,
    loadAvailableProfiles
  };
};
