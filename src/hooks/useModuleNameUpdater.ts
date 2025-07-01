
import { useCallback, useState, useEffect } from 'react';
import { MemoryAddress } from '@/types/memoryAddress';
import { toast } from 'sonner';

interface UseModuleNameUpdaterProps {
  currentProfile: any;
  selectedProcess: string | null;
  memoryAddresses: MemoryAddress[];
  updateMemoryAddressField: (id: string, field: string, value: any) => void;
}

export function useModuleNameUpdater({
  currentProfile,
  selectedProcess,
  memoryAddresses,
  updateMemoryAddressField
}: UseModuleNameUpdaterProps) {
  const [showUpdateButton, setShowUpdateButton] = useState(false);
  const [originalProcess, setOriginalProcess] = useState<string | null>(null);

  // Track original process when profile loads
  useEffect(() => {
    if (currentProfile && currentProfile.process) {
      setOriginalProcess(currentProfile.process);
    }
  }, [currentProfile]);

  // Check if we should show the update button
  useEffect(() => {
    if (originalProcess && selectedProcess && 
        originalProcess !== selectedProcess && 
        memoryAddresses.some(addr => addr.moduleName === originalProcess)) {
      setShowUpdateButton(true);
    } else {
      setShowUpdateButton(false);
    }
  }, [originalProcess, selectedProcess, memoryAddresses]);

  const updateModuleNames = useCallback(() => {
    if (!originalProcess || !selectedProcess) return;

    let updatedCount = 0;
    
    memoryAddresses.forEach(addr => {
      if (addr.moduleName === originalProcess) {
        updateMemoryAddressField(addr.id, 'moduleName', selectedProcess);
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      toast.success(`Updated ${updatedCount} module name(s) from "${originalProcess}" to "${selectedProcess}"`);
      setOriginalProcess(selectedProcess); // Update the original to prevent showing button again
    } else {
      toast.info("No module names needed updating");
    }
  }, [originalProcess, selectedProcess, memoryAddresses, updateMemoryAddressField]);

  return {
    showUpdateButton,
    updateModuleNames,
    originalProcess,
    hasModuleNamesToUpdate: showUpdateButton
  };
}
