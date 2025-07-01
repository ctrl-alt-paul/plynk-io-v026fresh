
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileSelectionForm } from "./ProfileSelectionForm";
import { CreateProfileDialog } from "./CreateProfileDialog";
import { useGameManager } from "../context/GameManagerContext";
import { toast } from "sonner";

export const GameProfileForm: React.FC = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Add a state to track available mappings
  const [currentMappings, setCurrentMappings] = useState<any[]>([]);
  const { isLoading } = useGameManager();
  
  // Register the updateMappingsFromForm function on the window object
  useEffect(() => {
    const updateMappingsFromForm = (mappings: any[]) => {
      //console.log("Received mappings in GameProfileForm:", mappings);
      setCurrentMappings(mappings);
    };
    
    // Register the function on the window object
    (window as any).updateMappingsFromForm = updateMappingsFromForm;
    
    // Clean up function when component unmounts
    return () => {
      delete (window as any).updateMappingsFromForm;
    };
  }, []);
  
  // Register a function to get the current mappings from the form
  useEffect(() => {
    (window as any).getCurrentMappingsFromForm = () => {
      //console.log("Returning current mappings from form:", currentMappings);
      return currentMappings;
    };
    
    // Clean up function when component unmounts
    return () => {
      delete (window as any).getCurrentMappingsFromForm;
    };
  }, [currentMappings]);
  
  return (
    <>
      <Card>
        <CardHeader className="py-3">
          <CardTitle>Game Profile Settings</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <ProfileSelectionForm />
        </CardContent>
      </Card>
      
      {/* Create Profile Dialog */}
      <CreateProfileDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen} 
      />
      
      {/* This createButton is for external components to open the dialog */}
      <div className="hidden">
        <button 
          onClick={() => setIsCreateDialogOpen(true)} 
          id="createProfileButton"
        >
          Create Profile
        </button>
        <button 
          onClick={() => {}} 
          id="updateProfileButton"
        >
          Update Profile
        </button>
        <button 
          onClick={() => {}} 
          id="clearButton"
        >
          Clear
        </button>
        <button 
          onClick={() => {
            // This button is clicked when mappings need to be retrieved
            //console.log("getMappingsButton clicked - attempting to get current mappings");
            const getCurrentMappings = (window as any).getCurrentMappings;
            if (typeof getCurrentMappings === 'function') {
              try {
                const mappings = getCurrentMappings();
                //console.log("Retrieved mappings:", mappings);
                if (Array.isArray(mappings)) {
                  setCurrentMappings(mappings);
                } else {
                  //console.error("Retrieved mappings are not an array:", mappings);
                  toast.error("Retrieved mappings are in an invalid format");
                }
              } catch (error) {
                //console.error("Error retrieving mappings:", error);
                toast.error("Error retrieving mappings");
              }
            } else {
              //console.error("getCurrentMappings function not found on window");
              toast.error("Mapping synchronization function not found");
            }
          }} 
          id="getMappingsButton"
        >
          Get Mappings
        </button>
      </div>
    </>
  );
};
