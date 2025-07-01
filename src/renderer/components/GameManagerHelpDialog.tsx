
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GameManagerHelpDialogProps {
  trigger: React.ReactNode;
}

export const GameManagerHelpDialog: React.FC<GameManagerHelpDialogProps> = ({ trigger }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Game Manager Help</DialogTitle>
          <DialogDescription>
            Learn how to create game profiles and map memory/message outputs to devices
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
                  <span><strong>Create New Profile:</strong> Click "Create Profile" button in the header</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">2</span>
                  <span><strong>Set Profile Name:</strong> Enter a descriptive name for your game setup</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">3</span>
                  <span><strong>Select Profiles:</strong> Choose memory profile and/or message profile to use</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">4</span>
                  <span><strong>Configure Settings:</strong> Adjust process name and poll interval as needed</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">5</span>
                  <span><strong>Map Outputs:</strong> Assign memory/message outputs to your devices</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">6</span>
                  <span><strong>Test & Save:</strong> Test your mappings and save the profile</span>
                </div>
              </div>
            </section>

            {/* Creating a New Profile */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-green-600">🎮 Creating a New Profile</h3>
              <div className="space-y-3 text-sm text-left">
                <div className="border rounded p-3 text-left">
                  <p><strong>Step 1: Click "Create Profile"</strong></p>
                  <p>Located in the top-right header area next to the profile dropdown.</p>
                </div>
                <div className="border rounded p-3 text-left">
                  <p><strong>Step 2: Enter Profile Name</strong></p>
                  <p>Choose a descriptive name like "Street Fighter 6" or "Racing Setup".</p>
                </div>
                <div className="border rounded p-3 text-left">
                  <p><strong>Step 3: Select Memory Profile (Optional)</strong></p>
                  <p>Choose a memory profile to read game values in real-time. The process name will auto-populate.</p>
                </div>
                <div className="border rounded p-3 text-left">
                  <p><strong>Step 4: Select Message Profile (Optional)</strong></p>
                  <p>Choose a message profile to capture MAME/game messages. The game name will auto-populate.</p>
                </div>
                <p className="bg-blue-50 p-2 rounded text-blue-800 text-left">
                  <strong>Note:</strong> You must select at least one profile (memory or message) to create a game profile.
                </p>
              </div>
            </section>

            {/* Profile Types */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-purple-600">📋 Understanding Profile Types</h3>
              <div className="space-y-3 text-sm text-left">
                <div className="border rounded p-3 text-left">
                  <p><strong>Memory Profiles:</strong></p>
                  <ul className="list-disc list-inside ml-4 mt-1 text-left">
                    <li>Read values directly from game memory (health, speed, RPM, etc.)</li>
                    <li>Require the game process to be running</li>
                    <li>Best for modern games and detailed real-time data</li>
                    <li>Need specific memory addresses for each game</li>
                  </ul>
                </div>
                <div className="border rounded p-3 text-left">
                  <p><strong>Message Profiles:</strong></p>
                  <ul className="list-disc list-inside ml-4 mt-1 text-left">
                    <li>Capture messages sent by MAME or arcade games</li>
                    <li>Work with lamp outputs, button states, and game events</li>
                    <li>Perfect for MAME arcade setups</li>
                    <li>No memory addresses needed</li>
                  </ul>
                </div>
                <div className="border rounded p-3 text-left">
                  <p><strong>Using Both:</strong></p>
                  <p>You can combine memory and message profiles to get data from multiple sources in one game profile.</p>
                </div>
              </div>
            </section>

            {/* Profile Configuration */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-orange-600">⚙️ Profile Configuration</h3>
              <div className="space-y-3 text-sm text-left">
                <div className="text-left">
                  <p><strong>Process Name:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li>Auto-populated from memory profile (e.g., "game.exe")</li>
                    <li>Only editable if a memory profile is selected</li>
                    <li>Must match the exact executable name of your game</li>
                  </ul>
                </div>
                <div className="text-left">
                  <p><strong>Poll Interval:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li><strong>16ms (Recommended):</strong> ~60fps updates for smooth real-time response</li>
                    <li><strong>33ms:</strong> ~30fps updates for moderate response</li>
                    <li><strong>100ms:</strong> 10fps updates for basic monitoring</li>
                  </ul>
                </div>
                <div className="text-left">
                  <p><strong>Game Name:</strong></p>
                  <p>Auto-populated from message profile, used for message identification.</p>
                </div>
              </div>
            </section>

            {/* Output Mapping */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-indigo-600">🔗 Output Mapping Process</h3>
              <div className="space-y-3 text-sm text-left">
                <div className="text-left">
                  <p><strong>Understanding the Mapping Table:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li><strong>Memory Output:</strong> Name of the data value (e.g., "Health", "RPM")</li>
                    <li><strong>Address:</strong> Memory location or message key</li>
                    <li><strong>Device Type:</strong> Choose PacDrive, Serial, or WLED</li>
                    <li><strong>Target Device:</strong> Specific device from your setup</li>
                    <li><strong>Channel/Profile:</strong> Output channel or WLED profile to use</li>
                  </ul>
                </div>
                <div className="text-left">
                  <p><strong>Device Type Selection:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li><strong>PacDrive:</strong> For button lamps and simple LED outputs (0/1 values)</li>
                    <li><strong>Serial:</strong> For custom hardware and complex control</li>
                    <li><strong>WLED:</strong> For advanced LED strips and lighting effects</li>
                  </ul>
                </div>
                <div className="text-left">
                  <p><strong>Mapping Steps:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-4 text-left">
                    <li>Select Device Type from dropdown</li>
                    <li>Choose Target Device (must be configured in Device Manager)</li>
                    <li>Set Channel number or WLED Profile</li>
                    <li>Enable "Active" checkbox to activate the mapping</li>
                    <li>Test with sample values using the Test column</li>
                  </ol>
                </div>
              </div>
            </section>

            {/* Testing Outputs */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-teal-600">🧪 Testing Your Mappings</h3>
              <div className="space-y-3 text-sm text-left">
                <div className="text-left">
                  <p><strong>Using Test Values:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li>Enter test values in the "Test Value" column</li>
                    <li>For PacDrive: Use "0" (off) or "1" (on)</li>
                    <li>For Serial/WLED: Use appropriate numeric values</li>
                    <li>Click "Test" button to send the value to your device</li>
                  </ul>
                </div>
                <div className="text-left">
                  <p><strong>Validation Checklist:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li>Device responds to test values correctly</li>
                    <li>Channel numbers match your physical setup</li>
                    <li>WLED profiles produce expected lighting effects</li>
                    <li>No error messages in the console</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Profile Management */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-red-600">💾 Profile Management</h3>
              <div className="space-y-3 text-sm text-left">
                <div className="text-left">
                  <p><strong>Saving Changes:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li>Click "Save Settings" to save mapping changes</li>
                    <li>Use "Update Profile" to save configuration changes</li>
                    <li>Changes are automatically validated before saving</li>
                  </ul>
                </div>
                <div className="text-left">
                  <p><strong>Loading Profiles:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li>Select from the profile dropdown in the header</li>
                    <li>Profile settings and mappings load automatically</li>
                    <li>All device assignments are restored</li>
                  </ul>
                </div>
                <div className="text-left">
                  <p><strong>Profile Actions:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li><strong>Clear:</strong> Reset current form without saving</li>
                    <li><strong>Delete:</strong> Permanently remove the selected profile</li>
                    <li><strong>Update:</strong> Save changes to existing profile</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Troubleshooting */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-yellow-600">🔧 Troubleshooting</h3>
              <div className="space-y-3 text-sm text-left">
                <div className="text-left">
                  <p><strong>No Devices Available:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li>Configure devices in Device Manager first</li>
                    <li>Ensure devices are connected and powered on</li>
                    <li>Check device status in Device Manager</li>
                  </ul>
                </div>
                <div className="text-left">
                  <p><strong>Test Values Not Working:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li>Verify device is online and responding</li>
                    <li>Check channel numbers match physical connections</li>
                    <li>For PacDrive: Only use "0" or "1" values</li>
                    <li>Check console for error messages</li>
                  </ul>
                </div>
                <div className="text-left">
                  <p><strong>Profile Not Saving:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li>Ensure all required fields are filled</li>
                    <li>Check that target devices exist</li>
                    <li>Verify you have write permissions</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Pro Tips */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-pink-600">💡 Pro Tips</h3>
              <div className="space-y-2 text-sm text-left">
                <div className="bg-green-50 p-2 rounded text-left">
                  <p><strong>🎯 Organization:</strong> Use descriptive profile names like "Street Fighter - Tournament Setup" to easily identify configurations.</p>
                </div>
                <div className="bg-blue-50 p-2 rounded text-left">
                  <p><strong>📊 Performance:</strong> Start with 100ms polling, then reduce to 16ms only if you need real-time response for fast-paced games.</p>
                </div>
                <div className="bg-purple-50 p-2 rounded text-left">
                  <p><strong>🔄 Workflow:</strong> Create and test memory profiles in Memory Manager before using them in game profiles.</p>
                </div>
                <div className="bg-orange-50 p-2 rounded text-left">
                  <p><strong>⚡ Testing:</strong> Always test each mapping individually before running the full game to isolate any issues.</p>
                </div>
                <div className="bg-yellow-50 p-2 rounded text-left">
                  <p><strong>🎮 Multi-Game:</strong> Create separate profiles for different games, even if they use similar devices.</p>
                </div>
                <div className="bg-red-50 p-2 rounded text-left">
                  <p><strong>🔧 Backup:</strong> Export your device configurations before making major changes to avoid losing your setup.</p>
                </div>
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default GameManagerHelpDialog;
