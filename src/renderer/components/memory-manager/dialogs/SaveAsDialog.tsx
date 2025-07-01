
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, Save } from "lucide-react";

interface SaveAsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileName: string;
  onProfileNameChange: (name: string) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function SaveAsDialog({
  open,
  onOpenChange,
  profileName,
  onProfileNameChange,
  onSave,
  isSaving
}: SaveAsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Memory Profile</DialogTitle>
          <DialogDescription>
            Enter a name for your memory profile
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="profile-name">Profile Name</Label>
          <Input 
            id="profile-name"
            value={profileName}
            onChange={e => onProfileNameChange(e.target.value)}
            placeholder="MyProfile.json"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!profileName || isSaving}>
            {isSaving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
