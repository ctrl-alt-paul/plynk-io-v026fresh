
/**
 * Device Status Service
 * Monitors device connection status and logs relevant events to the device log category
 */

const { logEvent } = require('../loggerBridge');
const { readDeviceStore } = require('../devices/deviceStoreController');
const { pacDriveController } = require('../devices/pacDriveController');
const { arduinoController } = require('../devices/arduinoController');

let lastKnownDeviceStates = new Map();
let isMonitoring = false;
let monitoringInterval = null;
let healthReportCounter = 0;

/**
 * Start monitoring device connection status
 * @param {number} intervalMs - Monitoring interval in milliseconds (default: 30 seconds)
 */
function startDeviceStatusMonitoring(intervalMs = 30000) {
  if (isMonitoring) {
    return;
  }

  isMonitoring = true;
  logEvent('device', 'Device status monitoring started');

  // Log initial device inventory and system diagnostics
  setTimeout(async () => {
    await logInitialDeviceInventory();
    await logSystemDeviceDiagnostics();
  }, 1000);

  // Initial device scan
  checkAllDeviceStatus();

  // Set up periodic monitoring
  monitoringInterval = setInterval(async () => {
    await checkAllDeviceStatus();
    
    // Every 5th cycle (2.5 minutes), log comprehensive health report
    healthReportCounter++;
    if (healthReportCounter >= 5) {
      await logDeviceHealthReport();
      healthReportCounter = 0;
    }
  }, intervalMs);
}

/**
 * Stop monitoring device connection status
 */
function stopDeviceStatusMonitoring() {
  if (!isMonitoring) {
    return;
  }

  isMonitoring = false;
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }

  logEvent('device', 'Device status monitoring stopped');
}

/**
 * Log initial device inventory on startup
 */
async function logInitialDeviceInventory() {
  try {
    const devices = await readDeviceStore();
    
    if (devices.length === 0) {
      logEvent('device', 'Device inventory: No devices configured');
      return;
    }

    logEvent('device', `Device inventory: ${devices.length} configured device(s)`);
    
    for (const device of devices) {
      const deviceInfo = await getDetailedDeviceInfo(device);
      logEvent('device', `Inventory - ${device.type}: ${device.name || device.id} | ${deviceInfo}`);
    }
  } catch (error) {
    logEvent('device', `Error logging device inventory: ${error.message}`);
  }
}

/**
 * Log system-level device diagnostics
 */
async function logSystemDeviceDiagnostics() {
  try {
    // Log PacDrive system status
    if (pacDriveController.isDllLoaded()) {
      const status = pacDriveController.getStatus();
      const diagnostics = pacDriveController.getDllDiagnostics();
      logEvent('device', `PacDrive system: DLL loaded=${status.dllLoaded}, initialized=${status.initialized}, device count=${status.deviceCount}`);
      logEvent('device', `PacDrive DLL: ${diagnostics.dllPath}, exists=${diagnostics.dllExists}`);
    } else {
      logEvent('device', `PacDrive system: DLL not available (${pacDriveController.getDllError()})`);
    }

    // Log Arduino system status
    try {
      const ports = await arduinoController.listSerialPorts();
      logEvent('device', `Arduino system: ${ports.length} serial port(s) available`);
      
      if (ports.length > 0) {
        const portDetails = ports.map(port => 
          `${port.path}${port.manufacturer ? ` (${port.manufacturer})` : ''}`
        ).join(', ');
        logEvent('device', `Available serial ports: ${portDetails}`);
      }
    } catch (error) {
      logEvent('device', `Arduino system: Error scanning ports - ${error.message}`);
    }

  } catch (error) {
    logEvent('device', `Error in system diagnostics: ${error.message}`);
  }
}

/**
 * Get detailed device information string
 */
async function getDetailedDeviceInfo(device) {
  try {
    switch (device.type) {
      case 'PacDrive':
        return `Device ID: ${device.deviceId || 'N/A'}, Channels: ${device.channels || 'Unknown'}, USB: ${device.usbPath || 'N/A'}`;
      
      case 'Arduino':
        return `COM Port: ${device.comPort}, Baud Rate: ${device.baudRate || 9600}, Protocol: ${device.protocol || 'Standard'}`;
      
      case 'WLED':
        return `IP: ${device.ipAddress}, Segments: ${device.segmentCount || 'Unknown'}, Total LEDs: ${device.totalLEDs || 'Unknown'}`;
      
      default:
        return 'Configuration details not available';
    }
  } catch (error) {
    return `Error getting device details: ${error.message}`;
  }
}

/**
 * Log comprehensive device health report
 */
async function logDeviceHealthReport() {
  try {
    const devices = await readDeviceStore();
    const summary = {
      total: devices.length,
      connected: 0,
      disconnected: 0,
      byType: {}
    };

    for (const device of devices) {
      const isConnected = await checkSingleDeviceStatus(device);
      const responseTime = await measureDeviceResponseTime(device);
      
      if (isConnected) {
        summary.connected++;
      } else {
        summary.disconnected++;
      }

      if (!summary.byType[device.type]) {
        summary.byType[device.type] = { total: 0, connected: 0 };
      }
      
      summary.byType[device.type].total++;
      if (isConnected) {
        summary.byType[device.type].connected++;
      }

      // Log individual device health details
      const healthInfo = `${device.name || device.id} (${device.type}): ${isConnected ? 'ONLINE' : 'OFFLINE'}${responseTime ? `, response: ${responseTime}ms` : ''}`;
      logEvent('device', `Health check - ${healthInfo}`);
    }

    // Log overall health summary
    const typeReport = Object.entries(summary.byType)
      .map(([type, stats]) => `${type}: ${stats.connected}/${stats.total}`)
      .join(', ');
    
    logEvent('device', `Health report summary: ${summary.connected}/${summary.total} devices online | ${typeReport}`);

  } catch (error) {
    logEvent('device', `Error generating health report: ${error.message}`);
  }
}

/**
 * Measure device response time for health reporting
 */
async function measureDeviceResponseTime(device) {
  try {
    const startTime = Date.now();
    await checkSingleDeviceStatus(device);
    return Date.now() - startTime;
  } catch (error) {
    return null;
  }
}

/**
 * Check the connection status of all devices
 */
async function checkAllDeviceStatus() {
  try {
    const devices = await readDeviceStore();
    const statusChanges = [];

    for (const device of devices) {
      const currentStatus = await checkSingleDeviceStatus(device);
      const lastStatus = lastKnownDeviceStates.get(device.id);

      // Only log if status has changed
      if (lastStatus !== currentStatus) {
        const deviceDetails = await getDetailedDeviceInfo(device);
        statusChanges.push({
          device: device.name || device.id,
          type: device.type,
          details: deviceDetails,
          oldStatus: lastStatus === undefined ? 'unknown' : (lastStatus ? 'connected' : 'disconnected'),
          newStatus: currentStatus ? 'connected' : 'disconnected'
        });

        lastKnownDeviceStates.set(device.id, currentStatus);
      }
    }

    // Log status changes with detailed information
    if (statusChanges.length > 0) {
      for (const change of statusChanges) {
        logEvent('device', `Status change: ${change.device} (${change.type}) ${change.oldStatus} → ${change.newStatus} | ${change.details}`);
      }
    }

  } catch (error) {
    logEvent('device', `Error checking device status: ${error.message}`);
  }
}

/**
 * Check the connection status of a single device
 * @param {Object} device - Device configuration object
 * @returns {Promise<boolean>} Connection status
 */
async function checkSingleDeviceStatus(device) {
  try {
    switch (device.type) {
      case 'PacDrive':
        if (pacDriveController.isDllLoaded() && pacDriveController.getStatus().initialized) {
          return pacDriveController.testDeviceConnection(device.deviceId || device.usbPath);
        }
        return false;

      case 'Arduino':
        if (device.comPort) {
          return await arduinoController.testConnection(device.comPort, device.baudRate || 9600);
        }
        return false;

      case 'WLED':
        if (device.ipAddress) {
          return await pingWLEDDevice(device.ipAddress);
        }
        return false;

      default:
        return false;
    }
  } catch (error) {
    return false;
  }
}

/**
 * Simple ping test for WLED devices
 * @param {string} ipAddress - IP address of the WLED device
 * @returns {Promise<boolean>} Connection status
 */
async function pingWLEDDevice(ipAddress) {
  try {
    const fetch = require('node-fetch');
    const response = await fetch(`http://${ipAddress}/json/info`, {
      timeout: 3000,
      method: 'GET'
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Log device discovery events with enhanced details
 * @param {string} deviceType - Type of device being discovered
 * @param {Array} foundDevices - Array of discovered devices
 * @param {Object} scanDetails - Additional scan information
 */
function logDeviceDiscovery(deviceType, foundDevices, scanDetails = {}) {
  const scanTime = scanDetails.scanTime ? ` (${scanDetails.scanTime}ms)` : '';
  
  if (foundDevices.length > 0) {
    logEvent('device', `${deviceType} discovery${scanTime}: Found ${foundDevices.length} device(s)`);
    
    // Log details of each discovered device
    foundDevices.forEach((device, index) => {
      let deviceInfo = '';
      if (typeof device === 'object') {
        if (deviceType === 'Arduino Serial Port') {
          deviceInfo = `${device.path || device.comName}${device.manufacturer ? ` (${device.manufacturer})` : ''}${device.vendorId ? ` VID:${device.vendorId}` : ''}`;
        } else if (deviceType === 'PacDrive') {
          deviceInfo = `Device ${device} (Index: ${index})`;
        } else {
          deviceInfo = device.name || device.id || device.toString();
        }
      } else {
        deviceInfo = device.toString();
      }
      logEvent('device', `  └─ Found: ${deviceInfo}`);
    });
  } else {
    logEvent('device', `${deviceType} discovery${scanTime}: No devices found`);
  }
}

/**
 * Log device configuration events with enhanced details
 * @param {string} action - Action performed (added, updated, removed)
 * @param {Object} device - Device object
 * @param {Object} details - Additional configuration details
 */
async function logDeviceConfiguration(action, device, details = {}) {
  const deviceInfo = `${device.name || device.id} (${device.type})`;
  const additionalInfo = await getDetailedDeviceInfo(device);
  
  switch (action) {
    case 'added':
      logEvent('device', `Device added: ${deviceInfo} | ${additionalInfo}`);
      break;
    case 'updated':
      logEvent('device', `Device updated: ${deviceInfo} | ${additionalInfo}`);
      if (details.changes) {
        logEvent('device', `  └─ Changes: ${details.changes}`);
      }
      break;
    case 'removed':
      logEvent('device', `Device removed: ${deviceInfo}`);
      break;
    default:
      logEvent('device', `Device ${action}: ${deviceInfo} | ${additionalInfo}`);
  }
}

/**
 * Log device test results with enhanced details
 * @param {Object} device - Device being tested
 * @param {boolean} success - Test result
 * @param {string} details - Additional test details
 * @param {number} responseTime - Test response time in milliseconds
 */
function logDeviceTest(device, success, details = '', responseTime = null) {
  const deviceInfo = `${device.name || device.id} (${device.type})`;
  const result = success ? 'PASSED' : 'FAILED';
  const timing = responseTime ? ` (${responseTime}ms)` : '';
  const message = details ? ` - ${details}` : '';
  
  logEvent('device', `Device test: ${deviceInfo} ${result}${timing}${message}`);
}

/**
 * Log device operation events (output dispatching, commands, etc.)
 * @param {Object} device - Device being operated on
 * @param {string} operation - Type of operation
 * @param {Object} operationData - Operation details
 * @param {boolean} success - Operation success
 */
function logDeviceOperation(device, operation, operationData, success) {
  const deviceInfo = `${device.name || device.id} (${device.type})`;
  const result = success ? 'SUCCESS' : 'FAILED';
  const opDetails = JSON.stringify(operationData);
  
  logEvent('device', `Device operation: ${deviceInfo} ${operation} ${result} | Data: ${opDetails}`);
}

/**
 * Get current device status summary
 * @returns {Promise<Object>} Status summary
 */
async function getDeviceStatusSummary() {
  try {
    const devices = await readDeviceStore();
    const summary = {
      total: devices.length,
      connected: 0,
      disconnected: 0,
      byType: {}
    };

    for (const device of devices) {
      const isConnected = await checkSingleDeviceStatus(device);
      
      if (isConnected) {
        summary.connected++;
      } else {
        summary.disconnected++;
      }

      if (!summary.byType[device.type]) {
        summary.byType[device.type] = { total: 0, connected: 0 };
      }
      
      summary.byType[device.type].total++;
      if (isConnected) {
        summary.byType[device.type].connected++;
      }
    }

    return summary;
  } catch (error) {
    return { total: 0, connected: 0, disconnected: 0, byType: {} };
  }
}

module.exports = {
  startDeviceStatusMonitoring,
  stopDeviceStatusMonitoring,
  checkAllDeviceStatus,
  checkSingleDeviceStatus,
  logDeviceDiscovery,
  logDeviceConfiguration,
  logDeviceTest,
  logDeviceOperation,
  getDeviceStatusSummary
};
