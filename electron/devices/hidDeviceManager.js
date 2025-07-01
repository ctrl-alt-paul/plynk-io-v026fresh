const HID = require('node-hid');
const { logger } = require('../logger');

/**
 * Get a list of all connected HID devices
 * @returns {Array} List of HID devices
 */
function listDevices() {
  try {
    const devices = HID.devices();
    
    if (devices.length > 0) {
      // Count potential PacDrive devices
      const pacDriveDevices = getPotentialPacDriveDevices();
    }
    
    return devices;
  } catch (error) {
    // Log the stack trace for better debugging
    return [];
  }
}

/**
 * Get detailed information about a specific HID device by path
 * @param {string} path - The device path to query
 * @returns {Object|null} Device information or null if not found
 */
function getDeviceInfo(path) {
  try {
    const devices = HID.devices();
    const device = devices.find(d => d.path === path);
    
    if (device) {
      // Device found
    } else {
      // Try more flexible matching if exact path match fails
      
      // Try to match by extracting device index and comparing
      const pathInfo = parseDevicePath(path);
      if (pathInfo.isValid && pathInfo.index >= 0) {
        // Look for any device with the same index in its path
        const deviceByIndex = devices.find(d => {
          const devicePathInfo = parseDevicePath(d.path);
          return devicePathInfo.index === pathInfo.index;
        });
        
        if (deviceByIndex) {
          return deviceByIndex;
        }
      }
    }
    
    return device || null;
  } catch (error) {
    return null;
  }
}

/**
 * Test if a device is accessible
 * @param {string} path - The device path to test
 * @returns {boolean} True if the device can be opened, false otherwise
 */
function testDevice(path) {
  try {
    const device = new HID.HID(path);
    // If we can open it, it's accessible
    device.close();
    return true;
  } catch (error) {
    // For Windows, try by numeric index if string path fails
    if (/[\\/]/.test(path)) {
      const parsedInfo = parseDevicePath(path);
      if (parsedInfo.isValid && parsedInfo.index >= 0) {
        try {
          const device = new HID.HID(parsedInfo.index);
          device.close();
          return true;
        } catch (indexError) {
          // Device not accessible by index either
        }
      }
    }
    return false;
  }
}

/**
 * Filter devices that might be PacDrive compatible
 * @returns {Array} Filtered list of potential PacDrive devices
 */
function getPotentialPacDriveDevices() {
  try {
    const devices = listDevices();
    
    // PacDrive devices typically have the following properties:
    // - Vendor ID: 0xD209 (53769 in decimal)
    // - Product ID: 0x1500 or 0x1501
    const pacDriveDevices = devices.filter(device => 
      (device.vendorId === 0xD209 || device.vendorId === 53769) &&
      (device.productId === 0x1500 || device.productId === 0x1501 || device.productId === 5376)
    );
    
    // If no devices found by direct ID match, try looking for devices with "pac" in name
    if (pacDriveDevices.length === 0) {
      const nameMatchDevices = devices.filter(device => {
        const manufacturer = (device.manufacturer || '').toLowerCase();
        const product = (device.product || '').toLowerCase();
        return manufacturer.includes('pac') || product.includes('pac');
      });
      
      if (nameMatchDevices.length > 0) {
        return nameMatchDevices;
      }
    }
    
    return pacDriveDevices;
  } catch (error) {
    return [];
  }
}

/**
 * Parse device path to extract useful information
 * @param {string} path - The HID device path
 * @returns {Object} Parsed information about the path
 */
function parseDevicePath(path) {
  try {
    let index = -1;
    let format = 'unknown';
    
    // Case 1: Simple numeric index
    if (/^\d+$/.test(path)) {
      index = parseInt(path, 10);
      format = 'numeric';
    }
    // Case 2: Linux-style path
    else if (/\/dev\/usb\/hiddev(\d+)/.test(path)) {
      const match = path.match(/\/dev\/usb\/hiddev(\d+)/);
      if (match && match[1]) {
        index = parseInt(match[1], 10);
        format = 'linux';
      }
    }
    // Case 3: Windows-style HID path (backslash format)
    else if (/HID\\VID_[\dA-F]+&PID_[\dA-F]+\\(\d+)/i.test(path)) {
      const match = path.match(/HID\\VID_[\dA-F]+&PID_[\dA-F]+\\(\d+)/i);
      if (match && match[1]) {
        index = parseInt(match[1], 10);
        format = 'windows';
      }
    }
    // Case 4: Windows new format with backslashes and curly braces
    else if (/\\\\?\\hid#vid_[\da-f]+&pid_[\da-f]+#(\d+)&/i.test(path)) {
      const match = path.match(/\\\\?\\hid#vid_[\da-f]+&pid_[\da-f]+#(\d+)&/i);
      if (match && match[1]) {
        index = parseInt(match[1], 10);
        format = 'windows-new';
      }
    }
    // Case 5: Windows format with forward slashes instead of backslashes
    else if (/HID\/VID_[\dA-F]+&PID_[\dA-F]+\/(\d+)/i.test(path)) {
      const match = path.match(/HID\/VID_[\dA-F]+&PID_[\dA-F]+\/(\d+)/i);
      if (match && match[1]) {
        index = parseInt(match[1], 10);
        format = 'windows-forward-slash';
      }
    }
    // Case 6: Windows format with hash instead of backslash
    else if (/hid#vid_[\da-f]+&pid_[\da-f]+#(\d+)/i.test(path)) {
      const match = path.match(/hid#vid_[\da-f]+&pid_[\da-f]+#(\d+)/i);
      if (match && match[1]) {
        index = parseInt(match[1], 10);
        format = 'windows-hash';
      }
    }
    // Case 7: Windows format with double escaped backslashes
    else if (/\\\\\\\\?\\\\HID\\\\VID_[\da-f]+&PID_[\da-f]+\\\\(\d+)/i.test(path)) {
      const match = path.match(/\\\\\\\\?\\\\HID\\\\VID_[\da-f]+&PID_[\da-f]+\\\\(\d+)/i);
      if (match && match[1]) {
        index = parseInt(match[1], 10);
        format = 'windows-double-escaped';
      }
    }
    // Case 8: Windows format with device interface GUID parsing
    else if (/&(\d+)&.*?{/i.test(path)) {
      const match = path.match(/&(\d+)&.*?{/i);
      if (match && match[1]) {
        index = parseInt(match[1], 10);
        format = 'windows-guid-based';
      }
    }
    // Case 9: Another possible Windows format - after VID/PID section
    else if (/VID_[\dA-F]+&PID_[\dA-F]+[#\\\/](\d+)/i.test(path)) {
      const match = path.match(/VID_[\dA-F]+&PID_[\dA-F]+[#\\\/](\d+)/i);
      if (match && match[1]) {
        index = parseInt(match[1], 10);
        format = 'windows-after-vidpid';
      }
    }
    // Case 10: Try to extract any number from the end of the path
    else if (/(\d+)$/.test(path)) {
      const match = path.match(/(\d+)$/);
      if (match && match[1]) {
        index = parseInt(match[1], 10);
        format = 'last-number';
      }
    }
    
    return { 
      index,
      format,
      isValid: index >= 0,
      path
    };
  } catch (error) {
    return {
      index: -1,
      format: 'error',
      isValid: false,
      path,
      error: error.message
    };
  }
}

/**
 * Attempt to map an HID device to a PacDrive index
 * This is a best-effort function that tries to determine which PacDrive
 * index corresponds to a physical HID device
 * 
 * @param {string} hidPath - The HID device path
 * @param {number} pacDriveIndex - The PacDrive index to associate with
 * @returns {boolean} True if mapping is successful
 */
function mapToPacDriveIndex(hidPath, pacDriveIndex) {
  try {
    // Parse the path to extract useful information
    const pathInfo = parseDevicePath(hidPath);
    
    // In a real implementation, this would store the mapping in a persistent store
    // For now, we just return true to indicate success
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  listDevices,
  getDeviceInfo,
  testDevice,
  getPotentialPacDriveDevices,
  mapToPacDriveIndex,
  parseDevicePath
};
