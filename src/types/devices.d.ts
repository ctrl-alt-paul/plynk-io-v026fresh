
export interface BaseDevice {
  id: string;
  name: string;
  type: string;
  connected: boolean;
}

export interface PacDriveDevice extends BaseDevice {
  type: 'PacDrive';
  usbPath: string;
  deviceId: number;
  channels: number;
  outputCount?: number; // Add this property
  vendorId?: string;
  productId?: string;
  manufacturer?: string;
}

export interface ArduinoDevice extends BaseDevice {
  type: 'Arduino';
  comPort: string;
  baudRate: number;
  protocol: string;
  usbPath: string;
}

export interface WLEDDevice extends BaseDevice {
  type: 'WLED';
  ipAddress: string;
  segmentCount: number;
  totalLEDs: number;
  ledsPerSegment?: number[];
}

export type Device = PacDriveDevice | ArduinoDevice | WLEDDevice;

export interface HidDeviceInfo {
  path: string;
  vendorId: number | string;
  productId: number | string;
  manufacturer?: string;
  product?: string;
  serialNumber?: string;
  release?: number;
  interface?: number;
  usagePage?: number;
  usage?: number;
}
