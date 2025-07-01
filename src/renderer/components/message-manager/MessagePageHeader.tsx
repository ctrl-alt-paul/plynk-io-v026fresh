
import React from 'react';
import { MessageSquare, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageProfileOutput } from "@/types/messageProfiles";
import MessageProfileManager from "./MessageProfileManager";
import { MessageManagerHelpDialog } from "@/renderer/components/MessageManagerHelpDialog";

interface MessagePageHeaderProps {
  availableProfiles: string[];
  currentProfileName: string | null;
  outputs: MessageProfileOutput[];
  isLoading: boolean;
  isSaving: boolean;
  onProfileSelect: (profileName: string) => void;
  onSaveAsNew: () => void;
  onOverwrite: () => Promise<boolean>;
  onDelete: () => void;
  onClear: () => void;
  onSaveConfirm: (profileName: string) => Promise<boolean>;
  onOverwriteConfirm: () => Promise<boolean>;
  onOpenJsonEditor: () => void;
}

const MessagePageHeader: React.FC<MessagePageHeaderProps> = ({
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
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          <h1 className="text-2xl font-bold tracking-tight">Message Manager</h1>
        </div>
        
        {/* Message Profile Management */}
        <div className="flex items-center gap-3">
          <MessageManagerHelpDialog 
            trigger={
              <Button variant="ghost" className="p-1 w-auto h-auto min-h-0 icon-large-override">
                <HelpCircle className="text-blue-500" />
              </Button>
            } 
          />
          <MessageProfileManager 
            availableProfiles={availableProfiles} 
            currentProfileName={currentProfileName} 
            outputs={outputs} 
            isLoading={isLoading} 
            isSaving={isSaving} 
            onProfileSelect={onProfileSelect} 
            onSaveAsNew={onSaveAsNew} 
            onOverwrite={onOverwrite} 
            onDelete={onDelete} 
            onClear={onClear} 
            onSaveConfirm={onSaveConfirm} 
            onOverwriteConfirm={onOverwriteConfirm} 
            onOpenJsonEditor={onOpenJsonEditor}
          />
        </div>
      </div>
      
      <p className="text-muted-foreground mt-1">
        Capture and profile message-based outputs from emulators like MAME and OutputBlaster via Win32 WM_COPYDATA messages
      </p>
    </div>
  );
};

export default MessagePageHeader;
