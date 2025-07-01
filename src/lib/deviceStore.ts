
import { BaseDevice, PacDriveDevice, Device, ArduinoDevice, WLEDDevice } from '../types/devices.d';
import { v4 as uuid } from 'uuid';

/**
 * Type guard for PacDrive devices
 */
export function isPacDriveDevice(device: any): device is PacDriveDevice {
  return device && device.type === 'PacDrive';
}

/**
 * Type guard for Arduino devices
 */
export function isArduinoDevice(device: any): device is ArduinoDevice {
  return device && device.type === 'Arduino';
}

/**
 * Type guard for WLED devices
 */
export function isWLEDDevice(device: any): device is WLEDDevice {
  return device && device.type === 'WLED';
}

/**
 * Log device configuration changes to backend
 */
function logDeviceConfigurationChange(action: string, device: Device) {
  if (window.electron?.logDeviceConfiguration) {
    window.electron.logDeviceConfiguration(action, device);
  }
}

/**
 * In-memory store for devices
 */
let devices: Device[] = [];

/**
 * Flag to track if devices have been loaded from storage
 */
let devicesLoaded = false;

/**
 * Load devices from persistent storage
 */
async function loadDevices(): Promise<Device[]> {
  if (!window.electron) {
    return [];
  }

  try {
    const loadedDevices = await window.electron.readDeviceStore();
    devices = loadedDevices || [];
    
    // Add mock Arduino devices for development if none exist
    if (!devices.some(isArduinoDevice)) {
      const mockArduinoDevices: ArduinoDevice[] = [
        {
          id: uuid(),
          name: "Serial Device",
          type: "Arduino",
          comPort: "COM3",
          baudRate: 9600,
          protocol: "Serial",
          connected: false,
          usbPath: "COM3"
        },
        {
          id: uuid(),
          name: "Serial Controller",
          type: "Arduino",
          comPort: "COM4",
          baudRate: 115200,
          protocol: "Serial",
          connected: false,
          usbPath: "COM4"
        }
      ];
      
      devices.push(...mockArduinoDevices);
    }
    
    // Add mock WLED devices for development if none exist
    if (!devices.some(isWLEDDevice)) {
      const mockWLEDDevices: WLEDDevice[] = [
        {
          id: uuid(),
          name: "WLED Cabinet",
          type: "WLED",
          ipAddress: "192.168.1.100",
          segmentCount: 4,
          totalLEDs: 120,
          ledsPerSegment: [30, 30, 30, 30],
          connected: false
        },
        {
          id: uuid(),
          name: "WLED Marquee",
          type: "WLED",
          ipAddress: "192.168.1.101",
          segmentCount: 2,
          totalLEDs: 60,
          ledsPerSegment: [30, 30],
          connected: false
        }
      ];
      
      devices.push(...mockWLEDDevices);
    }
    
    await saveDevices(); // Save the mock devices to storage
    
    devicesLoaded = true;
    return [...devices];
  } catch (error) {
    return [...devices];
  }
}

/**
 * Get all Arduino devices from the store
 */
export function getArduinoDevices(): ArduinoDevice[] {
  return devices.filter(isArduinoDevice);
}

/**
 * Get all WLED devices from the store
 */
export function getWLEDDevices(): WLEDDevice[] {
  return devices.filter(isWLEDDevice);
}

/**
 * Save devices to persistent storage
 */
async function saveDevices(): Promise<boolean> {
  if (!window.electron) {
    return false;
  }

  try {
    await window.electron.writeDeviceStore(devices);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get all devices from the store
 */
export async function getDevices(): Promise<Device[]> {
  // Load devices from storage if not already loaded
  if (!devicesLoaded) {
    return await loadDevices();
  }
  return [...devices];
}

/**
 * Get all devices from the store (synchronous version)
 * Note: This may return an empty array if devices haven't been loaded yet
 */
export function getDevicesSync(): Device[] {
  return [...devices];
}

/**
 * Find a device by IP address (specifically for WLED devices)
 * This helper function makes it easier to match devices to profiles
 */
export function findWLEDDeviceByIP(ipAddress: string): WLEDDevice | undefined {
  if (!ipAddress) return undefined;
  
  return devices.find(
    device => isWLEDDevice(device) && device.ipAddress === ipAddress
  ) as WLEDDevice | undefined;
}

/**
 * Add a new device to the store
 */
export async function addDevice(device: Device): Promise<Device> {
  // Ensure devices are loaded before adding
  if (!devicesLoaded) {
    await loadDevices();
  }

  // Generate an ID if one doesn't exist
  const id = device.id || uuid();
  
  // Create a new device with the correct type-specific properties
  let newDevice: Device;
  
  // Fix the type checks by explicitly checking the type property
  if (isPacDriveDevice(device)) {
    newDevice = {
      ...device,
      id,
      type: "PacDrive" as const
    };
  } else if (isArduinoDevice(device)) {
    newDevice = {
      ...device,
      id,
      type: "Arduino" as const
    };
  } else if (isWLEDDevice(device)) {
    newDevice = {
      ...device,
      id,
      type: "WLED" as const
    };
  } else {
    // Handle unknown device types with proper typing
    // Use a type assertion to avoid the 'never' type error
    const unknownDevice = device as Partial<Device>;
    const deviceType = String(unknownDevice?.type || 'unknown');
    throw new Error(`Unknown device type: ${deviceType}`);
  }
  
  devices.push(newDevice);
  
  // Save the updated devices to storage
  await saveDevices();
  
  // Log the device addition
  logDeviceConfigurationChange('added', newDevice);
  
  return newDevice;
}

/**
 * Update a device in the store
 */
export async function editDevice(id: string, updates: Partial<Device>): Promise<Device | null> {
  // Ensure devices are loaded before updating
  if (!devicesLoaded) {
    await loadDevices();
  }

  const index = devices.findIndex(device => device.id === id);
  
  if (index === -1) return null;
  
  const existingDevice = devices[index];
  
  // Create updated device with the correct type preserved
  let updatedDevice: Device;
  
  // Use the type guards for safer type checking
  if (isPacDriveDevice(existingDevice)) {
    updatedDevice = {
      ...existingDevice,
      ...updates,
      type: "PacDrive" as const
    } as PacDriveDevice;
  } 
  else if (isArduinoDevice(existingDevice)) {
    updatedDevice = {
      ...existingDevice,
      ...updates,
      type: "Arduino" as const
    } as ArduinoDevice;
  }
  else if (isWLEDDevice(existingDevice)) {
    updatedDevice = {
      ...existingDevice,
      ...updates,
      type: "WLED" as const
    } as WLEDDevice;
  }
  else {
    // Safely handle the case that should never happen but prevents the 'never' type error
    // Use a type assertion to avoid the 'never' type error
    const unknownDevice = existingDevice as Partial<BaseDevice>;
    const deviceType = String(unknownDevice?.type || 'unknown');
    throw new Error(`Unknown device type: ${deviceType}`);
  }
  
  devices[index] = updatedDevice;
  
  // Save the updated devices to storage
  await saveDevices();
  
  // Log the device update
  logDeviceConfigurationChange('updated', updatedDevice);
  
  return updatedDevice;
}

/**
 * Remove a device from the store
 */
export async function removeDevice(id: string): Promise<boolean> {
  // Ensure devices are loaded before removing
  if (!devicesLoaded) {
    await loadDevices();
  }

  const initialLength = devices.length;
  const index = devices.findIndex(device => device.id === id);
  
  if (index === -1) return false;
  
  const deviceToRemove = devices[index];
  devices.splice(index, 1);
  
  // Save the updated devices to storage
  await saveDevices();
  
  // Log the device removal
  logDeviceConfigurationChange('removed', deviceToRemove);
  
  return devices.length < initialLength;
}

/**
 * Update just the connection state of a device
 */
export async function updateDeviceConnectionState(id: string, connected: boolean): Promise<Device | null> {
  // Ensure devices are loaded before updating
  if (!devicesLoaded) {
    await loadDevices();
  }

  const index = devices.findIndex(device => device.id === id);
  
  if (index === -1) return null;
  
  // Just update the connected property
  devices[index] = {
    ...devices[index],
    connected
  };
  
  // Save the updated devices to storage
  await saveDevices();
  
  return devices[index];
}

/**
 * Export the device store and its helper functions
 */
export const deviceStore = {
  getDevices,
  getDevicesSync,
  getArduinoDevices,
  getWLEDDevices,
  addDevice,
  editDevice,
  removeDevice,
  loadDevices,
  saveDevices,
  isPacDriveDevice,
  isArduinoDevice,
  isWLEDDevice,
  findWLEDDeviceByIP,
  updateDeviceConnectionState
};
