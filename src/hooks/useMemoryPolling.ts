import { useRef, useState, useCallback, useEffect } from "react";
import { useMemoryData } from "./useMemoryData";
import { MemoryAddress, PerformanceSettings } from "@/types/memoryAddress";

// Define the expected response type from memory reading
interface MemoryReadResult {
  id?: string | number;
  value: number | null;
  success: boolean;
  error?: string;
}

export function useMemoryPolling(onPollResults: (addresses: MemoryAddress[]) => void) {
  const pollingControllerRef = useRef<{ stop: () => void } | null>(null);
  const memoryAddressesRef = useRef<MemoryAddress[]>([]);
  const { readMemoryAddresses } = useMemoryData();
  const [isPolling, setIsPolling] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [disableCaching, setDisableCaching] = useState(false);
  const [fastModeEnabled, setFastModeEnabled] = useState(false);
  const [batchSize, setBatchSize] = useState(20); // Default batch size
  const [priorityThrottling, setPriorityThrottling] = useState(false);
  const [adaptivePolling, setAdaptivePolling] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<{
    lastPollDuration: number;
    avgPollDuration: number;
    pollsPerSecond: number;
    skippedPolls: number;
    batchesUsed: number;
    addressCount: number;
  }>({
    lastPollDuration: 0,
    avgPollDuration: 0,
    pollsPerSecond: 0,
    skippedPolls: 0,
    batchesUsed: 0,
    addressCount: 0
  });
  
  const MAX_CONSECUTIVE_ERRORS = 5;
  const pollDurationsRef = useRef<number[]>([]);
  const pollCountRef = useRef<{count: number, timestamp: number}>({ count: 0, timestamp: Date.now() });
  const lastPollTimeRef = useRef<number>(0);
  const lastSystemLoadCheckRef = useRef<number>(0);
  const systemLoadRef = useRef<number>(0); // 0-1 value representing system load
  
  // New ref to track polling in progress status to prevent overlap
  const pollInProgressRef = useRef<boolean>(false);
  const skippedPollsRef = useRef<number>(0);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingControllerRef.current) {
        pollingControllerRef.current.stop();
      }
    };
  }, []);

  // Calculate and update performance metrics
  const updatePerformanceMetrics = useCallback((duration: number, batchCount: number, addressCount: number) => {
    pollDurationsRef.current.push(duration);
    // Keep only last 10 measurements
    if (pollDurationsRef.current.length > 10) {
      pollDurationsRef.current.shift();
    }
    
    // Calculate average duration
    const avgDuration = pollDurationsRef.current.reduce((sum, val) => sum + val, 0) / 
                        pollDurationsRef.current.length;
    
    // Calculate polls per second
    pollCountRef.current.count++;
    const now = Date.now();
    const elapsed = now - pollCountRef.current.timestamp;
    
    if (elapsed >= 1000) { // Update once per second
      const pps = (pollCountRef.current.count / elapsed) * 1000;
      pollCountRef.current = { count: 0, timestamp: now };
      
      setPerformanceMetrics({
        lastPollDuration: duration,
        avgPollDuration: avgDuration,
        pollsPerSecond: pps,
        skippedPolls: skippedPollsRef.current,
        batchesUsed: batchCount,
        addressCount: addressCount
      });
    }
  }, []);

  // New function to estimate system load
  const updateSystemLoad = useCallback((pollDuration: number, targetInterval: number) => {
    const now = Date.now();
    if (now - lastSystemLoadCheckRef.current > 5000) { // Check every 5 seconds
      // Calculate load as ratio of poll duration to target interval
      // Higher values indicate higher load
      const loadEstimate = Math.min(1, pollDuration / targetInterval);
      systemLoadRef.current = loadEstimate * 0.3 + systemLoadRef.current * 0.7; // Smooth the values
      lastSystemLoadCheckRef.current = now;
    }
  }, []);

  // Function to determine optimal batch size based on system load
  const getOptimalBatchSize = useCallback(() => {
    if (!adaptivePolling) return batchSize;
    
    // Adjust batch size based on system load
    if (systemLoadRef.current > 0.8) {
      // High load - reduce batch size
      return Math.max(5, Math.floor(batchSize * 0.5));
    } else if (systemLoadRef.current < 0.3) {
      // Low load - increase batch size
      return Math.min(50, Math.floor(batchSize * 1.5));
    }
    return batchSize;
  }, [adaptivePolling, batchSize]);

  const startPolling = useCallback(async (intervalMs: number, processName: string, addresses: MemoryAddress[]) => {
    if (isPolling) return;

    // Reset state on new polling start
    setErrorCount(0);
    setLastError(null); // Clear any previous errors
    pollDurationsRef.current = [];
    pollCountRef.current = { count: 0, timestamp: Date.now() };
    skippedPollsRef.current = 0;
    pollInProgressRef.current = false;
    lastSystemLoadCheckRef.current = 0;
    systemLoadRef.current = 0.5; // Start with medium load assumption
    
    // Store the initial addresses for reference during polling
    memoryAddressesRef.current = [...addresses];
    
    setIsPolling(true);

    // ← clear any stale data immediately
    onPollResults([]);

    let active = true;
    let consecutiveErrors = 0;
    
    pollingControllerRef.current = {
      stop: () => {
        active = false;
        setIsPolling(false);
      },
    };

    const poll = async () => {
      while (active) {
        // Skip this iteration if a poll is already in progress
        if (pollInProgressRef.current) {
          skippedPollsRef.current++;
          // Use short delay to check again soon
          await new Promise((resolve) => setTimeout(resolve, Math.max(16, intervalMs / 10)));
          continue;
        }
        
        pollInProgressRef.current = true;
        const pollStartTime = performance.now();
        const currentPollTime = Date.now(); // Single timestamp for this polling cycle
        
        try {
          // Check if enough time has elapsed since last poll
          const timeSinceLastPoll = currentPollTime - lastPollTimeRef.current;
          if (lastPollTimeRef.current > 0 && timeSinceLastPoll < intervalMs * 0.8) {
            const waitTime = intervalMs - timeSinceLastPoll;
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
          
          lastPollTimeRef.current = currentPollTime;
          
          // Get optimal batch size for this polling cycle
          const currentBatchSize = getOptimalBatchSize();
          
          // Sort addresses by priority if priority throttling is enabled
          let addressesToPoll = [...memoryAddressesRef.current];
          if (priorityThrottling) {
            addressesToPoll.sort((a, b) => {
              const priorityValues = { high: 0, normal: 1, low: 2 };
              const aPriority = a.priority ? priorityValues[a.priority] : 1;
              const bPriority = b.priority ? priorityValues[b.priority] : 1;
              return aPriority - bPriority;
            });
            
            // In high load situations, skip low priority addresses
            if (systemLoadRef.current > 0.8) {
              addressesToPoll = addressesToPoll.filter(addr => addr.priority !== "low");
            }
          }
          
          // Group addresses by batch group if specified
          const batchGroups: { [key: string]: MemoryAddress[] } = {};
          addressesToPoll.forEach(addr => {
            if (addr.batchGroup) {
              if (!batchGroups[addr.batchGroup]) {
                batchGroups[addr.batchGroup] = [];
              }
              batchGroups[addr.batchGroup].push(addr);
            }
          });
          
          // Process addresses in batches
          let processedAddresses: MemoryAddress[] = [];
          let batchCount = 0;
          
          // First process batch groups to keep related addresses together
          for (const groupName in batchGroups) {
            const group = batchGroups[groupName];
            for (let i = 0; i < group.length; i += currentBatchSize) {
              const batch = group.slice(i, i + currentBatchSize);
              
              // Add id to each address to match results later
              const addressesWithId = batch.map((addr, index) => ({
                ...addr,
                useModuleOffset: addr.useModuleOffset,
                // FIX: Ensure moduleName is always included especially for module offset addresses
                moduleName: addr.moduleName || (addr.useModuleOffset ? processName : ""),
                index: `${batchCount}-${index}`,
                fastModeEnabled: fastModeEnabled,
                disableCaching: disableCaching
              }));
              
              // Process this batch
              const batchResults = await readMemoryAddresses(processName, addressesWithId, disableCaching);
              
              // Apply results
              const updatedAddresses = batch.map((original, idx) => {
                const resultIndex = `${batchCount}-${idx}`;
                const updated = batchResults.find(u => u.id === resultIndex || u.id === original.id);
                
                if (updated) {
                  const updatedMemoryResult = updated as unknown as MemoryReadResult & { lastRead: Date };
                  
                  // FIX: Make sure to preserve the moduleName
                  const updatedAddress = {
                    ...original,
                    value: updatedMemoryResult.value,
                    rawValue: updatedMemoryResult.value,
                    lastRead: new Date(currentPollTime),
                    success: updatedMemoryResult.success,
                    error: updatedMemoryResult.error,
                    finalValue: null, // Let useMemoryReader apply transformations
                    // FIX: Ensure moduleName is preserved from original address
                    moduleName: original.moduleName || (original.useModuleOffset ? processName : "")
                  };
                  return updatedAddress;
                }
                return original;
              });
              
              processedAddresses = [...processedAddresses, ...updatedAddresses];
              batchCount++;
            }
          }
          
          // Process remaining addresses (those without batch groups)
          const remainingAddresses = addressesToPoll.filter(addr => !addr.batchGroup);
          for (let i = 0; i < remainingAddresses.length; i += currentBatchSize) {
            const batch = remainingAddresses.slice(i, i + currentBatchSize);
            
            // Add id to each address to match results later
            const addressesWithId = batch.map((addr, index) => ({
              ...addr,
              useModuleOffset: addr.useModuleOffset,
              // FIX: Ensure moduleName is always included especially for module offset addresses
              moduleName: addr.moduleName || (addr.useModuleOffset ? processName : ""),
              index: `${batchCount}-${index}`,
              fastModeEnabled: fastModeEnabled,
              disableCaching: disableCaching
            }));
            
            // Process this batch
            const batchResults = await readMemoryAddresses(processName, addressesWithId, disableCaching);
            
            // Apply results
            const updatedAddresses = batch.map((original, idx) => {
              const resultIndex = `${batchCount}-${idx}`;
              const updated = batchResults.find(u => u.id === resultIndex || u.id === original.id);
              
              if (updated) {
                const updatedMemoryResult = updated as unknown as MemoryReadResult & { lastRead: Date };
                
                // FIX: Make sure to preserve the moduleName
                const updatedAddress = {
                  ...original,
                  value: updatedMemoryResult.value,
                  rawValue: updatedMemoryResult.value,
                  lastRead: new Date(currentPollTime),
                  success: updatedMemoryResult.success,
                  error: updatedMemoryResult.error,
                  finalValue: null, // Let useMemoryReader apply transformations
                  // FIX: Ensure moduleName is preserved from original address
                  moduleName: original.moduleName || (original.useModuleOffset ? processName : "")
                };
                return updatedAddress;
              }
              return original;
            });
            
            processedAddresses = [...processedAddresses, ...updatedAddresses];
            batchCount++;
          }
          
          // Handle addresses that were skipped due to priority throttling
          const totalAddressCount = memoryAddressesRef.current.length;
          const skippedAddresses = memoryAddressesRef.current.filter(
            addr => !processedAddresses.some(pa => pa.id === addr.id)
          );
          
          // Keep skipped addresses in result but mark them appropriately
          const finalAddresses = [
            ...processedAddresses,
            ...skippedAddresses.map(addr => ({
              ...addr,
              skipped: true
            }))
          ];
          
          // Reset error counter on successful read
          consecutiveErrors = 0;
          setLastError(null); // Clear error on successful poll
          
          if (onPollResults && active) {
            onPollResults([...finalAddresses]);
          }
          
          // Update performance metrics
          const pollDuration = performance.now() - pollStartTime;
          updatePerformanceMetrics(pollDuration, batchCount, totalAddressCount);
          
          // Update system load estimate
          updateSystemLoad(pollDuration, intervalMs);
          
        } catch (error) {
          //console.error("Polling error:", error);
          consecutiveErrors++;
          
          // Set the last error message
          const errorMessage = error instanceof Error ? error.message : String(error);
          setLastError(errorMessage);
          
          // Update error count state for potential UI feedback
          setErrorCount(prev => prev + 1);
          
          // Auto-stop polling if too many consecutive errors
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS && active) {
            //console.warn(`Stopping polling after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`);
            active = false;
            setIsPolling(false);
            
            // ← clear stale “null/success:false” data so UI goes blank
            onPollResults([]);

            break;
          }
        } finally {
          pollInProgressRef.current = false;
        }
        
        const pollDuration = performance.now() - pollStartTime;
        const remainingTime = Math.max(0, intervalMs - pollDuration);
        
        if (active && remainingTime > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingTime));
        }
      }
    };

    poll();
  }, [isPolling, readMemoryAddresses, onPollResults, disableCaching, fastModeEnabled, updatePerformanceMetrics, updateSystemLoad, getOptimalBatchSize, priorityThrottling, adaptivePolling]);

  const stopPolling = useCallback(() => {
    if (pollingControllerRef.current) {
      pollingControllerRef.current.stop();
    }
  }, []);

  // Toggle caching option
  const toggleCaching = useCallback(() => {
    setDisableCaching(prev => !prev);
  }, []);
  
  // Toggle Fast Mode option
  const toggleFastMode = useCallback(() => {
    setFastModeEnabled(prev => !prev);
  }, []);
  
  // Toggle Priority Throttling
  const togglePriorityThrottling = useCallback(() => {
    setPriorityThrottling(prev => !prev);
  }, []);
  
  // Toggle Adaptive Polling
  const toggleAdaptivePolling = useCallback(() => {
    setAdaptivePolling(prev => !prev);
  }, []);
  
  // Set batch size
  const updateBatchSize = useCallback((size: number) => {
    if (size >= 1 && size <= 100) {
      setBatchSize(size);
    }
  }, []);

  // Update performance settings
  const updatePerformanceSettings = useCallback((settings: Partial<PerformanceSettings>) => {
    if (settings.disableCaching !== undefined) setDisableCaching(settings.disableCaching);
    if (settings.fastModeEnabled !== undefined) setFastModeEnabled(settings.fastModeEnabled);
    if (settings.batchSize !== undefined && settings.batchSize >= 1) setBatchSize(settings.batchSize);
    if (settings.priorityThrottling !== undefined) setPriorityThrottling(settings.priorityThrottling);
    if (settings.adaptivePolling !== undefined) setAdaptivePolling(settings.adaptivePolling);
  }, []);
  
  // Get current performance settings
  const getPerformanceSettings = useCallback((): PerformanceSettings => {
    return {
      disableCaching,
      fastModeEnabled,
      batchSize,
      priorityThrottling,
      adaptivePolling
    };
  }, [disableCaching, fastModeEnabled, batchSize, priorityThrottling, adaptivePolling]);

  return {
    isPolling,
    errorCount,
    performanceMetrics,
    // Add lastError to the return object
    lastError,
    // Basic settings
    disableCaching,
    fastModeEnabled,
    // Advanced settings
    batchSize,
    priorityThrottling,
    adaptivePolling,
    // Setting controls
    toggleCaching,
    toggleFastMode,
    togglePriorityThrottling,
    toggleAdaptivePolling,
    updateBatchSize,
    // Bulk controls
    updatePerformanceSettings,
    getPerformanceSettings,
    // Main functions
    startPolling,
    stopPolling
  };
}
