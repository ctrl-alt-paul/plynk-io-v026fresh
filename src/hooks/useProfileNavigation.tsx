
import React, { createContext, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";

interface ProfileNavigationContextType {
  openMemoryProfileInEditor: (fileName: string, focusOutputLabel?: string) => void;
  openMemoryProfileEditor: (fileName: string, focusOutputLabel?: string) => void;
  focusedMemoryProfile: {
    fileName: string;
    outputLabel?: string;
  } | null;
  clearFocus: () => void;
}

const ProfileNavigationContext = createContext<ProfileNavigationContextType | undefined>(undefined);

export const ProfileNavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [focusedMemoryProfile, setFocusedMemoryProfile] = useState<{
    fileName: string;
    outputLabel?: string;
  } | null>(null);

  // Redirect all memory profile operations to Memory Manager page (now at root path)
  const openMemoryProfileInEditor = (fileName: string, focusOutputLabel?: string) => {
    setFocusedMemoryProfile({
      fileName,
      outputLabel: focusOutputLabel
    });
    navigate(`/?profile=${encodeURIComponent(fileName)}`);
  };
  
  // Add an alias for backwards compatibility
  const openMemoryProfileEditor = openMemoryProfileInEditor;

  const clearFocus = () => {
    setFocusedMemoryProfile(null);
  };

  return (
    <ProfileNavigationContext.Provider
      value={{
        openMemoryProfileInEditor,
        openMemoryProfileEditor,
        focusedMemoryProfile,
        clearFocus
      }}
    >
      {children}
    </ProfileNavigationContext.Provider>
  );
};

export const useProfileNavigation = () => {
  const context = useContext(ProfileNavigationContext);
  if (context === undefined) {
    throw new Error("useProfileNavigation must be used within a ProfileNavigationProvider");
  }
  return context;
};
