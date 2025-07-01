
/**
 * Serial Dispatcher
 * 
 * Sends values to Serial devices via serial communication.
 * Uses the Electron IPC bridge to communicate with the backend.
 */

import { isElectron } from '../utils/isElectron';

/**
 * Dispatches a value to a Serial device via serial port
 * 
 * @param comPort - COM port identifier (e.g., "COM4" on Windows, "/dev/ttyACM0" on Linux)
 * @param baudRate - Communication speed (e.g., 9600, 115200)
 * @param value - The value to send (will be converted to string)
 * @returns Promise that resolves when sending completes or rejects with error
 */
export async function dispatchToArduino(
  comPort: string,
  baudRate: number,
  value: number | string | object | null | undefined
): Promise<void> {
  if (!isElectron()) {
    //console.error('Serial dispatch only supported in Electron environment');
    throw new Error('Serial dispatch only supported in Electron environment');
  }
  
  try {
    // Ensure we have a value to send, use "0" if null/undefined
    let valueToSend: string;
    
    if (value === null || value === undefined) {
      valueToSend = "0";
      //console.log(`Dispatching default "0" to Serial device (${comPort}:${baudRate}) because value was null/undefined`);
    } else if (typeof value === 'object' && value !== null) {
      // Extract value from object if possible
      if ('value' in value) {
        const objValue = (value as {value: any}).value;
        valueToSend = objValue === null || objValue === undefined ? "0" : String(objValue);
      } else {
        // If can't extract value property, use "0"
        valueToSend = "0";
      }
    } else {
      // Use the value directly if it's a primitive
      valueToSend = String(value);
    }
      
    //console.log(`Dispatching to Serial device (${comPort}:${baudRate}): ${valueToSend}`);
    
    // Use the sendSerialMessage function directly instead of the arduino.sendMessage namespace
    const result = await window.electron?.sendSerialMessage(comPort, baudRate, valueToSend);
    
    // Check if the operation was successful
    if (!result?.success) {
      throw new Error(result?.error || 'Failed to send message to Serial device');
    }
    
    //console.log(`Successfully dispatched value to Serial device (${comPort}:${baudRate})`);
  } catch (error) {
    //console.error(`Error dispatching to Serial device (${comPort}:${baudRate}): ${error}`);
    throw error;
  }
}
