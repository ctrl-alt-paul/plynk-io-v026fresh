
import React from "react";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Save, 
  Trash, 
  RotateCcw
} from "lucide-react";

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
      <Button
        size="sm"
        className="bg-[#222] text-white hover:bg-[#333]"
        onClick={onCreateProfile}
        disabled={isLoading}
      >
        <Plus className="h-4 w-4" />
        Create
      </Button>
      
      <Button
        size="sm"
        variant="outline"
        onClick={onUpdateProfile}
        disabled={isLoading || !selectedGameProfile}
      >
        <Save className="h-4 w-4" />
        Update
      </Button>
      
      <Button
        size="sm"
        variant="destructive"
        onClick={onDeleteProfile}
        disabled={isLoading || !selectedGameProfile}
      >
        <Trash className="h-4 w-4" />
        Delete
      </Button>
      
      <Button
        size="sm"
        variant="outline"
        onClick={onClear}
        disabled={isLoading || !selectedGameProfile}
      >
        <RotateCcw className="h-4 w-4" />
        Clear
      </Button>
    </div>
  );
};
