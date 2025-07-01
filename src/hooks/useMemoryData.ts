
import { useState, useEffect } from 'react';

// Define types for memory data
export interface MemoryProfileOutput {
  label: string;
  type: string;
  address: string;
  notes?: string;
}

export interface MemoryProfile {
  id: string;
  fileName: string;
  outputs: MemoryProfileOutput[];
}

export interface MemoryData {
  [key: string]: number | string | boolean;
}

// Interface for memory address request object
interface MemoryAddressRequest {
  moduleName?: string;
  offset?: string;
  offsetFormat?: string;
  address?: string;
  customSize?: number;
  bitmask?: string;
  bitwiseOp?: string;
  bitfield?: boolean;
  offsets?: string[];
  isPointerChain?: boolean;
  type?: string;
  index?: number;
  id?: string | number;
  disableCaching?: boolean; // Flag to disable caching
  priority?: string; // Priority level for memory reading
  batchGroup?: string; // Group identifier for batch processing
  useModuleOffset?: boolean; // Flag to indicate if address is module-relative
}

// Interface for memory read results
interface MemoryReadResult {
  id?: string | number;
  value: number | null;
  success: boolean;
  error?: string;
}

// Type guard to check if window.electron exists
const isElectron = (): boolean => {
  return window && 'electron' in window;
};

/**
 * A hook to handle memory data, either from Electron IPC or mock data
 * @param profile The current memory profile to use
 * @returns Object containing memory data and source information
 */
export function useMemoryData(profile: MemoryProfile | null = null) {
  const [memoryData, setMemoryData] = useState<MemoryData>({});
  const [isLiveData, setIsLiveData] = useState<boolean>(false);
  
  // Function to read memory addresses - used by useMemoryPolling
  const readMemoryAddresses = async (
    processName: string,
    addresses: any[],
    disableCaching: boolean = false
  ) => {
    if (!isElectron() || !window.electron) {
      //console.warn("Not in Electron environment, cannot read memory");
      return [];
    }

    try {
      // IMPROVED: Pre-process and validate addresses before sending to IPC
      const processedAddresses = addresses.map(addr => {
        const addressCopy = { ...addr };

        if (addressCopy.useModuleOffset) {
          if (!addressCopy.moduleName || addressCopy.moduleName.trim() === '') {
            //console.warn('Missing moduleName for address with useModuleOffset=true:', addressCopy);
            addressCopy.moduleName = processName;
          }
          if (!addressCopy.offset && addressCopy.address) {
            addressCopy.offset = addressCopy.address;
          }
        }

        return addressCopy;
      });

      // Group addresses by batch group if specified
      const batchGroups: { [key: string]: any[] } = { default: [] };
      processedAddresses.forEach(addr => {
        if (addr.batchGroup) {
          batchGroups[addr.batchGroup] = batchGroups[addr.batchGroup] || [];
          batchGroups[addr.batchGroup].push(addr);
        } else {
          batchGroups.default.push(addr);
        }
      });

      // Process each batch group
      let allResults: any[] = [];
      for (const groupKey of Object.keys(batchGroups)) {
        const groupAddresses = batchGroups[groupKey];
        if (groupAddresses.length === 0) continue;

        // Convert addresses to the format expected by Electron
        const addressRequests: MemoryAddressRequest[] = groupAddresses.map(addr => {
          let addressToUse: MemoryAddressRequest;

          if (addr.useModuleOffset) {
            if (!addr.moduleName || addr.moduleName.trim() === '') {
              //console.warn('Missing moduleName for address with useModuleOffset=true:', addr);
              addr.moduleName = processName;
            }
            if (!addr.offset) {
              //console.warn('Missing offset for address with useModuleOffset=true:', addr);
              addr.offset = addr.address;
            }
            addressToUse = {
              moduleName: addr.moduleName,
              offset: addr.offset,
              offsetFormat: addr.offsetFormat,
              customSize: addr.type === "CustomSize" ? addr.customSize : undefined,
              bitmask: addr.bitmask,
              bitwiseOp: addr.bitwiseOp,
              bitfield: addr.bitfield,
              type: addr.type,
              offsets: addr.offsets?.length ? addr.offsets : undefined,
              isPointerChain: addr.offsets?.length ? true : undefined,
              disableCaching,
              priority: addr.priority,
              batchGroup: addr.batchGroup,
              useModuleOffset: true
            };
          } else {
            addressToUse = {
              address: addr.address,
              bitmask: addr.bitmask,
              bitwiseOp: addr.bitwiseOp,
              bitfield: addr.bitfield,
              type: addr.type,
              offsets: addr.offsets?.length ? addr.offsets : undefined,
              isPointerChain: addr.offsets?.length ? true : undefined,
              disableCaching,
              priority: addr.priority,
              batchGroup: addr.batchGroup,
              useModuleOffset: false
            };
          }

          return {
            ...addressToUse,
            id: addr.index !== undefined ? addr.index : addr.id
          };
        });

        // Use batch memory read endpoint for better performance
        try {
          if (groupAddresses.some(addr => addr.useModuleOffset && (!addr.moduleName || !addr.offset))) {
            //console.warn(
            //  'Potentially invalid addresses being sent:',
            //  groupAddresses.filter(addr => addr.useModuleOffset && (!addr.moduleName || !addr.offset))
            //);
          }

          const response: any[] = await window.electron.ipcRenderer.invoke(
            "read-memory-batch",
            processName,
            addressRequests
          );

          const resultsWithTimestamp = response.map((result: any, index: number) => {
            const originalAddress = groupAddresses[index];
            return {
              ...result,
              moduleName: originalAddress.moduleName,
              useModuleOffset: originalAddress.useModuleOffset,
              offset: originalAddress.offset,
              lastRead: new Date()
            };
          });

          allResults = [...allResults, ...resultsWithTimestamp];
        } catch (error) {
          //console.error(`Error reading batch group "${groupKey}", aborting read:`, error);
          // Rethrow so the error bubbles up and no false data is injected
          throw error;
        }
      }

      return allResults;
    } catch (error) {
      //console.error("Error reading memory addresses:", error);
      throw error;
    }
  };

  
  useEffect(() => {
    // No profile ⇒ clear out and bail
    if (!profile) {
      setMemoryData({});
      //setIsLiveData(false);
      return;
    }

    // In Electron: hook up real-memory updates via IPC
    if (isElectron() && window.electron?.ipcRenderer) {
      setIsLiveData(true);

      const memoryUpdateHandler = (_event: any, data: MemoryData) => {
        setMemoryData(data);
      };

      window.electron.ipcRenderer.on('memory:update', memoryUpdateHandler);

      return () => {
        window.electron.ipcRenderer.removeListener('memory:update', memoryUpdateHandler);
      };
    }

    // Not in Electron: clear data, but do NOT fall back to mock
    //setIsLiveData(false);
    //setMemoryData({});
    return;
  }, [profile]);

  
  return { 
    memoryData, 
    isLiveData,
    sourceType: isLiveData ? 'Live Data' : 'Mock Data',
    readMemoryAddresses
  };
}


