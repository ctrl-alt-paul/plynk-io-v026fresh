
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DeviceManagerHelpDialogProps {
  trigger: React.ReactNode;
}

export const DeviceManagerHelpDialog: React.FC<DeviceManagerHelpDialogProps> = ({ trigger }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Device Manager Help</DialogTitle>
          <DialogDescription>
            Learn how to configure and manage hardware devices for your control system
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] w-full rounded-md">
          <div className="space-y-6 text-left">
            {/* Quick Start Guide */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-blue-600">🚀 Quick Start Guide</h3>
              <div className="space-y-2 text-sm text-left">
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">1</span>
                  <span><strong>Connect Hardware:</strong> Physically connect your PacDrive, Serial, or WLED device</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">2</span>
                  <span><strong>Scan for Devices:</strong> Click "Scan PacDrive Devices" to auto-discover connected hardware</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">3</span>
                  <span><strong>Add Device:</strong> Use "Add Device" dropdown to manually configure any device type</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">4</span>
                  <span><strong>Configure Settings:</strong> Set device name, connection details, and channel counts</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">5</span>
                  <span><strong>Test Connection:</strong> Use the test button to verify device responds correctly</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">6</span>
                  <span><strong>Check Status:</strong> Monitor connection status and use diagnostics if needed</span>
                </div>
              </div>
            </section>

            {/* Adding PacDrive Devices */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-green-600">🎮 Adding PacDrive Devices</h3>
              <div className="space-y-3 text-sm text-left">
                <div className="border rounded p-3 text-left">
                  <p><strong>Automatic Discovery (Recommended):</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-4 text-left">
                    <li>Connect your PacDrive device via USB</li>
                    <li>Click "Scan PacDrive Devices" button</li>
                    <li>Select discovered devices from the scan results dialog</li>
                    <li>Click "Add Device" or "Add All New Devices"</li>
                  </ol>
                </div>
                <div className="border rounded p-3 text-left">
                  <p><strong>Manual Setup:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-4 text-left">
                    <li>Click "Add Device" dropdown → "PacDrive"</li>
                    <li>Enter a descriptive device name</li>
                    <li>Set the USB path or device index</li>
                    <li>Configure vendor/product ID if needed</li>
                    <li>Set channel count (usually 16 for standard PacDrive)</li>
                    <li>Click "Save Device"</li>
                  </ol>
                </div>
                <p className="bg-green-50 p-2 rounded text-green-800 text-left">
                  <strong>Note:</strong> PacDrive devices are perfect for button lights, solenoids, and simple on/off outputs.
                </p>
              </div>
            </section>

            {/* Adding Serial Devices */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-purple-600">🔧 Adding Serial Devices</h3>
              <div className="space-y-3 text-sm text-left">
                <div className="text-left">
                  <p><strong>Setup Steps:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-4 text-left">
                    <li>Connect Serial device via USB cable</li>
                    <li>Note the COM port from Device Manager (Windows) or /dev/ttyUSB (Linux)</li>
                    <li>Click "Add Device" dropdown → "Serial"</li>
                    <li>Enter device name (e.g., "Main Controller")</li>
                    <li>Select correct COM port from dropdown</li>
                    <li>Set baud rate (usually 9600 or 115200)</li>
                    <li>Click "Save Device"</li>
                  </ol>
                </div>
                <div className="text-left">
                  <p><strong>Common Baud Rates:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li><strong>9600:</strong> Standard for most Serial devices</li>
                    <li><strong>115200:</strong> High-speed communication</li>
                    <li><strong>57600:</strong> Alternative high-speed option</li>
                  </ul>
                </div>
                <p className="bg-purple-50 p-2 rounded text-purple-800 text-left">
                  <strong>Best For:</strong> Custom hardware control, sensors, servo motors, and complex output patterns.
                </p>
              </div>
            </section>

            {/* Adding WLED Devices */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-orange-600">💡 Adding WLED Devices</h3>
              <div className="space-y-3 text-sm text-left">
                <div className="text-left">
                  <p><strong>Setup Process:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-4 text-left">
                    <li>Flash WLED firmware to your ESP32/ESP8266</li>
                    <li>Connect device to your WiFi network</li>
                    <li>Find the device's IP address (check router or WLED app)</li>
                    <li>Click "Add Device" dropdown → "WLED"</li>
                    <li>Enter device name (e.g., "Cabinet LEDs")</li>
                    <li>Enter the IP address (e.g., "192.168.1.100")</li>
                    <li>Click "Save Device" to auto-detect LED configuration</li>
                  </ol>
                </div>
                <div className="text-left">
                  <p><strong>Device Information:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li>Segment count and total LEDs are detected automatically</li>
                    <li>Connection status shows if device is reachable</li>
                    <li>Supports complex lighting effects and profiles</li>
                  </ul>
                </div>
                <p className="bg-orange-50 p-2 rounded text-orange-800 text-left">
                  <strong>Perfect For:</strong> LED strips, ambient lighting, underglow effects, and dynamic color displays.
                </p>
              </div>
            </section>

            {/* Device Testing */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-indigo-600">🧪 Testing Your Devices</h3>
              <div className="space-y-3 text-sm text-left">
                <div className="text-left">
                  <p><strong>Connection Testing:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li>Use "Check All Connections" to verify all devices at once</li>
                    <li>Green dot = Connected and responding</li>
                    <li>Red dot = Disconnected or not responding</li>
                    <li>Test individual devices using the ⚡ Test button</li>
                  </ul>
                </div>
                <div className="text-left">
                  <p><strong>Device-Specific Testing:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li><strong>PacDrive:</strong> Test channels individually with on/off values</li>
                    <li><strong>Serial:</strong> Send custom messages to test communication</li>
                    <li><strong>WLED:</strong> Connection test verifies network reachability</li>
                  </ul>
                </div>
                <div className="text-left">
                  <p><strong>Troubleshooting Tests:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li>Check "Diagnostics" section for system information</li>
                    <li>Use "HID Device Browser" to see all connected USB devices</li>
                    <li>Verify device appears in your system's device manager</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Device Management */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-teal-600">⚙️ Managing Your Devices</h3>
              <div className="space-y-3 text-sm text-left">
                <div className="text-left">
                  <p><strong>Device Actions:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li><strong>Edit:</strong> Click pencil icon to modify device settings</li>
                    <li><strong>Test:</strong> Click ⚡ icon to test device functionality</li>
                    <li><strong>Delete:</strong> Click trash icon to remove device (requires confirmation)</li>
                  </ul>
                </div>
                <div className="text-left">
                  <p><strong>Filtering and Organization:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li>Use device type filter dropdown to show specific device types</li>
                    <li>Devices are automatically grouped by type in the table</li>
                    <li>Connection status is shown with colored indicators</li>
                  </ul>
                </div>
                <div className="text-left">
                  <p><strong>Device Discovery Tools:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li><strong>Scan PacDrive:</strong> Auto-detect connected PacDrive devices</li>
                    <li><strong>HID Browser:</strong> View all USB HID devices on your system</li>
                    <li><strong>Diagnostics:</strong> System information for troubleshooting</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Troubleshooting */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-red-600">🔧 Troubleshooting</h3>
              <div className="space-y-3 text-sm text-left">
                <div className="text-left">
                  <p><strong>Device Not Detected:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li>Check USB cable connection and try different USB port</li>
                    <li>Verify device appears in system Device Manager</li>
                    <li>Try running application as administrator</li>
                    <li>Use "Scan PacDrive Devices" or "HID Device Browser"</li>
                  </ul>
                </div>
                <div className="text-left">
                  <p><strong>Connection Issues:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li>For Serial: Verify COM port and baud rate settings</li>
                    <li>For WLED: Check IP address and WiFi connection</li>
                    <li>For PacDrive: Ensure drivers are installed correctly</li>
                    <li>Use device test functions to isolate problems</li>
                  </ul>
                </div>
                <div className="text-left">
                  <p><strong>Performance Problems:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li>Reduce polling frequency in game profiles if CPU usage is high</li>
                    <li>Check for driver conflicts in Device Manager</li>
                    <li>Ensure adequate power supply for all connected devices</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Pro Tips */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-pink-600">💡 Pro Tips</h3>
              <div className="space-y-2 text-sm text-left">
                <div className="bg-green-50 p-2 rounded text-left">
                  <p><strong>🏷️ Naming:</strong> Use descriptive device names like "Left Side LEDs" or "Button Controller #1" for easy identification.</p>
                </div>
                <div className="bg-blue-50 p-2 rounded text-left">
                  <p><strong>🔌 Organization:</strong> Group similar devices with consistent naming schemes (e.g., "Zone1-PacDrive", "Zone1-WLED").</p>
                </div>
                <div className="bg-purple-50 p-2 rounded text-left">
                  <p><strong>⚡ Testing:</strong> Always test devices immediately after adding them to catch configuration issues early.</p>
                </div>
                <div className="bg-orange-50 p-2 rounded text-left">
                  <p><strong>🔄 Backup:</strong> Document your device configurations and IP addresses in case you need to reconfigure.</p>
                </div>
                <div className="bg-yellow-50 p-2 rounded text-left">
                  <p><strong>📊 Monitoring:</strong> Use "Check All Connections" regularly to ensure all devices are functioning properly.</p>
                </div>
                <div className="bg-red-50 p-2 rounded text-left">
                  <p><strong>🛠️ Maintenance:</strong> Keep device firmware updated and check cable connections periodically.</p>
                </div>
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default DeviceManagerHelpDialog;
