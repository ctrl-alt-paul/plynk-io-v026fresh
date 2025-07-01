import React, { useState, useEffect } from 'react';
import { 
  FileUp, FileCheck, Code, RefreshCw, Trash2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MemoryAddress } from "@/types/memoryAddress";
import { MemoryProfile } from "@/types/memoryProfiles";
import { profileManager, ProfileWithType } from "@/lib/profileManager";
import { toast } from "sonner";

interface MemoryProfileManagerProps {
  availableProfiles: string[];
  currentProfileName: string | null;
  currentProfile: MemoryProfile | null;
  memoryAddresses: MemoryAddress[];
  defaultPollInterval: number;
  isLoading: boolean;
  isSaving: boolean;
  selectedProcess: string | null;
  onProfileSelect: (profileName: string, profileType: 'default' | 'user' | 'community') => void;
  onSaveAsNew: () => void;
  onOverwrite: () => void;
  onDelete: () => void;
  onClear: () => void;
  onSaveConfirm: (profileName: string) => Promise<boolean>;
  onOverwriteConfirm: () => Promise<boolean>;
  openJsonEditor: (json: string) => void;
}

const MemoryProfileManager: React.FC<MemoryProfileManagerProps> = ({
  availableProfiles,
  currentProfileName,
  currentProfile,
  memoryAddresses,
  defaultPollInterval,
  isLoading,
  isSaving,
  selectedProcess,
  onProfileSelect,
  onSaveAsNew,
  onOverwrite,
  onDelete,
  onClear,
  onSaveConfirm,
  onOverwriteConfirm,
  openJsonEditor
}) => {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [overwriteDialogOpen, setOverwriteDialogOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [profilesWithType, setProfilesWithType] = useState<ProfileWithType[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [selectedProfileComposite, setSelectedProfileComposite] = useState<string>("");

  // Load profiles with type information
  useEffect(() => {
    const loadProfilesWithType = async () => {
      setLoadingProfiles(true);
      try {
        const profiles = await profileManager.listMemoryProfiles();
        setProfilesWithType(profiles);
      } catch (error) {
        console.error('Error loading profiles:', error);
        toast.error('Failed to load profiles');
      } finally {
        setLoadingProfiles(false);
      }
    };

    loadProfilesWithType();
  }, []);

  // Update selected profile composite when currentProfileName changes
  useEffect(() => {
    if (currentProfileName && currentProfile) {
      const profileType = currentProfile.memoryProfileType || 'user';
      setSelectedProfileComposite(`${profileType}:${currentProfileName}`);
    } else {
      setSelectedProfileComposite("");
    }
  }, [currentProfileName, currentProfile]);

  const canSaveProfile = memoryAddresses.length > 0;
  const currentProfileType = currentProfile?.memoryProfileType || 'user';
  const canOverwriteProfile = canSaveProfile && currentProfileName !== null && currentProfileType !== 'default';

  const handleProfileSelect = (compositeValue: string) => {
    setSelectedProfileComposite(compositeValue);
    
    // Parse composite value to get both type and fileName
    const [type, fileName] = compositeValue.split(':');
    onProfileSelect(fileName, type as 'default' | 'user' | 'community');
  };

  const handleSaveAsNew = () => {
    setNewProfileName("");
    setSaveDialogOpen(true);
  };

  const handleSaveConfirm = async () => {
    if (!newProfileName) return;
    
    const result = await onSaveConfirm(newProfileName);
    if (result) {
      setSaveDialogOpen(false);
      setNewProfileName("");
      // Reload profiles after save
      const profiles = await profileManager.listMemoryProfiles();
      setProfilesWithType(profiles);
    }
  };

  const handleOverwriteConfirm = async () => {
    await onOverwriteConfirm();
    setOverwriteDialogOpen(false);
  };

  const handleOpenJsonEditor = () => {
    try {
      // Define non-serializable fields that should be excluded
      const nonSerializableFields = [
        'id', 'value', 'rawValue', 'finalValue', 'lastRead', 'error', 'success'
      ];
      
      // Create a clean representation of memory addresses for JSON
      const cleanedOutputs = memoryAddresses.map(addr => {
        // Create a new object with only the serializable properties
        const cleanAddr: Record<string, any> = {};
        
        Object.entries(addr).forEach(([key, value]) => {
          // Skip non-serializable fields
          if (nonSerializableFields.includes(key)) return;
          
          // Handle specific data types
          if (value === undefined) {
            // Skip undefined values
            return;
          } else if (typeof value === 'bigint') {
            // Convert BigInt to string with special format
            cleanAddr[key] = `n:${value.toString()}`;
          } else if (value instanceof Date) {
            // Convert Date to ISO string
            cleanAddr[key] = value.toISOString();
          } else {
            // Keep other values as-is
            cleanAddr[key] = value;
          }
        });
        
        return cleanAddr;
      });
      
      // Use selectedProcess from props first, then fallback to currentProfile.process
      // This ensures we always use the most up-to-date process name
      const processName = selectedProcess || currentProfile?.process || "";
      
      // Determine the profile type - use existing type or default to 'user' for new profiles
      const profileType = currentProfile?.memoryProfileType || 'user';
      
      // Create the profile object with the preserved process field and profile type
      const profileObj = {
        process: processName,
        pollInterval: defaultPollInterval,
        outputs: cleanedOutputs,
        memoryProfileType: profileType
      };
      
      // Stringify the profile with a custom replacer function for any missed BigInts
      const jsonString = JSON.stringify(profileObj, (key, value) => {
        if (typeof value === 'bigint') {
          return `n:${value.toString()}`;
        }
        // Ensure we never emit moduleName at root level
        if (key === 'moduleName' && this === profileObj) {
          return undefined;
        }
        return value;
      }, 2);
      
      openJsonEditor(jsonString);
    } catch (error) {
      toast.error("Failed to prepare JSON data: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Group profiles by type
  const defaultProfiles = profilesWithType.filter(p => p.type === 'default');
  const communityProfiles = profilesWithType.filter(p => p.type === 'community');
  const userProfiles = profilesWithType.filter(p => p.type === 'user');

  // Helper function to get display value for selected profile
  const getDisplayValue = (compositeValue: string) => {
    if (!compositeValue) return "";
    
    const [type, fileName] = compositeValue.split(':');
    const profile = profilesWithType.find(p => p.type === type && p.fileName === fileName);
    
    if (profile) {
      const badgeClasses = type === 'default' 
        ? 'bg-blue-100 text-blue-800' 
        : type === 'community'
        ? 'bg-orange-100 text-orange-800'
        : 'bg-green-100 text-green-800';
      const badgeText = type === 'default' ? 'Default' : type === 'community' ? 'Community' : 'User';
      
      return (
        <div className="flex items-center gap-2">
          <span>{fileName}</span>
          <span className={`px-2 py-1 text-xs font-medium rounded ${badgeClasses}`}>
            {badgeText}
          </span>
        </div>
      );
    }
    return compositeValue;
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-[240px]">
          <Select value={selectedProfileComposite} onValueChange={handleProfileSelect}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a profile">
                {selectedProfileComposite && getDisplayValue(selectedProfileComposite)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {loadingProfiles && (
                <SelectItem key="loading" value="loading" disabled>Loading profiles...</SelectItem>
              )}
              
              {!loadingProfiles && profilesWithType.length === 0 && (
                <SelectItem key="no-profiles" value="no-profiles" disabled>No profiles found</SelectItem>
              )}

              {defaultProfiles.length > 0 && (
                <>
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-b">
                    Default Profiles
                  </div>
                  {defaultProfiles.map(({ fileName, type }) => (
                    <SelectItem key={`default-${fileName}`} value={`${type}:${fileName}`}>
                      <div className="flex items-center gap-2">
                        <span>{fileName}</span>
                        <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">Default</span>
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}

              {communityProfiles.length > 0 && (
                <>
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-b">
                    Community Profiles
                  </div>
                  {communityProfiles.map(({ fileName, type }) => (
                    <SelectItem key={`community-${fileName}`} value={`${type}:${fileName}`}>
                      <div className="flex items-center gap-2">
                        <span>{fileName}</span>
                        <span className="px-2 py-1 text-xs font-medium rounded bg-orange-100 text-orange-800">Community</span>
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}

              {userProfiles.length > 0 && (
                <>
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-b">
                    User Profiles
                  </div>
                  {userProfiles.map(({ fileName, type }) => (
                    <SelectItem key={`user-${fileName}`} value={`${type}:${fileName}`}>
                      <div className="flex items-center gap-2">
                        <span>{fileName}</span>
                        <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">User</span>
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant={canSaveProfile && !isSaving ? "default" : "outline"} onClick={handleSaveAsNew} disabled={!canSaveProfile || isSaving}>
                <FileUp className="h-4 w-4 mr-2" />
                Save As New
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save as a new memory profile</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={() => setOverwriteDialogOpen(true)} disabled={!canOverwriteProfile || isSaving}>
                <FileCheck className="h-4 w-4 mr-2" />
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Update"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {currentProfileType === 'default' 
                ? "Cannot update default profiles - use Save As New instead"
                : canOverwriteProfile 
                  ? `Update "${currentProfileName}"` 
                  : "Load a profile first to update it"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={handleOpenJsonEditor}>
                <Code className="h-4 w-4 mr-2" />
                JSON
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit memory profile as raw JSON</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="destructive" onClick={onDelete} disabled={!currentProfileName}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {currentProfileName ? `Delete "${currentProfileName}"` : "Load a profile first to delete"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" onClick={onClear}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset the form and unload current profile</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Memory Profile</DialogTitle>
            <DialogDescription>
              Enter a name for your memory profile
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input 
              id="profile-name"
              value={newProfileName}
              onChange={e => setNewProfileName(e.target.value)}
              placeholder="MyProfile.json"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfirm} disabled={!newProfileName || isSaving}>
              {isSaving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <FileUp className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Overwrite Dialog */}
      <AlertDialog open={overwriteDialogOpen} onOpenChange={setOverwriteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Profile</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite the current profile "{currentProfileName}". Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleOverwriteConfirm} disabled={isSaving}>
              {isSaving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <FileCheck className="h-4 w-4 mr-2" />}
              Update
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MemoryProfileManager;
