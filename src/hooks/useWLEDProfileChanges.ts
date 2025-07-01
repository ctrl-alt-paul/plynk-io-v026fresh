
import { useState, useCallback, useEffect } from 'react';
import { useWatch } from 'react-hook-form';
import { WLEDRule } from '@/lib/wledProfiles';
import { useUnsavedChanges } from '@/components/UnsavedChangesProvider';

interface WLEDProfileWithRules {
  id: string;
  name: string;
  description?: string;
  deviceIP: string;
  rules: WLEDRule[];
}

interface OriginalProfileState {
  name: string;
  description: string;
  deviceIP: string;
  rules: WLEDRule[];
}

export const useWLEDProfileChanges = (
  selectedProfile: WLEDProfileWithRules | null,
  editingProfileId: string | null,
  isCreatingNewProfile: boolean,
  isLoadingProfile: boolean,
  form: any
) => {
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const [originalProfile, setOriginalProfile] = useState<OriginalProfileState | null>(null);

  // Watch form values for changes
  const watchedValues = useWatch({
    control: form.control,
    name: ['name', 'description', 'deviceIP']
  });

  // Deep compare rules arrays
  const rulesChanged = useCallback((currentRules: WLEDRule[], originalRules: WLEDRule[]) => {
    if (!originalRules || currentRules.length !== originalRules.length) {
      return true;
    }

    for (let i = 0; i < currentRules.length; i++) {
      const current = currentRules[i];
      const original = originalRules[i];

      // Compare all rule properties
      if (
        current.id !== original.id ||
        current.triggerType !== original.triggerType ||
        current.exactValue !== original.exactValue ||
        current.effect !== original.effect ||
        current.brightness !== original.brightness ||
        current.flash !== original.flash ||
        JSON.stringify(current.color) !== JSON.stringify(original.color) ||
        JSON.stringify(current.segments) !== JSON.stringify(original.segments)
      ) {
        return true;
      }
    }

    return false;
  }, []);

  // Check for form changes
  const formChanged = useCallback(() => {
    if (!originalProfile || !watchedValues) return false;

    const [currentName, currentDescription, currentDeviceIP] = watchedValues;
    
    return (
      currentName !== originalProfile.name ||
      (currentDescription || '') !== (originalProfile.description || '') ||
      currentDeviceIP !== originalProfile.deviceIP
    );
  }, [originalProfile, watchedValues]);

  // Main change detection effect
  useEffect(() => {
    // Don't detect changes in these cases:
    // 1. No profile selected
    // 2. Creating new profile (not editing existing)
    // 3. Not in editing mode
    // 4. Currently loading profile
    if (!selectedProfile || isCreatingNewProfile || !editingProfileId || isLoadingProfile) {
      return;
    }

    // Check if we have original state to compare against
    if (!originalProfile) {
      return;
    }

    const hasFormChanges = formChanged();
    const hasRulesChanges = rulesChanged(selectedProfile.rules, originalProfile.rules);
    const hasChanges = hasFormChanges || hasRulesChanges;

    if (hasChanges) {
      setHasUnsavedChanges(true, 'profile');
    }
  }, [
    selectedProfile,
    originalProfile,
    editingProfileId,
    isCreatingNewProfile,
    isLoadingProfile,
    formChanged,
    rulesChanged,
    setHasUnsavedChanges
  ]);

  // Store original profile state when starting to edit
  const setOriginalProfileState = useCallback((profile: WLEDProfileWithRules) => {
    const originalState: OriginalProfileState = {
      name: profile.name || '',
      description: profile.description || '',
      deviceIP: profile.deviceIP || '',
      rules: profile.rules.map(rule => ({ ...rule })) // Deep copy rules
    };
    setOriginalProfile(originalState);
  }, []);

  // Clear original state
  const clearOriginalState = useCallback(() => {
    setOriginalProfile(null);
  }, []);

  return {
    setOriginalProfileState,
    clearOriginalState
  };
};
