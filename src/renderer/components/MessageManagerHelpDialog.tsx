
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MessageManagerHelpDialogProps {
  trigger: React.ReactNode;
}

export const MessageManagerHelpDialog: React.FC<MessageManagerHelpDialogProps> = ({ trigger }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Message Manager Help</DialogTitle>
          <DialogDescription>
            Capture and profile message outputs from emulators like MAME, OutputBlaster, and other arcade systems
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
                  <span><strong>Start Listening:</strong> Click the "Start Listening" button to begin capturing messages from emulators.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">2</span>
                  <span><strong>Run Your Emulator:</strong> Launch your arcade emulator (MAME, etc.) and start playing a game.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">3</span>
                  <span><strong>Watch for Outputs:</strong> As you play, outputs will appear in the table below (button presses, LED states, etc.).</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">4</span>
                  <span><strong>Customize Labels:</strong> Edit the labels and add transform scripts or format strings as needed.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">5</span>
                  <span><strong>Save Profile:</strong> Click "Save As New" to create a reusable message profile for this game.</span>
                </div>
              </div>
            </section>

            {/* Supported Systems */}
            <section className="text-left">
              <h3 className="text-lg font-semibold mb-3 text-green-600">🎮 Supported Emulators & Systems</h3>
              <div className="space-y-3 text-sm">
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>MAME:</strong> Most arcade games that output lamp/LED data</li>
                  <li><strong>OutputBlaster:</strong> Enhanced output systems</li>
                  <li><strong>Custom Emulators:</strong> Any system that sends WM_COPYDATA messages</li>
                  <li><strong>Sega Model 2/3:</strong> Racing games, light gun games</li>
                  <li><strong>Namco System:</strong> Various arcade boards</li>
                </ul>
                <div className="bg-green-50 p-3">
                  <p className="text-green-800"><strong>💡 Tip:</strong> Most modern arcade emulators support message outputs, but older emulators may need additional configuration.</p>
                </div>
              </div>
            </section>

            {/* What to Expect */}
            <section className="text-left">
              <h3 className="text-lg font-semibold mb-3 text-purple-600">👀 What to Expect While Listening</h3>
              <div className="space-y-3 text-sm">
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Button Presses:</strong> Start, view change, action buttons</li>
                  <li><strong>LED States:</strong> Cabinet lighting, button illumination</li>
                  <li><strong>Game Events:</strong> Score events, special effects triggers</li>
                  <li><strong>Force Feedback:</strong> Steering wheel, rumble data</li>
                  <li><strong>Audio Cues:</strong> Woofer/subwoofer control signals</li>
                </ul>
                <div className="bg-purple-50 p-3">
                  <p className="text-purple-800"><strong>Message Format:</strong> Messages typically contain ID numbers and values (e.g., "id_2=1" for button press)</p>
                  <p className="text-purple-600 text-xs mt-1">These raw messages are automatically processed and displayed in the output table.</p>
                </div>
              </div>
            </section>

            {/* Customization Options */}
            <section className="text-left">
              <h3 className="text-lg font-semibold mb-3 text-orange-600">⚙️ Customization Options</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p><strong>Labels:</strong> Give meaningful names to captured outputs (e.g., "Start Button" instead of "id_2")</p>
                </div>
                <div>
                  <p><strong>Transform Scripts:</strong> Apply mathematical transformations to values (e.g., <code className="bg-gray-100 px-1 rounded">"value * 100"</code> to convert to percentage)</p>
                </div>
                <div>
                  <p><strong>Format Strings:</strong> Control how the final value is displayed (e.g., <code className="bg-gray-100 px-1 rounded">{`"{value}%"`}</code> to add percentage sign)</p>
                </div>
                <div className="bg-orange-50 p-3">
                  <p className="text-orange-800"><strong>⚡ Performance Tip:</strong> Use transform scripts to normalize values across different games for consistent behavior.</p>
                </div>
              </div>
            </section>

            {/* Troubleshooting */}
            <section className="text-left">
              <h3 className="text-lg font-semibold mb-3 text-red-600">🔧 Troubleshooting</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p><strong>No outputs appearing?</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Make sure the listener is started before launching the emulator</li>
                    <li>Check that your emulator supports message outputs</li>
                    <li>Try interacting with the game (press buttons, trigger events)</li>
                    <li>Verify the emulator is configured to send WM_COPYDATA messages</li>
                  </ul>
                </div>
                <div>
                  <p><strong>Outputs not updating?</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Restart the listener and try again</li>
                    <li>Check Windows firewall settings</li>
                    <li>Ensure no other applications are blocking message communication</li>
                    <li>Try running the application as administrator</li>
                  </ul>
                </div>
                <div className="bg-red-50 p-3">
                  <p className="text-red-800"><strong>⚠️ Common Issue:</strong> Some anti-virus software may block message communication between applications.</p>
                </div>
              </div>
            </section>

            {/* Profile Management */}
            <section className="text-left">
              <h3 className="text-lg font-semibold mb-3 text-indigo-600">📁 Profile Management</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p><strong>Creating Profiles:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Capture outputs from your game first</li>
                    <li>Customize labels and transformations as needed</li>
                    <li>Click "Save As New" and give it a descriptive name</li>
                    <li>Profiles are automatically saved and can be reloaded anytime</li>
                  </ul>
                </div>
                <div>
                  <p><strong>Managing Profiles:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Use "Update" to save changes to the current profile</li>
                    <li>Use "Delete" to remove profiles you no longer need</li>
                    <li>Use "Clear" to reset the form and start fresh</li>
                  </ul>
                </div>
                <div className="bg-indigo-50 p-3">
                  <p className="text-indigo-800"><strong>📋 Organization Tip:</strong> Use descriptive profile names like "GameName - Cabinet Type" for easy identification.</p>
                </div>
              </div>
            </section>

            {/* Pro Tips */}
            <section className="text-left">
              <h3 className="text-lg font-semibold mb-3 text-amber-600">💡 Pro Tips</h3>
              <div className="space-y-2 text-sm">
                <div className="bg-green-50 p-3">
                  <p className="text-green-800"><strong>🎯 Game Testing:</strong> Test all game functions to capture complete output sets - don't just test one button!</p>
                </div>
                <div className="bg-blue-50 p-3">
                  <p className="text-blue-800"><strong>📂 Organize Profiles:</strong> Save profiles with descriptive names like "GameName - Cabinet Type" for easy identification.</p>
                </div>
                <div className="bg-purple-50 p-3">
                  <p className="text-purple-800"><strong>🔄 Consistency:</strong> Use transform scripts to normalize values across different games for consistent hardware control.</p>
                </div>
                <div className="bg-orange-50 p-3">
                  <p className="text-orange-800"><strong>⚡ Efficiency:</strong> Create separate profiles for different game modes or configurations within the same game.</p>
                </div>
                <div className="bg-yellow-50 p-3">
                  <p className="text-yellow-800"><strong>🧪 Validation:</strong> Always test your profiles with the actual game running to ensure outputs work correctly.</p>
                </div>
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
