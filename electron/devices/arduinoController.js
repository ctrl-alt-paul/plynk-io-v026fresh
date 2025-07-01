
const { SerialPort } = require('serialport');
const { logger } = require('../logger');
const { logEvent } = require('../loggerBridge');

/**
 * Arduino Controller
 * Handles communication with Arduino devices via serial port
 */
class ArduinoController {
  constructor() {
    this.portMap = new Map();
  }
  
  /**
   * List available serial ports
   * @returns {Promise<Array<{path: string, manufacturer?: string, vendorId?: string, productId?: string, serialNumber?: string}>>}
   */
  async listSerialPorts() {
    try {
      // Add platform-specific information for debugging
      const platform = process.platform;
      
      // Check if SerialPort is properly loaded
      if (!SerialPort || !SerialPort.list) {
        const errorMsg = 'SerialPort module not properly loaded';
        logEvent('warning', `Arduino list ports error: ${errorMsg}`);
        return [];
      }
      
      // Attempt to list ports with additional error handling
      const ports = await SerialPort.list();
      
      return ports;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
      
      logEvent('warning', `Arduino list serial ports failed: ${errorMessage}`);
      
      return [];
    }
  }
  
  /**
   * Get connection status for a list of known Arduino devices
   * @param {Array<{comPort: string, baudRate: number}>} knownDevices Array of known devices with comPort and baudRate
   * @returns {Promise<Array<{comPort: string, connected: boolean}>>} Promise resolving to array of devices with connection status
   */
  async getArduinoConnectionStates(knownDevices) {
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      logEvent('warning', `Arduino connection states check failed: ${errorMessage}`);
      
      // Return all devices as disconnected in case of error
      return knownDevices.map(device => ({
        comPort: device.comPort,
        connected: false
      }));
    }
  }
  
  /**
   * Opens a serial port with the specified parameters
   * @param {string} comPort COM port identifier (e.g., "COM4" on Windows, "/dev/ttyACM0" on Linux)
   * @param {number} baudRate Communication speed (e.g., 9600, 115200)
   * @returns {SerialPort|null} SerialPort instance or null if error
   */
  openSerialPort(comPort, baudRate) {
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
      
      // Add error event listener to capture port errors
      port.on('error', (error) => {
        logEvent('warning', `Arduino serial port error on ${comPort}: ${error.message}`);
      });
      
      // Store in map for potential reuse
      this.portMap.set(portKey, port);
      
      return port;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logEvent('warning', `Arduino open serial port failed for ${comPort} at ${baudRate} baud: ${errorMessage}`);
      return null;
    }
  }
  
  /**
   * Sends a message to an Arduino device
   * @param {string} comPort COM port identifier
   * @param {number} baudRate Communication speed
   * @param {string} message Message to send
   * @returns {Promise<{success: boolean, error?: string}>} Promise that resolves when message is sent
   */
  async sendSerialMessage(comPort, baudRate, message) {
    let port = null;
    
    try {
      port = this.openSerialPort(comPort, baudRate);
      
      if (!port) {
        const errorMsg = `Failed to open serial port ${comPort}`;
        logEvent('warning', `Arduino send message failed: ${errorMsg}`);
        return { 
          success: false, 
          error: errorMsg
        };
      }
      
      // Send message exactly as provided without adding newline
      return new Promise((resolve) => {
        port.write(message, (error) => {
          if (error) {
            const errorMsg = `Write error on ${comPort}: ${error.message}`;
            logEvent('warning', `Arduino send message write error: ${errorMsg}`);
            resolve({ success: false, error: error.message });
          } else {
            resolve({ success: true });
          }
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logEvent('warning', `Arduino send serial message failed for ${comPort}: ${errorMessage}`);
      return { 
        success: false, 
        error: errorMessage
      };
    }
  }
  
  /**
   * Tests if a connection to an Arduino is possible
   * @param {string} comPort COM port identifier
   * @param {number} baudRate Communication speed
   * @returns {Promise<boolean>} Promise resolving to true if connection successful
   */
  async testConnection(comPort, baudRate) {
    let port = null;
    
    try {
      port = this.openSerialPort(comPort, baudRate);
      
      if (!port) {
        logEvent('warning', `Arduino test connection failed: could not open port ${comPort} at ${baudRate} baud`);
        return false;
      }
      
      // If we got here, the port opened successfully
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logEvent('warning', `Arduino test connection error for ${comPort} at ${baudRate} baud: ${errorMessage}`);
      return false;
    }
  }
  
  /**
   * Closes all open serial ports
   */
  closeAllPorts() {
    try {
      for (const [key, port] of this.portMap.entries()) {
        if (port && port.isOpen) {
          port.close();
        }
      }
      this.portMap.clear();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logEvent('warning', `Arduino close all ports error: ${errorMessage}`);
    }
  }
}

// Export singleton instance
const arduinoController = new ArduinoController();
module.exports = { arduinoController };
