
import React from "react";
import { CreateButton, UpdateButton, DeleteButton, ClearButton } from "./GameActionsButton";

interface GameManagerActionsProps {
  onCreateProfile: () => void;
  onUpdateProfile: () => void;
  onDeleteProfile: () => void;
  onClear: () => void;
  selectedGameProfile: string | null;
  isLoading: boolean;
}

export const GameManagerActions: React.FC<GameManagerActionsProps> = ({
  onCreateProfile,
  onUpdateProfile,
  onDeleteProfile,
  onClear,
  selectedGameProfile,
  isLoading
}) => {
  return (
    <div className="flex items-center gap-2">
      <CreateButton 
        onClick={onCreateProfile}
        disabled={isLoading}
      />
      
      <UpdateButton
        onClick={onUpdateProfile}
        disabled={isLoading || !selectedGameProfile}
      />
      
      <DeleteButton
        onClick={onDeleteProfile}
        disabled={isLoading || !selectedGameProfile}
      />
      
      <ClearButton
        onClick={onClear}
        disabled={isLoading || !selectedGameProfile}
      />
    </div>
  );
};
