import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { applyTransformations, parseOffset } from "@/renderer/utils/memoryUtils";
import { validations } from "@/utils/validations";
import { useUnsavedChanges } from "@/components/UnsavedChangesProvider";
import { 
  MemoryAddress, 
  NewMemoryAddress
} from "@/types/memoryAddress";

interface UseMemoryAddressManagerProps {
  selectedProcess: string | null;
}

export function useMemoryAddressManager({ selectedProcess }: UseMemoryAddressManagerProps) {
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const [memoryAddresses, setMemoryAddresses] = useState<MemoryAddress[]>([]);
  const [originalAddresses, setOriginalAddresses] = useState<MemoryAddress[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [newAddress, setNewAddress] = useState<NewMemoryAddress>({
    label: "",
    moduleName: "",
    address: "",
    type: "Int32",
    useModuleOffset: true,
    offset: "",
    offsetFormat: "hex",
    customSize: undefined,
    invert: false,
    format: "",
    script: "",
    offsets: [],
    bitmask: "",
    bitwiseOp: "", 
    bitfield: false,
    notes: "",
    source: "user" // Set default source for new addresses
  });
  const [usePointerChain, setUsePointerChain] = useState(false);
  const [offsets, setOffsets] = useState<string[]>([]);
  const [currentOffset, setCurrentOffset] = useState("");
  const [newOffset, setNewOffset] = useState("");

  // Deep compare addresses to detect changes
  const addressesChanged = useCallback(() => {
    if (originalAddresses.length === 0) return false;
    
    // Compare array lengths
    if (memoryAddresses.length !== originalAddresses.length) return true;
    
    // Deep compare each address
    for (let i = 0; i < memoryAddresses.length; i++) {
      const current = memoryAddresses[i];
      const original = originalAddresses[i];
      
      // Compare all relevant fields (excluding runtime fields)
      const fieldsToCompare = [
        'label', 'moduleName', 'address', 'type', 'useModuleOffset', 'offset', 
        'offsetFormat', 'customSize', 'invert', 'format', 'script', 'notes',
        'bitmask', 'bitwiseOp', 'bitfield', 'source'
      ];
      
      for (const field of fieldsToCompare) {
        if (current[field] !== original[field]) return true;
      }
      
      // Compare offsets array
      if (JSON.stringify(current.offsets || []) !== JSON.stringify(original.offsets || [])) {
        return true;
      }
    }
    
    return false;
  }, [memoryAddresses, originalAddresses]);

  // Check for changes and update unsaved state - with loading guard
  useEffect(() => {
    // Don't detect changes while loading a profile
    if (isLoadingProfile) return;
    
    const hasChanges = addressesChanged();
    if (hasChanges) {
      setHasUnsavedChanges(true, 'mappings');
    }
  }, [memoryAddresses, addressesChanged, setHasUnsavedChanges, isLoadingProfile]);

  // Store original addresses when they're loaded from a profile
  const setMemoryAddressesWithOriginal = useCallback((addresses: MemoryAddress[]) => {
    setIsLoadingProfile(true);
    
    // Set original first, then current to prevent race condition
    const clonedAddresses = addresses.map(addr => ({ ...addr, offsets: [...(addr.offsets || [])] }));
    setOriginalAddresses(clonedAddresses);
    setMemoryAddresses(addresses);
    
    // Clear loading after a brief delay to ensure all state updates complete
    setTimeout(() => {
      setIsLoadingProfile(false);
    }, 100);
  }, []);

  // Clear original state
  const clearOriginalAddresses = useCallback(() => {
    setOriginalAddresses([]);
  }, []);

  // Helper function that calls our extracted parseOffset utility
  const isAddressFormValid = useCallback((): boolean => {
    if (newAddress.useModuleOffset) {
      const hasValidOffset = parseOffset(newAddress.offset, newAddress.offsetFormat) !== null;
      return newAddress.moduleName?.trim() !== "" && hasValidOffset;
    }
    return (newAddress.address?.trim() || "") !== "";
  }, [newAddress]);

  const toggleUseModuleOffset = useCallback((checked: boolean) => {
    setNewAddress(prev => {
      const updated = {
        ...prev,
        useModuleOffset: checked,
        moduleName: "",
        address: "",
        offset: checked ? prev.offset : ""
      };
      return updated;
    });
  }, []);

  const updateNewAddressField = useCallback((field: string, value: string | boolean | number) => {
    setNewAddress(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const addMemoryAddress = useCallback(() => {
    if (!isAddressFormValid()) {
      toast.warning("Please provide all required address information");
      return;
    }
    
    const newMemoryAddress: MemoryAddress = {
      id: Date.now().toString(),
      label: newAddress.label || "",
      moduleName: newAddress.moduleName,
      address: newAddress.address,
      type: newAddress.type,
      value: null,
      rawValue: null,
      finalValue: null,
      lastRead: null,
      useModuleOffset: newAddress.useModuleOffset,
      offset: newAddress.offset,
      offsetFormat: newAddress.offsetFormat,
      customSize: newAddress.type === "CustomSize" ? newAddress.customSize : undefined,
      invert: newAddress.invert,
      format: newAddress.format,
      script: newAddress.script,
      notes: newAddress.notes || "",
      offsets: usePointerChain ? offsets : [],
      bitmask: newAddress.bitmask,
      bitwiseOp: newAddress.bitwiseOp,
      bitfield: newAddress.bitfield,
      source: "user" // Always set source to "user" for manually added addresses
    };
    
    setMemoryAddresses(prev => [...prev, newMemoryAddress]);
    setNewAddress({
      label: "",
      moduleName: "",
      address: "",
      type: "Int32",
      useModuleOffset: newAddress.useModuleOffset,
      offset: "",
      offsetFormat: "hex",
      customSize: undefined,
      invert: false,
      format: "",
      script: "",
      notes: "",
      offsets: [],
      bitmask: "",
      bitwiseOp: "",
      bitfield: false,
      source: "user" // Keep source as "user" for next address
    });
    setUsePointerChain(false);
    setOffsets([]);
    setCurrentOffset("");
  }, [newAddress, isAddressFormValid, usePointerChain, offsets]);

  const removeMemoryAddress = useCallback((id: string) => {
    setMemoryAddresses(prev => prev.filter(addr => addr.id !== id));
  }, []);

  const updateMemoryAddressField = useCallback((id: string, field: string, value: any) => {
    setMemoryAddresses(prev => prev.map(addr => {
      if (addr.id === id) {
        const updatedAddr = {
          ...addr,
          [field]: value
        };
        if (field === 'invert' || field === 'script' || field === 'format') {
          updatedAddr.finalValue = applyTransformations(addr.rawValue, field === 'invert' ? value : addr.invert, field === 'script' ? value : addr.script, field === 'format' ? value : addr.format);
        }
        return updatedAddr;
      }
      return addr;
    }));
  }, []);

  const addNewOffset = useCallback(() => {
    if (!currentOffset) {
      toast.error("Please enter an offset value");
      return;
    }

    if (!validations.isValidHexOffset(currentOffset)) {
      toast.error("Offset must be a valid hexadecimal value");
      return;
    }

    const formattedOffset = validations.formatOffset(currentOffset);
    setOffsets(prev => [...prev, formattedOffset]);
    setCurrentOffset("");
  }, [currentOffset]);

  const removeNewOffset = useCallback((index: number) => {
    setOffsets(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearNewOffsets = useCallback(() => {
    setOffsets([]);
  }, []);

  const addOffset = useCallback((addressId: string) => {
    if (!newOffset) {
      toast.error("Please enter an offset value");
      return;
    }

    if (!validations.isValidHexOffset(newOffset)) {
      toast.error("Offset must be a valid hexadecimal value");
      return;
    }

    const formattedOffset = validations.formatOffset(newOffset);
    setMemoryAddresses(prev => prev.map(addr => {
      if (addr.id === addressId) {
        return {
          ...addr,
          offsets: [...(addr.offsets || []), formattedOffset]
        };
      }
      return addr;
    }));
    setNewOffset("");
  }, [newOffset]);

  const removeOffset = useCallback((addressId: string, offsetIndex: number) => {
    setMemoryAddresses(prev => prev.map(addr => {
      if (addr.id === addressId) {
        const updatedOffsets = [...(addr.offsets || [])];
        updatedOffsets.splice(offsetIndex, 1);
        return {
          ...addr,
          offsets: updatedOffsets
        };
      }
      return addr;
    }));
  }, []);

  const updateAddressesWithResults = useCallback((results: MemoryAddress[]) => {
    setMemoryAddresses(results);
  }, []);

  const clearMemoryAddresses = useCallback(() => {
    setMemoryAddresses([]);
    clearOriginalAddresses();
  }, [clearOriginalAddresses]);

  const moveMemoryAddress = useCallback((dragIndex: number, hoverIndex: number) => {
    setMemoryAddresses(prevAddresses => {
      const newAddresses = [...prevAddresses];
      const draggedItem = prevAddresses[dragIndex];
      
      newAddresses.splice(dragIndex, 1);
      newAddresses.splice(hoverIndex, 0, draggedItem);
      
      return newAddresses;
    });
  }, []);

  return {
    memoryAddresses,
    setMemoryAddresses: setMemoryAddressesWithOriginal,
    newAddress,
    setNewAddress,
    usePointerChain,
    setUsePointerChain,
    offsets,
    currentOffset,
    setCurrentOffset,
    newOffset,
    setNewOffset,
    isAddressFormValid,
    toggleUseModuleOffset,
    updateNewAddressField,
    addMemoryAddress,
    removeMemoryAddress,
    updateMemoryAddressField,
    addNewOffset,
    removeNewOffset,
    clearNewOffsets,
    addOffset,
    removeOffset,
    updateAddressesWithResults,
    clearMemoryAddresses,
    moveMemoryAddress,
    clearOriginalAddresses
  };
}
