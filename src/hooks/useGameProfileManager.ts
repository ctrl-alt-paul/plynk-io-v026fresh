import { useGameManager } from "@/renderer/components/game-manager/context/GameManagerContext";

// Keep this hook for backward compatibility
export function useGameProfileManager() {
  return useGameManager();
}
