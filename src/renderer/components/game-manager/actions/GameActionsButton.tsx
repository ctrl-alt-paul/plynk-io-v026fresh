
import React from "react";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Save, 
  Trash, 
  RotateCcw
} from "lucide-react";

interface GameActionsButtonProps {
  id: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export const GameActionsButton: React.FC<GameActionsButtonProps> = ({
  id,
  icon,
  disabled = false,
  onClick,
  children,
  variant = "default",
  size = "sm",
  className = ""
}) => {
  return (
    <Button
      id={id}
      size={size}
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {icon}
      {children}
    </Button>
  );
};

export const CreateButton: React.FC<{ 
  onClick: () => void, 
  disabled?: boolean 
}> = ({ onClick, disabled = false }) => (
  <GameActionsButton 
    id="visible-createProfileButton"
    icon={<Plus className="h-4 w-4 mr-1" />}
    onClick={onClick}
    disabled={disabled}
    variant="default"
  >
    Create
  </GameActionsButton>
);

export const UpdateButton: React.FC<{ 
  onClick: () => void, 
  disabled?: boolean 
}> = ({ onClick, disabled = false }) => (
  <GameActionsButton 
    id="visible-updateProfileButton"
    icon={<Save className="h-4 w-4 mr-1" />}
    onClick={onClick}
    disabled={disabled}
    variant="outline"
  >
    Update
  </GameActionsButton>
);

export const DeleteButton: React.FC<{ 
  onClick: () => void, 
  disabled?: boolean 
}> = ({ onClick, disabled = false }) => (
  <GameActionsButton 
    id="visible-deleteGameProfileBtn"
    icon={<Trash className="h-4 w-4 mr-1" />}
    onClick={onClick}
    disabled={disabled}
    variant="destructive"
  >
    Delete
  </GameActionsButton>
);

export const ClearButton: React.FC<{ 
  onClick: () => void, 
  disabled?: boolean 
}> = ({ onClick, disabled = false }) => (
  <GameActionsButton 
    id="visible-clearButton"
    icon={<RotateCcw className="h-4 w-4 mr-1" />}
    onClick={onClick}
    disabled={disabled}
    variant="outline"
  >
    Clear
  </GameActionsButton>
);
