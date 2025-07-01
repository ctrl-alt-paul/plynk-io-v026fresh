
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

interface UnsavedChangesContextType {
  hasUnsavedChanges: boolean;
  changeSource: 'profile' | 'mappings' | 'both' | null;
  setHasUnsavedChanges: (hasChanges: boolean, source?: 'profile' | 'mappings') => void;
  clearUnsavedChanges: () => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType | undefined>(undefined);

export const UnsavedChangesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [changeSource, setChangeSource] = useState<'profile' | 'mappings' | 'both' | null>(null);
  const [hasShownToast, setHasShownToast] = useState(false);

  const setUnsavedChanges = useCallback((hasChanges: boolean, source: 'profile' | 'mappings' = 'profile') => {
    if (hasChanges) {
      setHasUnsavedChanges(true);
      setChangeSource(prev => {
        if (!prev) return source;
        if (prev !== source) return 'both';
        return prev;
      });
      
      // Show toast notification only once when changes are first detected
      if (!hasShownToast) {
        toast.warning("You have unsaved changes. Click 'Update Profile' or 'Save Settings' to save your changes.");
        setHasShownToast(true);
      }
    } else {
      setHasUnsavedChanges(false);
      setChangeSource(null);
      setHasShownToast(false);
    }
  }, [hasShownToast]);

  const clearUnsavedChanges = useCallback(() => {
    setHasUnsavedChanges(false);
    setChangeSource(null);
    setHasShownToast(false);
  }, []);

  const contextValue: UnsavedChangesContextType = {
    hasUnsavedChanges,
    changeSource,
    setHasUnsavedChanges: setUnsavedChanges,
    clearUnsavedChanges
  };

  return (
    <UnsavedChangesContext.Provider value={contextValue}>
      {children}
    </UnsavedChangesContext.Provider>
  );
};

export const useUnsavedChanges = () => {
  const context = useContext(UnsavedChangesContext);
  if (context === undefined) {
    throw new Error("useUnsavedChanges must be used within an UnsavedChangesProvider");
  }
  return context;
};
