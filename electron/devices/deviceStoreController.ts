
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../logger';
import { app } from 'electron';
import { Device } from '../../src/types/devices';

// Define the path to the device store file
function getDeviceStorePath(): string {
  const appPath = app.getAppPath();
  const projectRoot = path.dirname(appPath);
  return path.join(projectRoot, 'public', 'devices', 'deviceStore.json');
}

/**
 * Reads the device store from the JSON file
 * @returns Promise<Device[]> Array of devices
 */
export async function readDeviceStore(): Promise<Device[]> {
  try {
    const storePath = getDeviceStorePath();
    
    // Ensure the directory exists
    const storeDir = path.dirname(storePath);
    try {
      await fs.mkdir(storeDir, { recursive: true });
    } catch (err) {
      // Directory already exists or cannot be created
    }
    
    // Check if file exists
    try {
      await fs.access(storePath);
    } catch (err) {
      // File doesn't exist, return empty array
      return [];
    }
    
    // Read and parse the file
    const data = await fs.readFile(storePath, 'utf-8');
    const devices = JSON.parse(data);
    return devices;
  } catch (error) {
    // Return empty array in case of error
    return [];
  }
}

/**
 * Writes the device store to the JSON file
 * @param devices Array of devices to write
 * @returns Promise<void>
 */
export async function writeDeviceStore(devices: Device[]): Promise<void> {
  try {
    const storePath = getDeviceStorePath();
    
    // Ensure the directory exists
    const storeDir = path.dirname(storePath);
    await fs.mkdir(storeDir, { recursive: true });
    
    // Write the file
    const data = JSON.stringify(devices, null, 2);
    await fs.writeFile(storePath, data, 'utf-8');
  } catch (error) {
    throw error;
  }
}
