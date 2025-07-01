import React, { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { isElectron } from "@/utils/isElectron";
import { useMessageListener } from "@/hooks/useMessageListener";
import { useMessageOutputs } from "@/hooks/useMessageOutputs";
import { useMessageProfiles } from "@/hooks/useMessageProfiles";
import { UnsavedChangesProvider } from "@/components/UnsavedChangesProvider";
import { UnsavedChangesWarning } from "@/components/UnsavedChangesWarning";
import MessagePageHeader from "@/renderer/components/message-manager/MessagePageHeader";
import MessageListenerControls from "@/renderer/components/message-manager/MessageListenerControls";
import MessageOutputsTable from "@/renderer/components/message-manager/MessageOutputsTable";
import { MessageJsonEditorDialog } from "@/renderer/components/message-manager/MessageJsonEditorDialog";
import { MessageProfile } from "@/types/messageProfiles";

declare global {
  interface Window {
    messageAPI?: {
      startListener: () => void;
    };
  }
}

function MessageProfileBuilderContent() {
  const { toast } = useToast();
  const [isDashboardListenerEnabled, setIsDashboardListenerEnabled] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [editedJson, setEditedJson] = useState("");

  // Check dashboard message listener status on mount
  useEffect(() => {
    const checkDashboardListenerStatus = async () => {
      if (isElectron() && window.electron?.ipcRenderer) {
        try {
          const result = await window.electron.ipcRenderer.invoke('message-listener:get-config');
          if (result.success) {
            setIsDashboardListenerEnabled(result.isEnabled);
          }
        } catch (error) {
          console.error('Failed to get dashboard message listener status:', error);
        }
      }
    };

    checkDashboardListenerStatus();
  }, []);

  // Log event helper using proper IPC
  const logEvent = useCallback((category: string, message: string) => {
    if (isElectron() && window.electron?.ipcRenderer) {
      // Send log event via IPC to be displayed on Log page
      window.electron.ipcRenderer.send('log:event', {
        timestamp: new Date().toISOString(),
        category: category,
        message: message
      });
    } else {
      console.log(`[${category}] ${message}`);
    }
  }, []);

  // Custom hooks for state management
  const {
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
  } = useMessageProfiles(logEvent);

  const {
    outputs,
    handleMessageOutput,
    handleLabelChange,
    handleFormatChange,
    handleScriptChange,
    clearOutputs,
    setOutputsData
  } = useMessageOutputs(isLoadingProfile);

  const {
    isListening,
    startListening,
    stopListening
  } = useMessageListener(handleMessageOutput, logEvent);

  // Enhanced profile management functions
  const handleProfileSelectWithOutputs = async (profileName: string) => {
    const profileOutputs = await handleProfileSelect(profileName);
    setOutputsData(profileOutputs);
  };

  const handleSaveProfileWithOutputs = async (profileName: string): Promise<boolean> => {
    return await handleSaveProfile(profileName, outputs);
  };

  const handleOverwriteProfile = async (): Promise<boolean> => {
    if (!currentProfileName) return false;
    return await handleSaveProfileWithOutputs(currentProfileName);
  };

  const handleClearWithOutputs = () => {
    handleClear();
    clearOutputs();
  };

  const handleOpenJsonEditor = () => {
    let jsonContent: MessageProfile;
    
    // If no profile is loaded and no outputs captured, provide template
    if (!currentProfileName && outputs.length === 0) {
      jsonContent = {
        profileName: "",
        outputs: [
          {
            key: "__MAME_START__",
            label: "__MAME_START__",
            lastValue: 1,
            format: "",
            script: ""
          }
        ],
        messageProfileType: 'user'
      };
    } else {
      // Use existing profile or captured outputs
      jsonContent = {
        profileName: currentProfileName || "New Profile",
        outputs: outputs.map(output => ({
          key: output.key,
          label: output.label,
          lastValue: output.lastValue,
          format: output.format || "",
          script: output.script || ""
        })),
        messageProfileType: 'user'
      };
    }
    
    setEditedJson(JSON.stringify(jsonContent, null, 2));
    setShowJsonModal(true);
  };

  const handleApplyEditedJson = async () => {
    try {
      const parsedProfile: MessageProfile = JSON.parse(editedJson);
      
      // Apply the parsed profile
      setOutputsData(parsedProfile.outputs || []);
      
      // Remove .json extension from profile name before saving (case-insensitive)
      const profileNameForSaving = parsedProfile.profileName.replace(/\.json$/i, '');
      
      // If profile name changed and we have outputs, save as new profile
      if (profileNameForSaving !== currentProfileName && parsedProfile.outputs.length > 0) {
        const saved = await handleSaveProfile(profileNameForSaving, parsedProfile.outputs);
        if (saved) {
          toast({
            title: "Success",
            description: `Profile "${profileNameForSaving}" created from JSON`
          });
        }
      }
      
      setShowJsonModal(false);
      toast({
        title: "JSON Applied",
        description: "Message profile updated from JSON"
      });
    } catch (error) {
      console.error('Error applying JSON:', error);
      toast({
        title: "Error",
        description: "Failed to apply JSON changes",
        variant: "destructive"
      });
    }
  };

  const handleStartListening = () => {
    startListening();
    toast({
      title: "Listening Started",
      description: "Now capturing message outputs from emulators via Win32 messages"
    });
  };

  const handleStopListening = () => {
    stopListening();
    toast({
      title: "Listening Stopped",
      description: "Message output capture has been paused"
    });
  };

  return (
    <div className="container mx-auto py-2 space-y-6">
      <UnsavedChangesWarning />
      
      <MessagePageHeader
        availableProfiles={availableProfiles}
        currentProfileName={currentProfileName}
        outputs={outputs}
        isLoading={isLoading}
        isSaving={isSaving}
        onProfileSelect={handleProfileSelectWithOutputs}
        onSaveAsNew={() => {}} // Handled by the component itself
        onOverwrite={handleOverwriteProfile}
        onDelete={handleDeleteProfile}
        onClear={handleClearWithOutputs}
        onSaveConfirm={handleSaveProfileWithOutputs}
        onOverwriteConfirm={handleOverwriteProfile}
        onOpenJsonEditor={handleOpenJsonEditor}
      />

      <MessageListenerControls
        isListening={isListening}
        isDashboardListenerEnabled={isDashboardListenerEnabled}
        onStartListening={handleStartListening}
        onStopListening={handleStopListening}
      />

      <MessageOutputsTable
        outputs={outputs}
        onLabelChange={handleLabelChange}
        onFormatChange={handleFormatChange}
        onScriptChange={handleScriptChange}
      />

      <MessageJsonEditorDialog
        open={showJsonModal}
        onOpenChange={setShowJsonModal}
        jsonContent={editedJson}
        onJsonContentChange={setEditedJson}
        onApply={handleApplyEditedJson}
      />
    </div>
  );
}

export default function MessageProfileBuilder() {
  return (
    <UnsavedChangesProvider>
      <MessageProfileBuilderContent />
    </UnsavedChangesProvider>
  );
}
