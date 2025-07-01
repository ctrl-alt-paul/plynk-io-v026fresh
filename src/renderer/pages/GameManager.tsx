
import React from "react";
import { GameProfileForm } from "../components/game-manager/form/GameProfileForm";
import { GameProfileMappingTable } from "../components/game-manager/mapping/GameProfileMappingTable";
import { GameProfileHeader } from "../components/game-manager/GameProfileHeader";
import { GameManagerActions } from "../components/game-manager/actions/GameManagerActions";
import { GameManagerProvider, useGameManager } from "../components/game-manager/context/GameManagerContext";
import { UnsavedChangesProvider } from "@/components/UnsavedChangesProvider";
import { UnsavedChangesWarning } from "@/components/UnsavedChangesWarning";
import { useDomHandler } from "@/hooks";
import { toast } from "sonner";

// Component that manages the internal functionality of the Game Manager page
const GameManagerContent: React.FC = () => {
  const { 
    selectedGameProfile, 
    deleteGameProfile,
    clearProfile,
    isLoading,
    handleSaveSettings,
    currentGameProfile,
    updateGameProfile,
    getFormValues
  } = useGameManager();
  
  const { clickElementById } = useDomHandler();

  // Function to trigger the create profile dialog from the form component
  const handleCreateProfile = () => {
    clickElementById("createProfileButton");
  };

  // Function to trigger the clear action from the form component
  const handleClear = () => {
    clearProfile();
    clickElementById("clearButton");
  };

  // Handle update profile - Now uses context form values and always saves mapping data
  const handleUpdateProfile = async () => {
    if (!selectedGameProfile || !currentGameProfile) {
      toast.error("No game profile selected");
      return;
    }
    
    try {
      // Get the current form values using the context method instead of DOM queries
      const formValues = getFormValues();
      
      // Get the original values from ProfileSelectionForm
      const getOriginalProcessName = (window as any).getOriginalProcessName;
      const getOriginalPollInterval = (window as any).getOriginalPollInterval;
      const originalProcessName = getOriginalProcessName ? getOriginalProcessName() : currentGameProfile.processName;
      const originalPollInterval = getOriginalPollInterval ? getOriginalPollInterval() : currentGameProfile.pollInterval;
      
      // Check if there are any changes to save
      const hasProcessNameChange = formValues.processName !== originalProcessName;
      const hasPollIntervalChange = formValues.pollInterval !== originalPollInterval;
      const hasActiveChange = formValues.isActive !== currentGameProfile.isActive;
      const hasGameNameChange = (formValues.gameName || "") !== (currentGameProfile.messageName || "");
      
      // Always get current mappings from the table
      const getMappingsButton = document.getElementById("getMappingsButton");
      if (getMappingsButton) {
        getMappingsButton.click();
      }
      
      if (!hasProcessNameChange && !hasPollIntervalChange && !hasActiveChange && !hasGameNameChange) {
        // If no profile setting changes, just save the mappings using handleSaveSettings
        const success = await handleSaveSettings();
        if (success) {
          toast.success("Profile mappings updated successfully");
        }
        return;
      }
      
      // Use the enhanced handleSaveSettings method which now handles all the logic
      const success = await handleSaveSettings();
      
      if (success) {
        // Reset any unsaved change indicators
        const event = new CustomEvent('profileSaved');
        window.dispatchEvent(event);
      }
      
    } catch (error) {
      toast.error("Failed to update profile");
    }
  };

  return (
    <div className="container mx-auto py-2">
      {/* Unsaved Changes Warning */}
      <UnsavedChangesWarning />
      
      <div className="flex flex-col gap-4 md:gap-6">
        {/* Header with game profile selection and actions */}
        <GameProfileHeader 
          actions={
            <GameManagerActions 
              onCreateProfile={handleCreateProfile}
              onUpdateProfile={handleUpdateProfile}
              onDeleteProfile={deleteGameProfile}
              onClear={handleClear}
              selectedGameProfile={selectedGameProfile}
              isLoading={isLoading}
            />
          }
        />

        {/* Game profile settings card */}
        <GameProfileForm />
        
        {/* Game profile mapping table */}
        <GameProfileMappingTable />
      </div>
    </div>
  );
};

// Main GameManager component that provides the context
const GameManager: React.FC = () => {
  return (
    <UnsavedChangesProvider>
      <GameManagerProvider>
        <GameManagerContent />
      </GameManagerProvider>
    </UnsavedChangesProvider>
  );
};

export default GameManager;
