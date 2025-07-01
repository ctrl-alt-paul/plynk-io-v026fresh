
// Import the necessary types and functions
import { PacDriveDevice, ArduinoDevice, WLEDDevice, Device, HidDeviceInfo } from '../types/devices';
import { deviceStore } from '../lib/deviceStore';

// Re-export the type guards from deviceStore
export const { isPacDriveDevice, isArduinoDevice, isWLEDDevice } = deviceStore;

/**
 * Extracts the device index from a USB path string.
 * @param usbPath The USB path string to extract the index from.
 * @returns The device index as a number, or -1 if the index cannot be extracted.
 */
export function extractDeviceIndex(usbPath: string | undefined): number {
  if (!usbPath) {
    return -1;
  }

  const match = usbPath.match(/(\d+)$/);
  if (match) {
    const index = parseInt(match[1], 10);
    return index;
  }

  return -1;
}

/**
 * Scans for PacDrive devices by attempting to connect to each possible index.
 * @returns A promise that resolves with an array of device indices that were successfully connected to.
 */
export async function scanForDevices(): Promise<number[]> {
  if (!window.electron) {
    return [];
  }

  const foundDevices: number[] = [];
  const maxDevices = 8; // Limiting the scan to a reasonable number of devices

  for (let i = 0; i < maxDevices; i++) {
    try {
      const success = await window.electron.testPacDriveDevice(i);
      if (success) {
        foundDevices.push(i);
      }
    } catch (error) {
      // Silent error handling
    }
  }

  return foundDevices;
}

/**
 * Lists all HID devices connected to the system.
 * @returns A promise that resolves with an array of HID device information objects.
 */
export async function listHidDevices(): Promise<any[]> {
  if (!window.electron) {
    return [];
  }

  try {
    const devices = await window.electron.listHidDevices();
    return devices;
  } catch (error) {
    return [];
  }
}

/**
 * Filters the list of HID devices to only include those that match PacDrive vendor/product IDs.
 * @param devices An array of HID device information objects.
 * @returns An array of HID device information objects that are likely PacDrive devices.
 */
export function filterPacDriveDevices(devices: HidDeviceInfo[]): HidDeviceInfo[] {
  return devices.filter(device => {
    // Convert string values to numbers for comparison if needed
    const vendorId = typeof device.vendorId === 'string' ? parseInt(device.vendorId, 16) : device.vendorId;
    const productId = typeof device.productId === 'string' ? parseInt(device.productId, 16) : device.productId;
    
    // Check if it's a PacDrive device based on vendor/product IDs
    return (vendorId === 0xD209 || vendorId === 53769) && 
           (productId === 0x1500 || productId === 0x1501 || productId === 5376);
  });
}

/**
 * Gets detailed debugging information about a device path.
 * @param path The device path to analyze.
 * @returns An object containing debug information about the path.
 */
export function getDevicePathDebugInfo(path: string): {
  result: number;
  formats: Record<string, boolean>;
  matches: Record<string, string | null>;
} {
  // Define regex patterns for different path formats
  const patterns = {
    simpleNumeric: /^(\d+)$/,
    windows: /\\\\\\?\\\S+#\S+#(\d+)$/,
    linuxHidraw: /\/dev\/hidraw(\d+)/,
    linuxHiddev: /\/dev\/usb\/hiddev(\d+)/,
    macOsPath: /\/dev\/\S+\.(\d+)/,
  };
  
  const matches: Record<string, string | null> = {};
  const formats: Record<string, boolean> = {};
  
  // Try all patterns and collect results
  for (const [name, pattern] of Object.entries(patterns)) {
    const match = path.match(pattern);
    formats[name] = !!match;
    matches[name] = match ? match[1] : null;
  }
  
  // Use extractDeviceIndex for the final result
  const result = extractDeviceIndex(path);
  
  return { result, formats, matches };
}

/**
 * Runs diagnostics on the PacDrive subsystem.
 * @returns A promise that resolves with diagnostic information.
 */
export async function runPacDriveDiagnostics(): Promise<any> {
  if (!window.electron) {
    return {
      platform: 'unknown',
      dllLoaded: false,
      apiAvailable: false,
      initSuccessful: false,
      deviceCount: 0,
      errorDetails: 'Electron API not available',
      suggestions: ['Make sure you are running in the Electron environment'],
      systemInfo: null
    };
  }
  
  try {
    // Get PacDrive status
    const pacDriveStatus = await window.electron.getPacDriveStatus();
    
    // Get system info
    const systemInfo = {
      platform: window.electron.platform || 'unknown',
      arch: window.navigator.platform,
      userAgent: window.navigator.userAgent
    };
    
    // Generate suggestions based on status
    const suggestions: string[] = [];
    
    if (!pacDriveStatus.dllLoaded) {
      suggestions.push('Check that PacDrive.dll exists in the correct location');
      suggestions.push('Verify that the DLL is not blocked by Windows security');
    }
    
    if (pacDriveStatus.dllLoaded && !pacDriveStatus.initialized) {
      suggestions.push('Ensure PacDrive devices are properly connected via USB');
      suggestions.push('Check that device drivers are installed correctly');
    }
    
    if (pacDriveStatus.deviceCount === 0) {
      suggestions.push('No PacDrive devices detected - check USB connections');
      suggestions.push('Try disconnecting and reconnecting the devices');
    }
    
    return {
      platform: systemInfo.platform,
      dllLoaded: pacDriveStatus.dllLoaded,
      apiAvailable: true,
      initSuccessful: pacDriveStatus.initialized,
      deviceCount: pacDriveStatus.deviceCount,
      errorDetails: pacDriveStatus.dllLoadError || pacDriveStatus.initializationError || null,
      suggestions,
      systemInfo
    };
  } catch (error) {
    return {
      platform: window.electron.platform || 'unknown',
      dllLoaded: false,
      apiAvailable: false,
      initSuccessful: false,
      deviceCount: 0,
      errorDetails: error instanceof Error ? error.message : 'Unknown error',
      suggestions: ['Try restarting the application', 'Check that PacDrive.dll is properly installed'],
      systemInfo: null
    };
  }
}

/**
 * Checks if a device is available based on its path or index.
 * @param pathOrIndex The device path or index to check.
 * @returns A promise that resolves with a boolean indicating if the device is available.
 */
export async function checkDeviceAvailability(pathOrIndex: string | number): Promise<boolean> {
  if (!window.electron) {
    return false;
  }
  
  // Convert string to number if it's a number string
  const deviceIndex = typeof pathOrIndex === 'string' 
    ? extractDeviceIndex(pathOrIndex)
    : pathOrIndex;
  
  if (deviceIndex < 0) {
    return false;
  }
  
  try {
    return await window.electron.testPacDriveDevice(deviceIndex);
  } catch (error) {
    return false;
  }
}

/**
 * Checks if a given path string is a valid PacDrive path format.
 * @param path The path string to validate.
 * @returns True if the path is valid, false otherwise.
 */
export function isValidPacDrivePath(path: string): boolean {
  // If it's just a number, it's valid
  if (/^\d+$/.test(path)) {
    return true;
  }
  
  // Check for common path formats
  const validFormats = [
    /^\/dev\/hidraw\d+$/, // Linux hidraw
    /^\/dev\/usb\/hiddev\d+$/, // Linux hiddev
    /^\/dev\/\S+\.\d+$/, // macOS pattern
    /^\\\\\\?\\\S+#\S+#\d+$/ // Windows pattern
  ];
  
  return validFormats.some(format => format.test(path));
}

/**
 * Gets the help text for device paths based on the current platform.
 * @param platform The current platform ('win32', 'linux', 'darwin', or other).
 * @returns Help text string for device paths.
 */
export function getDevicePathHelpText(platform: string): string {
  if (platform === 'win32') {
    return "On Windows, you can use a simple number (0-7) for the device index, or the full USB path.";
  } else if (platform === 'linux') {
    return "On Linux, specify the full device path (e.g., /dev/hidraw0) or a device index (0-7).";
  } else if (platform === 'darwin') {
    return "On macOS, specify the full device path or a device index (0-7).";
  } else {
    return "Specify a device index (0-7) or the platform-specific device path.";
  }
}

/**
 * Gets an example device path based on the current platform.
 * @param platform The current platform ('win32', 'linux', 'darwin', or other).
 * @returns Example device path string.
 */
export function getDevicePathExample(platform: string): string {
  if (platform === 'win32') {
    return "0 or \\\\?\\HID#VID_D209&PID_1500#...";
  } else if (platform === 'linux') {
    return "/dev/hidraw0 or 0";
  } else if (platform === 'darwin') {
    return "/dev/hidDevice.0 or 0";
  } else {
    return "0";
  }
}

/**
 * Checks if any devices of a specific type exist in the device list
 * @param devices List of devices to check
 * @param typeGuard Function to check if a device is of the desired type
 * @returns True if any devices of the specified type exist
 */
export function hasDevicesOfType<T extends Device>(
  devices: Device[], 
  typeGuard: (device: Device) => device is T
): boolean {
  return devices.some(typeGuard);
}
