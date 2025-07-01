
import { SerialPort } from 'serialport';
import { logger } from '../logger';

/**
 * Arduino Controller
 * Handles communication with Arduino devices via serial port
 */
class ArduinoController {
  private portMap: Map<string, SerialPort> = new Map();
  
  /**
   * List available serial ports
   * @returns Promise resolving to array of available serial port information
   */
  public async listSerialPorts(): Promise<Array<{
    path: string;
    manufacturer?: string;
    vendorId?: string;
    productId?: string;
    serialNumber?: string;
  }>> {
    try {
      // Add platform-specific information for debugging
      const platform = process.platform;
      
      // Check if SerialPort is properly loaded
      if (!SerialPort || !SerialPort.list) {
        return [];
      }
      
      // Attempt to list ports with additional error handling
      const ports = await SerialPort.list();
      
      return ports;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
      
      return [];
    }
  }
  
  /**
   * Get connection status for a list of known Arduino devices
   * @param knownDevices Array of known devices with comPort and baudRate
   * @returns Promise resolving to array of devices with connection status
   */
  public async getArduinoConnectionStates(knownDevices: { comPort: string; baudRate: number }[]): Promise<{ comPort: string; connected: boolean }[]> {
    try {
      // Get all currently available ports
      const ports = await SerialPort.list();
      const availablePorts = ports.map(p => p.path);
      
      // Map known devices to their connection status
      const connectionStates = knownDevices.map(device => {
        const isConnected = availablePorts.includes(device.comPort);
        return {
          comPort: device.comPort,
          connected: isConnected
        };
      });
      
      return connectionStates;
    } catch (error) {
      // Return all devices as disconnected in case of error
      return knownDevices.map(device => ({
        comPort: device.comPort,
        connected: false
      }));
    }
  }
  
  /**
   * Opens a serial port with the specified parameters
   * @param comPort COM port identifier (e.g., "COM4" on Windows, "/dev/ttyACM0" on Linux)
   * @param baudRate Communication speed (e.g., 9600, 115200)
   * @returns SerialPort instance or null if error
   */
  public openSerialPort(comPort: string, baudRate: number): SerialPort | null {
    try {
      // Generate a unique key for this port/baud combination
      const portKey = `${comPort}-${baudRate}`;
      
      // Check if we already have an open port
      if (this.portMap.has(portKey)) {
        const existingPort = this.portMap.get(portKey);
        // If port exists and is open, return it
        if (existingPort && existingPort.isOpen) {
          return existingPort;
        } else {
          // If port exists but is closed, remove it
          this.portMap.delete(portKey);
        }
      }
      
      // Create a new port
      const port = new SerialPort({
        path: comPort,
        baudRate: baudRate,
        autoOpen: true
      });
      
      // Store in map for potential reuse
      this.portMap.set(portKey, port);
      
      return port;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Sends a message to an Arduino device
   * @param comPort COM port identifier
   * @param baudRate Communication speed
   * @param message Message to send
   * @returns Promise that resolves when message is sent
   */
  public async sendSerialMessage(
    comPort: string, 
    baudRate: number, 
    message: string
  ): Promise<{ success: boolean; error?: string }> {
    let port: SerialPort | null = null;
    
    try {
      port = this.openSerialPort(comPort, baudRate);
      
      if (!port) {
        return { 
          success: false, 
          error: `Failed to open serial port ${comPort}` 
        };
      }
      
      // Send message exactly as provided without adding newline
      return new Promise((resolve) => {
        port!.write(message, (error) => {
          if (error) {
            resolve({ success: false, error: error.message });
          } else {
            resolve({ success: true });
          }
        });
      });
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Tests if a connection to an Arduino is possible
   * @param comPort COM port identifier
   * @param baudRate Communication speed
   * @returns Promise resolving to true if connection successful
   */
  public async testConnection(
    comPort: string, 
    baudRate: number
  ): Promise<boolean> {
    let port: SerialPort | null = null;
    
    try {
      port = this.openSerialPort(comPort, baudRate);
      
      if (!port) {
        return false;
      }
      
      // If we got here, the port opened successfully
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Closes all open serial ports
   */
  public closeAllPorts(): void {
    try {
      for (const [key, port] of this.portMap.entries()) {
        if (port && port.isOpen) {
          port.close();
        }
      }
      this.portMap.clear();
    } catch (error) {
      // Error closing serial ports
    }
  }
}

// Export singleton instance
export const arduinoController = new ArduinoController();
