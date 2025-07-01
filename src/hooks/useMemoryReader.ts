
import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  applyTransformations, 
  omit, 
  isValidMemoryAddress, 
  validateBitwiseOp, 
  isValidAddressForMemoryReading, 
  prepareAddressForMemoryReading 
} from "@/renderer/utils/memoryUtils";
import { MemoryAddress, bitwiseOperations, PerformanceSettings } from "@/types/memoryAddress";
import { useMemoryPolling } from "@/hooks/useMemoryPolling";

interface UseMemoryReaderProps {
  onAddressesUpdate: (addresses: MemoryAddress[]) => void;
}

export function useMemoryReader({ onAddressesUpdate }: UseMemoryReaderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPollEnabled, setIsPollEnabled] = useState(false);
  const [pollInterval, setPollInterval] = useState(1000);
  const [debugLoggingEnabled, setDebugLoggingEnabled] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  
  // Basic performance settings
  const [disableCaching, setDisableCaching] = useState(false);
  const [fastModeEnabled, setFastModeEnabled] = useState(false);
  
  // Advanced performance settings
  const [batchSize, setBatchSize] = useState(20);
  const [priorityThrottling, setPriorityThrottling] = useState(false);
  const [adaptivePolling, setAdaptivePolling] = useState(false);
  
  const {
    isPolling,
    errorCount,
    performanceMetrics,
    // Pass through settings to polling hook
    disableCaching: pollingDisableCaching,
    fastModeEnabled: pollingFastModeEnabled,
    batchSize: pollingBatchSize,
    priorityThrottling: pollingPriorityThrottling,
    adaptivePolling: pollingAdaptivePolling,
    // Pass through control functions
    startPolling,
    stopPolling,
    toggleCaching,
    toggleFastMode,
    togglePriorityThrottling,
    toggleAdaptivePolling,
    updateBatchSize,
    // Bulk controls
    updatePerformanceSettings,
    getPerformanceSettings,
    // New error handling
    lastError: pollingLastError
  } = useMemoryPolling((updatedAddresses) => {
    // Apply transformations since they weren't applied during polling
    const transformedAddresses = updatedAddresses.map(addr => {
      // Get the raw value from the address
      const rawValue = addr.value;
      
      // Apply transformations (always apply since finalValue is now null from polling)
      // Fix: Add null checks and default values for all parameters
      const finalValue = applyTransformations(
        rawValue, 
        addr.invert || false, 
        addr.script || '', 
        addr.format || ''
      );
      
      return {
        ...addr,
        rawValue,
        finalValue
      };
    });
    
    // Send the transformed addresses to the caller
    onAddressesUpdate(transformedAddresses);
    
    // Show toast if there are polling errors
    if (errorCount > 0 && errorCount % 5 === 0) {
      toast.error(`Memory polling encountered ${errorCount} errors`, {
        id: 'polling-errors',
        duration: 3000
      });
    }
    
    // Update last error from polling
    if (pollingLastError) {
      setLastError(pollingLastError);
    }
  });

  // Sync settings with polling hook
  useEffect(() => {
    if (disableCaching !== pollingDisableCaching) {
      toggleCaching();
    }
  }, [disableCaching, pollingDisableCaching, toggleCaching]);
  
  useEffect(() => {
    if (fastModeEnabled !== pollingFastModeEnabled) {
      toggleFastMode();
    }
  }, [fastModeEnabled, pollingFastModeEnabled, toggleFastMode]);
  
  useEffect(() => {
    if (batchSize !== pollingBatchSize) {
      updateBatchSize(batchSize);
    }
  }, [batchSize, pollingBatchSize, updateBatchSize]);
  
  useEffect(() => {
    if (priorityThrottling !== pollingPriorityThrottling) {
      togglePriorityThrottling();
    }
  }, [priorityThrottling, pollingPriorityThrottling, togglePriorityThrottling]);
  
  useEffect(() => {
    if (adaptivePolling !== pollingAdaptivePolling) {
      toggleAdaptivePolling();
    }
  }, [adaptivePolling, pollingAdaptivePolling, toggleAdaptivePolling]);

  // Update all performance settings at once
  const updateAllPerformanceSettings = useCallback((settings: Partial<PerformanceSettings>) => {
    if (settings.disableCaching !== undefined) setDisableCaching(settings.disableCaching);
    if (settings.fastModeEnabled !== undefined) setFastModeEnabled(settings.fastModeEnabled);
    if (settings.batchSize !== undefined) setBatchSize(settings.batchSize);
    if (settings.priorityThrottling !== undefined) setPriorityThrottling(settings.priorityThrottling);
    if (settings.adaptivePolling !== undefined) setAdaptivePolling(settings.adaptivePolling);
    
    // Also update in polling hook
    updatePerformanceSettings(settings);
  }, [updatePerformanceSettings]);

  const handleStartPolling = useCallback(async (selectedProcess: string | null, memoryAddresses: MemoryAddress[]) => {
    // Clear any previous errors
    setLastError(null);
    
    if (!selectedProcess || memoryAddresses.length === 0) {
      const errorMsg = !selectedProcess 
        ? "Please select a process before starting polling" 
        : "Please add at least one memory address before starting polling";
      
      toast.error(errorMsg);
      setLastError(errorMsg);
      return;
    }
    
    // Enhanced validation with improved error reporting
    const invalidAddresses: { address: MemoryAddress; error: string }[] = [];
    const validAddresses: any[] = [];
    
    // First validate all addresses
    for (const addr of memoryAddresses) {
      // Use our enhanced preparation function that includes validation
      const result = prepareAddressForMemoryReading(addr, selectedProcess);
      
      if (!result.isValid || !result.preparedAddress) {
        invalidAddresses.push({
          address: addr,
          error: result.error || "Unknown validation error"
        });
      } else {
        validAddresses.push({
          ...result.preparedAddress,
          id: addr.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          label: addr.label || "",
          // Ensure we maintain the correct module name
          moduleName: addr.moduleName,
          useModuleOffset: addr.useModuleOffset,
          // Add these fields that are needed by the address manager
          value: addr.value,
          rawValue: addr.rawValue,
          finalValue: addr.finalValue,
          lastRead: addr.lastRead,
          error: addr.error,
          success: addr.success,
          invert: Boolean(addr.invert),
          format: addr.format || "",
          script: addr.script || "",
        });
      }
    }
    
    // If any addresses are invalid, report the error and abort polling
    if (invalidAddresses.length > 0) {
      //console.error("Invalid memory addresses:", invalidAddresses);
      const firstError = invalidAddresses[0];
      const errorMsg = `Invalid address: ${firstError.address.label || "Unnamed address"} - ${firstError.error}` +
        (invalidAddresses.length > 1 ? ` (and ${invalidAddresses.length - 1} more)` : "");
      
      toast.error(errorMsg);
      setLastError(errorMsg);
      return;
    }
    
    // If there are no valid addresses (very unlikely at this point), abort
    if (validAddresses.length === 0) {
      toast.error("No valid addresses to poll");
      setLastError("No valid addresses to poll");
      return;
    }
    
    try {
      setIsPollEnabled(true);
      await startPolling(pollInterval, selectedProcess, validAddresses);
      
      // Update toast message based on mode
      let modeMsg = fastModeEnabled ? " in Fast Mode" : "";
      if (adaptivePolling) modeMsg += " with Adaptive Polling";
      
      toast.success(`Started polling${modeMsg} at ${pollInterval}ms intervals`);
    } catch (error) {
      //console.error("Failed to start polling:", error);
      const errorMsg = "Failed to start polling: " + (error instanceof Error ? error.message : String(error));
      toast.error(errorMsg);
      setLastError(errorMsg);
      setIsPollEnabled(false);
    }
  }, [
    pollInterval, 
    startPolling, 
    fastModeEnabled, 
    disableCaching,
    adaptivePolling
  ]);
  
  const handleStopPolling = useCallback(() => {
    stopPolling();
    setIsPollEnabled(false);
    toast.info("Polling stopped");
    // Clear any error state when stopping
    setLastError(null);
  }, [stopPolling]);
  
  const readMemory = useCallback(async (selectedProcess: string | null, memoryAddresses: MemoryAddress[]) => {
    // Clear previous errors
    setLastError(null);
    
    if (!selectedProcess || memoryAddresses.length === 0) {
      const errorMsg = !selectedProcess 
        ? "Please select a process before reading memory" 
        : "Please add at least one memory address before reading memory";
      
      toast.warning(errorMsg);
      setLastError(errorMsg);
      return;
    }
    
    // Enhanced validation for single read
    const invalidAddresses: { address: MemoryAddress; error: string }[] = [];
    
    try {
      setIsLoading(true);
      const results = await Promise.all(memoryAddresses.map(async addr => {
        // Use our enhanced preparation function before sending to IPC
        const prepared = prepareAddressForMemoryReading(addr, selectedProcess);
        
        if (!prepared.isValid || !prepared.preparedAddress) {
          invalidAddresses.push({
            address: addr,
            error: prepared.error || "Unknown validation error"
          });
          
          // Return a failed result for this address
          return {
            ...omit(addr, []),
            value: null,
            rawValue: null,
            finalValue: null,
            lastRead: new Date(),
            error: prepared.error || "Address validation failed",
            success: false
          } as MemoryAddress;
        }
        
        if (window.electron) {
          try {
            // Now using the fully validated address
            const addressToUse = prepared.preparedAddress;
            
            // Now using the batch-enabled endpoint if available
            const useBatch = window.electron.ipcRenderer.invoke.length > 0 && 
                             typeof window.electron.ipcRenderer.invoke === 'function';
            
            let result;
            if (useBatch) {
              // Use the batch endpoint for better performance
              const batchResults = await window.electron.ipcRenderer.invoke(
                "read-memory-batch", 
                selectedProcess, 
                [{ ...addressToUse, id: addr.id }]
              );
              result = batchResults[0] || { success: false, error: "No result returned" };
            } else {
              // Fallback to individual reads
              result = await window.electron.ipcRenderer.invoke(
                "read-memory", 
                selectedProcess, 
                addressToUse, 
                addr.type
              );
            }
            
            if (debugLoggingEnabled) {
              //console.log('Memory read result:', {
              //  address: addr,
              //  result
              //});
            }
            
            const rawValue = result.success ? result.value : null;
            const finalValue = applyTransformations(rawValue, addr.invert, addr.script, addr.format);
            
            return {
              ...addr,
              ...omit(result, []),
              value: rawValue,
              rawValue: rawValue,
              finalValue: finalValue,
              lastRead: new Date(),
              error: result.error,
              success: result.success,
              // Preserve original module name and other fields
              moduleName: addr.moduleName,
              useModuleOffset: addr.useModuleOffset
            } as MemoryAddress;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            
            // Record this in our error tracking
            if (errorMsg.includes('BigInt')) {
              setLastError(`BigInt conversion error: ${errorMsg}`);
            }
            
            return {
              ...addr,
              value: null,
              rawValue: null,
              finalValue: null,
              lastRead: new Date(),
              error: errorMsg,
              success: false,
              // Preserve original fields
              moduleName: addr.moduleName,
              useModuleOffset: addr.useModuleOffset
            } as MemoryAddress;
          }
        }
        return addr;
      }));
      
      // If we have validation errors, show them after the read completes
      if (invalidAddresses.length > 0) {
        //console.error("Some addresses could not be read due to validation errors:", invalidAddresses);
        const firstError = invalidAddresses[0];
        const errorMsg = `Invalid address: ${firstError.address.label || "Unnamed address"} - ${firstError.error}` +
          (invalidAddresses.length > 1 ? ` (and ${invalidAddresses.length - 1} more)` : "");
          
        toast.error(errorMsg);
        setLastError(errorMsg);
      }
      
      // Add debug logging
      if (debugLoggingEnabled) {
        //console.log('Updated addresses:', results);
        const missingModuleNames = results.filter(a => a.useModuleOffset && (!a.moduleName || a.moduleName.trim() === ''));
        if (missingModuleNames.length > 0) {
          //console.warn('Addresses missing module names:', missingModuleNames);
        }
      }
      
      onAddressesUpdate(results as MemoryAddress[]);
    } catch (error) {
      const errorMsg = "Failed to read memory values: " + (error instanceof Error ? error.message : String(error));
      toast.error(errorMsg);
      setLastError(errorMsg);
      //console.error("Memory read error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [debugLoggingEnabled, onAddressesUpdate, fastModeEnabled, disableCaching]);

  // Toggle performance options
  const toggleFastModeOption = useCallback(() => {
    setFastModeEnabled(prev => !prev);
  }, []);
  
  const togglePriorityThrottlingOption = useCallback(() => {
    setPriorityThrottling(prev => !prev);
  }, []);
  
  const toggleAdaptivePollingOption = useCallback(() => {
    setAdaptivePolling(prev => !prev);
  }, []);

  return {
    isLoading,
    setIsLoading,
    isPollEnabled,
    isPolling,
    pollInterval,
    setPollInterval,
    debugLoggingEnabled,
    setDebugLoggingEnabled,
    // Error reporting
    lastError,
    // Basic performance settings
    disableCaching,
    setDisableCaching,
    fastModeEnabled,
    toggleFastMode: toggleFastModeOption,
    // Advanced performance settings
    batchSize, 
    setBatchSize,
    priorityThrottling,
    togglePriorityThrottling: togglePriorityThrottlingOption,
    adaptivePolling,
    toggleAdaptivePolling: toggleAdaptivePollingOption,
    // All settings together
    updatePerformanceSettings: updateAllPerformanceSettings,
    getPerformanceSettings,
    // Performance metrics
    performanceMetrics,
    // Main functions
    handleStartPolling,
    handleStopPolling,
    readMemory,
    errorCount
  };
}
