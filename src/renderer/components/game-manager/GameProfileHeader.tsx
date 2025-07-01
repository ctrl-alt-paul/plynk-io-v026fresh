
import React from "react";
import { Gamepad, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGameManager } from "./context/GameManagerContext";
import { GameManagerHelpDialog } from "../GameManagerHelpDialog";

interface GameProfileHeaderProps {
  actions?: React.ReactNode;
}

export const GameProfileHeader: React.FC<GameProfileHeaderProps> = ({ actions }) => {
  const { 
    selectedGameProfile,
    gameProfiles,
    loadGameProfile,
    isLoading
  } = useGameManager();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gamepad className="h-6 w-6" />
          <h1 className="text-2xl font-bold tracking-tight">Game Manager</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <GameManagerHelpDialog 
              trigger={
                <Button variant="ghost" className="p-1 w-auto h-auto min-h-0 icon-large-override">
                  <HelpCircle className="h-5 w-5 text-blue-600" />
                </Button>
              }
            />
            <div className="min-w-[240px] max-w-[400px]">
              <Select
                value={selectedGameProfile || ""}
                onValueChange={loadGameProfile}
                disabled={isLoading}
              >
                <SelectTrigger id="gameProfileHeader" className="w-full">
                  <SelectValue placeholder="Select Game Profile" />
                </SelectTrigger>
                <SelectContent>
                  {gameProfiles.map((profile) => (
                    <SelectItem key={profile} value={profile}>
                      {profile.replace(".json", "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {actions && (
            <div className="flex-shrink-0">
              {actions}
            </div>
          )}
        </div>
      </div>
      
      <p className="text-muted-foreground mt-1">
        Create and manage game profiles with memory mappings and device configurations
      </p>
    </div>
  );
};
