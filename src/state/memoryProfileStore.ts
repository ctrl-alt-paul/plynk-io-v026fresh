
import React, { createContext, useContext, useState, useCallback } from 'react';
import { MemoryProfile, MemoryProfileOutput } from '@/types/memoryProfiles';

export interface MemoryProfileStoreState {
  currentProfile: MemoryProfile | null;
  submissionHistory: Array<{
    profileId: string;
    submittedAt: string;
    issueUrl: string;
    gameVersion: string;
    emulator: string;
  }>;
}

export interface MemoryProfileStoreContextType extends MemoryProfileStoreState {
  setCurrentProfile: (profile: MemoryProfile | null) => void;
  getUserCreatedOutputs: () => MemoryProfileOutput[];
  addSubmissionToHistory: (submission: {
    profileId: string;
    submittedAt: string;
    issueUrl: string;
    gameVersion: string;
    emulator: string;
  }) => void;
  clearSubmissionHistory: () => void;
}

const MemoryProfileStoreContext = createContext<MemoryProfileStoreContextType | undefined>(undefined);

export const MemoryProfileStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<MemoryProfileStoreState>({
    currentProfile: null,
    submissionHistory: []
  });

  const setCurrentProfile = useCallback((profile: MemoryProfile | null) => {
    setState(prev => ({
      ...prev,
      currentProfile: profile
    }));
  }, []);

  const getUserCreatedOutputs = useCallback((): MemoryProfileOutput[] => {
    if (!state.currentProfile) return [];
    
    return state.currentProfile.outputs.filter(output => output.source === 'user');
  }, [state.currentProfile]);

  const addSubmissionToHistory = useCallback((submission: {
    profileId: string;
    submittedAt: string;
    issueUrl: string;
    gameVersion: string;
    emulator: string;
  }) => {
    setState(prev => ({
      ...prev,
      submissionHistory: [submission, ...prev.submissionHistory]
    }));
  }, []);

  const clearSubmissionHistory = useCallback(() => {
    setState(prev => ({
      ...prev,
      submissionHistory: []
    }));
  }, []);

  const value: MemoryProfileStoreContextType = {
    ...state,
    setCurrentProfile,
    getUserCreatedOutputs,
    addSubmissionToHistory,
    clearSubmissionHistory
  };

  return (
    <MemoryProfileStoreContext.Provider value={value}>
      {children}
    </MemoryProfileStoreContext.Provider>
  );
};

export const useMemoryProfileStore = (): MemoryProfileStoreContextType => {
  const context = useContext(MemoryProfileStoreContext);
  if (context === undefined) {
    throw new Error('useMemoryProfileStore must be used within a MemoryProfileStoreProvider');
  }
  return context;
};
