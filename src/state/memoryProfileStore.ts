
import { create } from 'zustand';
import { MemoryProfile, MemoryProfileOutput } from '@/types/memoryProfiles';

interface MemoryProfileState {
  profiles: MemoryProfile[];
  currentProfile: MemoryProfile | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setProfiles: (profiles: MemoryProfile[]) => void;
  setCurrentProfile: (profile: MemoryProfile | null) => void;
  addProfile: (profile: MemoryProfile) => void;
  updateProfile: (profile: MemoryProfile) => void;
  deleteProfile: (profileId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useMemoryProfileStore = create<MemoryProfileState>((set) => ({
  profiles: [],
  currentProfile: null,
  isLoading: false,
  error: null,

  setProfiles: (profiles) => set({ profiles }),
  setCurrentProfile: (profile) => set({ currentProfile: profile }),
  addProfile: (profile) => set((state) => ({ 
    profiles: [...state.profiles, profile] 
  })),
  updateProfile: (profile) => set((state) => ({
    profiles: state.profiles.map(p => p.id === profile.id ? profile : p),
    currentProfile: state.currentProfile?.id === profile.id ? profile : state.currentProfile
  })),
  deleteProfile: (profileId) => set((state) => ({
    profiles: state.profiles.filter(p => p.id !== profileId),
    currentProfile: state.currentProfile?.id === profileId ? null : state.currentProfile
  })),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));

// Helper functions for memory profile management
export const createEmptyProfile = (): Omit<MemoryProfile, 'id' | 'fileName' | 'lastModified' | 'outputCount'> => ({
  process: '',
  pollInterval: 16,
  outputs: [],
  memoryProfileType: 'user'
});

export const createEmptyOutput = (): MemoryProfileOutput => ({
  label: '',
  type: 'Int32',
  address: '',
  notes: '',
  invert: false,
  format: '{value}',
  script: '',
  useModuleOffset: false,
  moduleName: '',
  offset: '',
  offsets: [],
  bitmask: '',
  bitwiseOp: '',
  bitfield: false,
  isPointerChain: false
});

// Validation helpers
export const validateMemoryProfile = (profile: Partial<MemoryProfile>): string[] => {
  const errors: string[] = [];
  
  if (!profile.process?.trim()) {
    errors.push('Process name is required');
  }
  
  if (!profile.pollInterval || profile.pollInterval < 1) {
    errors.push('Poll interval must be greater than 0');
  }
  
  if (!profile.outputs || profile.outputs.length === 0) {
    errors.push('At least one output is required');
  }
  
  profile.outputs?.forEach((output, index) => {
    if (!output.label?.trim()) {
      errors.push(`Output ${index + 1}: Label is required`);
    }
    
    if (output.useModuleOffset) {
      if (!output.moduleName?.trim()) {
        errors.push(`Output ${index + 1}: Module name is required when using module offset`);
      }
      if (!output.offset?.trim()) {
        errors.push(`Output ${index + 1}: Offset is required when using module offset`);
      }
    } else {
      if (!output.address?.trim()) {
        errors.push(`Output ${index + 1}: Address is required when not using module offset`);
      }
    }
  });
  
  return errors;
};
