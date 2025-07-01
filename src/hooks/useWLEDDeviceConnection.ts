
import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { fetchWLEDEffects, fetchWLEDDeviceInfo, getDefaultEffects } from '@/lib/wledProfiles';
import { storeDeviceSegments, getDeviceSegments } from '@/lib/wledSegmentUtils';

// Define the hook
export const useWLEDDeviceConnection = () => {
  const [ipAddress, setIpAddress] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [effects, setEffects] = useState<any[]>([]);
  const [availableSegments, setAvailableSegments] = useState<number[]>([]);

  // Function to connect to a WLED device
  const connectToDevice = useCallback(async (ip: string): Promise<boolean> => {
    setIsLoading(true);
    setIpAddress(ip);
    
    // Log connection attempt
    if (window.electron) {
      window.electron.ipcRenderer?.send('log:frontend-event', {
        category: 'wled',
        message: `WLED ${ip} - Connection: Attempting to connect to device...`,
        timestamp: new Date().toISOString()
      });
    }
    
    try {
      // Fetch effects and device info in parallel
      const [liveEffects, liveSegments] = await Promise.all([
        fetchWLEDEffects(ip),
        fetchWLEDDeviceInfo(ip)
      ]);
      
      setEffects(liveEffects);
      setAvailableSegments(liveSegments);
      
      // Store the live segments in our central segment store
      storeDeviceSegments(ip, liveSegments);
      
      setIsConnected(true);
      
      // Log successful connection
      if (window.electron) {
        window.electron.ipcRenderer?.send('log:frontend-event', {
          category: 'wled',
          message: `WLED ${ip} - Connection: SUCCESS - Connected with ${liveEffects.length} effects and ${liveSegments.length} segments`,
          timestamp: new Date().toISOString()
        });
      }
      
      toast({
        title: "Connected to WLED Device",
        description: `Successfully connected to ${ip}`,
      });
      
      return true; // Return true on success
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      setIsConnected(false);
      
      // Log connection failure
      if (window.electron) {
        window.electron.ipcRenderer?.send('log:frontend-error', {
          category: 'wled',
          message: `WLED ${ip} - Connection: FRONTEND ERROR - ${errorMessage}`,
          timestamp: new Date().toISOString()
        });
      }
      
      toast({
        title: "Connection Failed",
        description: `Could not connect to WLED device: ${errorMessage}`,
        variant: "destructive",
      });
      
      return false; // Return false on failure
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Function to disconnect from a WLED device
  const disconnectDevice = useCallback(() => {
    // Log disconnection
    if (window.electron && ipAddress) {
      window.electron.ipcRenderer?.send('log:frontend-event', {
        category: 'wled',
        message: `WLED ${ipAddress} - Connection: Device disconnected by user`,
        timestamp: new Date().toISOString()
      });
    }
    
    setIsConnected(false);
    setIpAddress('');
    setEffects([]);
    setAvailableSegments([]);
    toast({
      title: "Disconnected",
      description: "Disconnected from WLED device",
    });
  }, [ipAddress]);

  // Function to check if currently connected to a specific IP
  const isConnectedTo = useCallback((ip: string) => {
    return isConnected && ipAddress === ip;
  }, [isConnected, ipAddress]);
  
  // Fetch live effects and segments
  const fetchLiveEffectsAndSegments = useCallback(async (ip: string) => {
    try {
      const [liveEffects, liveSegments] = await Promise.all([
        fetchWLEDEffects(ip),
        fetchWLEDDeviceInfo(ip)
      ]);
      
      setEffects(liveEffects);
      setAvailableSegments(liveSegments);
      
      // Store the live segments in our central segment store
      storeDeviceSegments(ip, liveSegments);
      
      // Log successful refresh
      if (window.electron) {
        window.electron.ipcRenderer?.send('log:frontend-event', {
          category: 'wled',
          message: `WLED ${ip} - Refresh: SUCCESS - Updated effects and segments`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Log refresh failure
      if (window.electron) {
        window.electron.ipcRenderer?.send('log:frontend-error', {
          category: 'wled',
          message: `WLED ${ip} - Refresh: FRONTEND ERROR - ${errorMessage}`,
          timestamp: new Date().toISOString()
        });
      }
      
      toast({
        title: "Error Fetching Data",
        description: `Could not fetch effects and segments: ${errorMessage}`,
        variant: "destructive",
      });
    }
  }, []);

  // New function to set profile segments - updated to store segments by device IP
  const setProfileSegments = useCallback((deviceIP: string, segments: number[]) => {
    //console.log(`Setting segments for device ${deviceIP}:`, segments);
    if (deviceIP && segments && segments.length > 0) {
      // Store segments for this device IP
      storeDeviceSegments(deviceIP, segments);
    }
  }, []);

  // Automatically attempt to connect when the IP address changes
  useEffect(() => {
    if (ipAddress) {
      connectToDevice(ipAddress);
    }
  }, [ipAddress, connectToDevice]);
  
  // Make sure that availableEffects always has at least the default effects when disconnected
  const effectsData = isConnected ? effects : getDefaultEffects();
  
  // Use device segments when disconnected instead of just [0]
  // This is the key change - we're now getting segments by IP, not profile
  const segmentsData = isConnected ? availableSegments : getDeviceSegments(ipAddress);

  // Return these values in your hook's return object
  return {
    ipAddress,
    isConnected,
    isLoading,
    effects: effectsData,
    availableSegments: segmentsData,
    connectToDevice,
    disconnectDevice,
    isConnectedTo,
    fetchLiveEffectsAndSegments,
    setProfileSegments
  };
};
