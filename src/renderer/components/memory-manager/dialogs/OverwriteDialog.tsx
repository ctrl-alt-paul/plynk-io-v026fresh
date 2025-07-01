
import React from "react";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { RefreshCw, FileCheck } from "lucide-react";

interface OverwriteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileName: string | null;
  onConfirm: () => void;
  isSaving: boolean;
}

export function OverwriteDialog({
  open,
  onOpenChange,
  profileName,
  onConfirm,
  isSaving
}: OverwriteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Update Profile</AlertDialogTitle>
          <AlertDialogDescription>
            This will overwrite the current profile "{profileName}". Are you sure?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isSaving}>
            {isSaving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <FileCheck className="h-4 w-4 mr-2" />}
            Update
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
