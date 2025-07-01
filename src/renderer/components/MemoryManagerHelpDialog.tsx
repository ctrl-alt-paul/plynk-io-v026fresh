
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MemoryManagerHelpDialogProps {
  trigger: React.ReactNode;
}

export const MemoryManagerHelpDialog: React.FC<MemoryManagerHelpDialogProps> = ({ trigger }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Memory Manager Help</DialogTitle>
          <DialogDescription>
            Learn how to read values from game memory in real-time
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
                  <span><strong>Select Process:</strong> Choose your running game from the process dropdown</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">2</span>
                  <span><strong>Add Memory Address:</strong> Enter hex address or use module+offset</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">3</span>
                  <span><strong>Test Reading:</strong> Click "Read Memory" to test while game is running</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">4</span>
                  <span><strong>Configure:</strong> Set data type, label, and any transformations needed</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">5</span>
                  <span><strong>Save Profile:</strong> Use "Save As New" to create a reusable profile</span>
                </div>
              </div>
            </section>

            {/* Process Selection */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-green-600">🎮 Process Selection</h3>
              <div className="space-y-3 text-sm text-left">
                <p><strong>Finding Your Game:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                  <li>Start your game first, then refresh the process list</li>
                  <li>Look for the game's executable name (e.g., "game.exe", "MyGame.exe")</li>
                  <li>Some games may have multiple processes - choose the main game process</li>
                  <li>If you don't see your game, try running as administrator</li>
                </ul>
                <p className="bg-yellow-50 p-2 rounded text-yellow-800 text-left">
                  <strong>Tip:</strong> Make sure the game is actively running and visible in Task Manager before selecting it.
                </p>
              </div>
            </section>

            {/* Memory Address Types */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-purple-600">📍 Memory Address Types</h3>
              <div className="space-y-3 text-sm text-left">
                <div className="border rounded p-3 text-left">
                  <p><strong>Direct Hex Address:</strong></p>
                  <p>Enter a specific memory address like <code className="bg-gray-100 px-1 rounded">0x12345678</code></p>
                  <p className="text-gray-600">Use when you have an absolute memory address from a memory scanner.</p>
                </div>
                <div className="border rounded p-3 text-left">
                  <p><strong>Module + Offset (Recommended):</strong></p>
                  <p>Enable "Use Module Offset" and enter:</p>
                  <ul className="list-disc list-inside ml-4 mt-1 text-left">
                    <li><strong>Module Name:</strong> Usually the game's .exe file (e.g., "game.exe")</li>
                    <li><strong>Offset:</strong> Hex offset from module base (e.g., "0x12345")</li>
                  </ul>
                  <p className="text-green-600 text-xs mt-1">✓ More reliable - addresses stay consistent across game restarts</p>
                </div>
              </div>
            </section>

            {/* Testing Memory Reads */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-orange-600">🧪 Testing Memory Reads</h3>
              <div className="space-y-3 text-sm text-left">
                <p><strong>Single Read Test:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                  <li>Click "Read Memory" to test your address once</li>
                  <li>Check if the value makes sense (not 0 or error)</li>
                  <li>Try changing something in-game and read again</li>
                </ul>
                <p><strong>Continuous Polling:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                  <li>Enable "Poll Memory" and click "Start Polling"</li>
                  <li>Watch values update in real-time as you play</li>
                  <li>Adjust poll interval (16ms = ~60fps, 100ms = 10fps)</li>
                </ul>
                <p className="bg-blue-50 p-2 rounded text-blue-800 text-left">
                  <strong>Best Practice:</strong> Always test with single reads first, then enable polling once confirmed working.
                </p>
              </div>
            </section>

            {/* Address Configuration */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-indigo-600">⚙️ Address Configuration</h3>
              <div className="space-y-3 text-sm text-left">
                <div className="text-left">
                  <p><strong>Data Types:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li><strong>Int32:</strong> Whole numbers (-2B to +2B)</li>
                    <li><strong>Float:</strong> Decimal numbers (speed, health %)</li>
                    <li><strong>Byte:</strong> Small values (0-255, often for flags)</li>
                    <li><strong>Double:</strong> High precision decimals</li>
                  </ul>
                </div>
                <div className="text-left">
                  <p><strong>Transform Script:</strong></p>
                  <p>Use JavaScript to modify values: <code className="bg-gray-100 px-1 rounded">value / 100</code> (convert to percentage)</p>
                </div>
                <div className="text-left">
                  <p><strong>Bitfield Operations:</strong></p>
                  <p>Extract specific bits using bitmask (e.g., <code className="bg-gray-100 px-1 rounded">0x04</code>) with AND operation</p>
                </div>
              </div>
            </section>

            {/* Troubleshooting */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-red-600">🔧 Troubleshooting</h3>
              <div className="space-y-3 text-sm text-left">
                <div className="text-left">
                  <p><strong>Getting Zero or Null Values:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li>Check if the process is still running</li>
                    <li>Verify the address is correct (check with memory scanner)</li>
                    <li>Try different data types (Byte vs Int32 vs Float)</li>
                    <li>Enable "Use Module Offset" for more stable addresses</li>
                  </ul>
                </div>
                <div className="text-left">
                  <p><strong>Permission Errors:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li>Run the application as administrator</li>
                    <li>Check if anti-virus is blocking memory access</li>
                    <li>Some games have anti-cheat that blocks memory reading</li>
                  </ul>
                </div>
                <div className="text-left">
                  <p><strong>Performance Issues:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-left">
                    <li>Increase poll interval (higher ms = less CPU usage)</li>
                    <li>Enable "Fast Mode" for better performance</li>
                    <li>Enable "Disable Caching" if getting stale values</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Pro Tips */}
            <section>
              <h3 className="text-lg font-semibold mb-3 text-teal-600">💡 Pro Tips</h3>
              <div className="space-y-2 text-sm text-left">
                <div className="bg-green-50 p-2 rounded text-left">
                  <p><strong>🎯 Finding Memory Addresses:</strong> Use tools like Cheat Engine to scan for values while playing, then use those addresses here.</p>
                </div>
                <div className="bg-blue-50 p-2 rounded text-left">
                  <p><strong>📂 Organize with Profiles:</strong> Create different profiles for different games or setups. Load them instantly when switching games.</p>
                </div>
                <div className="bg-purple-50 p-2 rounded text-left">
                  <p><strong>🔄 Pointer Chains:</strong> For complex games, enable "Use Pointer Chain" and add multiple offsets to follow pointer paths.</p>
                </div>
                <div className="bg-orange-50 p-2 rounded text-left">
                  <p><strong>⚡ Performance Tuning:</strong> Start with 100ms polling, then lower to 16ms only if you need real-time updates.</p>
                </div>
                <div className="bg-yellow-50 p-2 rounded text-left">
                  <p><strong>🧪 Test Thoroughly:</strong> Always test your setup while actively playing the game to ensure values change as expected.</p>
                </div>
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default MemoryManagerHelpDialog;
