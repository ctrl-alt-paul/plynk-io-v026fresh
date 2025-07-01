import React, { useState, useEffect } from 'react';
import { 
  FileUp, FileCheck, RefreshCw, Trash2, Code
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { MessageProfileOutput } from "@/types/messageProfiles";
import { profileManager, ProfileWithType } from "@/lib/profileManager";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";

interface MessageProfileManagerProps {
  availableProfiles: string[];
  currentProfileName: string | null;
  outputs: MessageProfileOutput[];
  isLoading: boolean;
  isSaving: boolean;
  onProfileSelect: (profileName: string) => void;
  onSaveAsNew: () => void;
  onOverwrite: () => void;
  onDelete: () => void;
  onClear: () => void;
  onSaveConfirm: (profileName: string) => Promise<boolean>;
  onOverwriteConfirm: () => Promise<boolean>;
  onOpenJsonEditor: () => void;
}

const MessageProfileManager: React.FC<MessageProfileManagerProps> = ({
  availableProfiles,
  currentProfileName,
  outputs,
  isLoading,
  isSaving,
  onProfileSelect,
  onSaveAsNew,
  onOverwrite,
  onDelete,
  onClear,
  onSaveConfirm,
  onOverwriteConfirm,
  onOpenJsonEditor
}) => {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [overwriteDialogOpen, setOverwriteDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [profilesWithType, setProfilesWithType] = useState<ProfileWithType[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [currentProfileType, setCurrentProfileType] = useState<'default' | 'user' | 'community'>('user');
  const { toast } = useToast();

  // Load profiles with type information
  useEffect(() => {
    const loadProfilesWithType = async () => {
      setLoadingProfiles(true);
      try {
        const profiles = await profileManager.listMessageProfiles();
        setProfilesWithType(profiles);
      } catch (error) {
        console.error('Error loading message profiles:', error);
        sonnerToast.error('Failed to load message profiles');
      } finally {
        setLoadingProfiles(false);
      }
    };

    loadProfilesWithType();
  }, []);

  // Track current profile type when profile is selected
  useEffect(() => {
    if (currentProfileName) {
      const profile = profilesWithType.find(p => p.fileName === currentProfileName);
      setCurrentProfileType(profile?.type || 'user');
    }
  }, [currentProfileName, profilesWithType]);

  const canSaveProfile = outputs.length > 0;
  const canOverwriteProfile = canSaveProfile && currentProfileName !== null && currentProfileType !== 'default' && currentProfileType !== 'community';
  const canDeleteProfile = currentProfileName !== null && currentProfileType !== 'default' && currentProfileType !== 'community';

  const handleProfileSelect = (profileName: string) => {
    const profile = profilesWithType.find(p => p.fileName === profileName);
    setCurrentProfileType(profile?.type || 'user');
    onProfileSelect(profileName);
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
      const profiles = await profileManager.listMessageProfiles();
      setProfilesWithType(profiles);
    }
  };

  const handleOverwriteConfirm = async () => {
    await onOverwriteConfirm();
    setOverwriteDialogOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!currentProfileName || currentProfileType === 'default' || currentProfileType === 'community') {
      toast({
        title: "Error",
        description: "Cannot delete default or community profiles",
        variant: "destructive"
      });
      setDeleteDialogOpen(false);
      return;
    }

    try {
      await onDelete();
      setDeleteDialogOpen(false);
      // Reload profiles after delete
      const profiles = await profileManager.listMessageProfiles();
      setProfilesWithType(profiles);
      toast({
        title: "Success",
        description: `Profile "${currentProfileName}" deleted successfully`
      });
    } catch (error) {
      console.error('Error deleting profile:', error);
      toast({
        title: "Error",
        description: "Failed to delete profile",
        variant: "destructive"
      });
      setDeleteDialogOpen(false);
    }
  };

  // Group profiles by type
  const defaultProfiles = profilesWithType.filter(p => p.type === 'default');
  const communityProfiles = profilesWithType.filter(p => p.type === 'community');
  const userProfiles = profilesWithType.filter(p => p.type === 'user');

  return (
    <>
      <div className="flex items-start gap-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-[240px]">
            <Select value={currentProfileName || ""} onValueChange={handleProfileSelect}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a message profile" />
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
                      <SelectItem key={`default-${fileName}`} value={fileName}>
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
                      <SelectItem key={`community-${fileName}`} value={fileName}>
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
                      <SelectItem key={`user-${fileName}`} value={fileName}>
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
        </div>
      
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant={canSaveProfile && !isSaving ? "default" : "outline"} onClick={handleSaveAsNew} disabled={!canSaveProfile || isSaving}>
                <FileUp className="h-4 w-4 mr-2" />
                Save As New
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save as a new message profile</TooltipContent>
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
                : currentProfileType === 'community'
                ? "Cannot update community profiles - use Save As New instead"
                : canOverwriteProfile 
                  ? `Update "${currentProfileName}"` 
                  : "Load a profile first to update it"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={onOpenJsonEditor}>
                <Code className="h-4 w-4 mr-2" />
                JSON
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {currentProfileName || outputs.length > 0 
                ? "Edit current profile as JSON" 
                : "Create new profile from JSON template"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} disabled={!canDeleteProfile}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {currentProfileType === 'default' 
                ? "Cannot delete default profiles"
                : currentProfileType === 'community'
                ? "Cannot delete community profiles"
                : canDeleteProfile 
                  ? `Delete "${currentProfileName}"` 
                  : "Load a user profile first to delete"}
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
            <DialogTitle>Save Message Profile</DialogTitle>
            <DialogDescription>
              Enter a name for your message profile
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input 
              id="profile-name"
              value={newProfileName}
              onChange={e => setNewProfileName(e.target.value)}
              placeholder="MyMessageProfile"
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

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Profile</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the profile "{currentProfileName}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MessageProfileManager;
