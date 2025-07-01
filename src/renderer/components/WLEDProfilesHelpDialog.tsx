
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WLEDProfilesHelpDialogProps {
  trigger: React.ReactNode;
}

export const WLEDProfilesHelpDialog: React.FC<WLEDProfilesHelpDialogProps> = ({ trigger }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>WLED Profiles Help</DialogTitle>
          <DialogDescription>
            Create automated lighting profiles that respond to game events and data values
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] w-full rounded-md">
          <div className="space-y-6 pr-4">
            {/* Quick Start Guide */}
            <section className="text-left">
              <h3 className="text-lg font-semibold mb-3 text-blue-600">📋 Quick Start Guide</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">1</span>
                  <span><strong>Setup Your WLED Device:</strong> Configure your WLED device first - set up segments, effects, and colors directly on the device.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">2</span>
                  <span><strong>Add Device to PLYNK-IO:</strong> Go to Device Manager and add your WLED device using its IP address.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">3</span>
                  <span><strong>Import Settings:</strong> Use "Import Settings from Device" to automatically bring in your configured segments and effects.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">4</span>
                  <span><strong>Create Rules:</strong> Add rules that define when and how your lights should respond to game events.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">5</span>
                  <span><strong>Test Profile:</strong> Use the "Test Profile" button to verify your lighting works as expected.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">6</span>
                  <span><strong>Link to Game Profile:</strong> Connect your WLED profile to a Game Profile for automatic activation during gameplay.</span>
                </div>
              </div>
            </section>

            {/* Device Setup Recommendations */}
            <section className="text-left">
              <h3 className="text-lg font-semibold mb-3 text-green-600">🔧 Device Setup First (Recommended)</h3>
              <div className="space-y-3 text-sm">
                <p><strong>Why Configure Your WLED Device First?</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Easier Setup:</strong> Use the WLED web interface to visually configure segments and test effects</li>
                  <li><strong>Accurate Import:</strong> PLYNK-IO can automatically detect your exact hardware configuration</li>
                  <li><strong>Effect Validation:</strong> Ensure all effects work properly on your specific LED strip setup</li>
                  <li><strong>Segment Mapping:</strong> Define logical segments that match your physical LED layout</li>
                </ul>
                <div className="bg-green-50 p-3">
                  <p className="text-green-800"><strong>💡 Best Practice:</strong> Set up at least 2-3 different effects and segment configurations on your WLED device before importing into PLYNK-IO.</p>
                </div>
              </div>
            </section>

            {/* Profile Types */}
            <section className="text-left">
              <h3 className="text-lg font-semibold mb-3 text-purple-600">🎨 Profile Types & Use Cases</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p><strong>Game-Specific Profiles:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Racing games: Speed-based effects, turn signals, damage indicators</li>
                    <li>Shooters: Muzzle flashes, health warnings, ammo indicators</li>
                    <li>Arcade games: Button press feedback, score celebrations</li>
                  </ul>
                </div>
                <div>
                  <p><strong>Universal Profiles:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Ambient lighting that works across multiple games</li>
                    <li>Cabinet accent lighting for attract mode</li>
                    <li>System status indicators (online/offline, errors)</li>
                  </ul>
                </div>
                <div className="bg-purple-50 p-3">
                  <p className="text-purple-800"><strong>🎯 Tip:</strong> Start with simple profiles (like button press feedback) before creating complex multi-segment effects.</p>
                </div>
              </div>
            </section>

            {/* Creating Profiles */}
            <section className="text-left">
              <h3 className="text-lg font-semibold mb-3 text-orange-600">⚙️ Creating Profiles</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p><strong>Import Method (Recommended):</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Click "Import Settings from Device" button</li>
                    <li>Select your WLED device from the list</li>
                    <li>PLYNK-IO automatically detects segments and effects</li>
                    <li>Edit the imported profile to add game-specific rules</li>
                  </ul>
                </div>
                <div>
                  <p><strong>Manual Method:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Click "Create Profile" button</li>
                    <li>Select your WLED device (must be online)</li>
                    <li>Add rules manually using detected segments and effects</li>
                    <li>Test each rule as you create it</li>
                  </ul>
                </div>
                <div className="bg-orange-50 p-3">
                  <p className="text-orange-800"><strong>⚡ Speed Tip:</strong> Import first, then customize. It's much faster than building rules from scratch.</p>
                </div>
              </div>
            </section>

            {/* Rules and Effects */}
            <section className="text-left">
              <h3 className="text-lg font-semibold mb-3 text-indigo-600">🎛️ Understanding Rules & Effects</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p><strong>Rules:</strong> Define when lighting effects should trigger</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>Exact Value:</strong> Light activates when data equals specific value (e.g., button pressed = 1)</li>
                    <li><strong>Range:</strong> Light activates when data falls within range (e.g., speed 50-100)</li>
                    <li><strong>Threshold:</strong> Light activates when data exceeds value (e.g., RPM &gt; 5000)</li>
                  </ul>
                </div>
                <div>
                  <p><strong>Effects:</strong> How your lights will look and behave</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>Static:</strong> Solid colors, simple on/off states</li>
                    <li><strong>Dynamic:</strong> Rainbows, chases, strobes, fades</li>
                    <li><strong>Reactive:</strong> Effects that respond to trigger intensity</li>
                  </ul>
                </div>
                <div>
                  <p><strong>Segments:</strong> Control different parts of your LED strip independently</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Multiple segments can be controlled by one rule</li>
                    <li>Each segment can have different effects and colors</li>
                    <li>Use segments to create complex lighting patterns</li>
                  </ul>
                </div>
                <div className="bg-indigo-50 p-3">
                  <p className="text-indigo-800"><strong>🧠 Example:</strong> Racing game - Segment 0 shows speed (blue to red), Segment 1 flashes red when braking, Segment 2 shows turn signals.</p>
                </div>
              </div>
            </section>

            {/* Testing and Validation */}
            <section className="text-left">
              <h3 className="text-lg font-semibold mb-3 text-amber-600">🧪 Testing & Validation</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p><strong>Test Profile Button:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Sends your profile settings directly to the WLED device</li>
                    <li>Verify colors, effects, and brightness look correct</li>
                    <li>Test each rule individually before combining them</li>
                    <li>Make sure segments are mapped to the right physical LEDs</li>
                  </ul>
                </div>
                <div>
                  <p><strong>Live Testing with Games:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Link profile to a Game Profile for automatic activation</li>
                    <li>Start your game and verify lighting responds correctly</li>
                    <li>Check timing - effects should be immediate, not delayed</li>
                    <li>Adjust brightness and colors based on your environment</li>
                  </ul>
                </div>
                <div className="bg-amber-50 p-3">
                  <p className="text-amber-800"><strong>⚠️ Important:</strong> Always test in your actual gaming environment - lighting looks different in dark vs bright rooms.</p>
                </div>
              </div>
            </section>

            {/* Troubleshooting */}
            <section className="text-left">
              <h3 className="text-lg font-semibold mb-3 text-red-600">🔧 Troubleshooting</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p><strong>Device Not Connecting?</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Verify WLED device is on the same network as PLYNK-IO</li>
                    <li>Check device IP address hasn't changed</li>
                    <li>Ensure WLED device is running recent firmware</li>
                    <li>Try refreshing the device connection</li>
                  </ul>
                </div>
                <div>
                  <p><strong>Effects Not Working?</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Test effects directly on WLED device first</li>
                    <li>Check if segments are properly defined</li>
                    <li>Verify game data is actually changing (check Memory Manager)</li>
                    <li>Ensure Game Profile is linked and active</li>
                  </ul>
                </div>
                <div>
                  <p><strong>Lighting Delays?</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Reduce network traffic between device and PLYNK-IO</li>
                    <li>Use wired network connection instead of WiFi if possible</li>
                    <li>Simplify complex effects that may cause processing delays</li>
                    <li>Check memory polling interval in Memory Manager</li>
                  </ul>
                </div>
                <div className="bg-red-50 p-3">
                  <p className="text-red-800"><strong>⚠️ Network Tip:</strong> For best performance, keep WLED devices on a stable, fast network connection.</p>
                </div>
              </div>
            </section>

            {/* Pro Tips */}
            <section className="text-left">
              <h3 className="text-lg font-semibold mb-3 text-cyan-600">💡 Pro Tips</h3>
              <div className="space-y-2 text-sm">
                <div className="bg-green-50 p-3">
                  <p className="text-green-800"><strong>🎯 Start Simple:</strong> Begin with basic on/off effects before creating complex color-changing patterns.</p>
                </div>
                <div className="bg-blue-50 p-3">
                  <p className="text-blue-800"><strong>📂 Organize by Game:</strong> Create separate profiles for each game rather than trying to make one universal profile.</p>
                </div>
                <div className="bg-purple-50 p-3">
                  <p className="text-purple-800"><strong>🔄 Backup Configurations:</strong> Export your WLED device settings before making major changes in PLYNK-IO.</p>
                </div>
                <div className="bg-orange-50 p-3">
                  <p className="text-orange-800"><strong>⚡ Performance:</strong> Use fewer, larger segments instead of many small ones for better performance.</p>
                </div>
                <div className="bg-yellow-50 p-3">
                  <p className="text-yellow-800"><strong>🧪 Test Everything:</strong> Always test your profiles with actual gameplay, not just static test values.</p>
                </div>
                <div className="bg-pink-50 p-3">
                  <p className="text-pink-800"><strong>🎨 Color Harmony:</strong> Choose colors that complement your cabinet design and don't distract from gameplay.</p>
                </div>
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
