
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";

interface TransformScriptHelpDialogProps {
  trigger?: React.ReactNode;
}

export function TransformScriptHelpDialog({ trigger }: TransformScriptHelpDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full">
            <Info className="h-4 w-4" />
            <span className="sr-only">What is a Transform Script?</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            🧠 What is a Transform Script?
          </DialogTitle>
          <DialogDescription>
            Use JavaScript to mathematically convert raw memory values
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-md space-y-2">
              <h3 className="font-semibold text-lg">🧾 Example Transform Scripts</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Description</th>
                      <th className="text-left py-2 px-3">Script</th>
                      <th className="text-left py-2 px-3">Input: 1922.91</th>
                      <th className="text-left py-2 px-3">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 px-3">Multiply by 100</td>
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">value * 100</td>
                      <td className="py-2 px-3">1922.91</td>
                      <td className="py-2 px-3">192291</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3">Round down</td>
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">Math.floor(value)</td>
                      <td className="py-2 px-3">1922.91</td>
                      <td className="py-2 px-3">1922</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3">Round to whole</td>
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">Math.round(value)</td>
                      <td className="py-2 px-3">1922.91</td>
                      <td className="py-2 px-3">1923</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3">Add a constant</td>
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">value + 250</td>
                      <td className="py-2 px-3">1922.91</td>
                      <td className="py-2 px-3">2172.91</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3">Cap to maximum</td>
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">Math.min(value, 1000)</td>
                      <td className="py-2 px-3">1922.91</td>
                      <td className="py-2 px-3">1000</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3">Convert to binary flag</td>
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">value {'>'} 0 ? 1 : 0</td>
                      <td className="py-2 px-3">1922.91</td>
                      <td className="py-2 px-3">1</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3">Convert range to percent</td>
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">value / 65535 * 100</td>
                      <td className="py-2 px-3">1922.91</td>
                      <td className="py-2 px-3">2.933%</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3">Clamp and scale to LED brightness</td>
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">Math.max(0, Math.min(255, value * 0.1))</td>
                      <td className="py-2 px-3">1922.91</td>
                      <td className="py-2 px-3">192.291</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3">Format to status string</td>
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">"Speed = " + Math.round(value)</td>
                      <td className="py-2 px-3">1922.91</td>
                      <td className="py-2 px-3">"Speed = 1923"</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-lg">🧰 When to Use</h3>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>To <span className="font-semibold">scale</span> or <span className="font-semibold">round</span> float values</li>
                <li>To apply <span className="font-semibold">custom logic</span>, like status conversion or clamping</li>
                <li>To <span className="font-semibold">map memory outputs to physical ranges</span> (e.g. RPM → LED brightness)</li>
                <li>To combine with <span className="font-semibold">format strings</span> for final output</li>
              </ul>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-md">
              <h3 className="font-semibold text-lg">🧠 How It Works</h3>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>The input variable is always called <code className="bg-black/10 px-1 rounded">value</code></li>
                <li>Code is executed in a <span className="font-semibold">safe JavaScript sandbox</span></li>
                <li>It runs <span className="font-semibold">after inversion</span>, but <span className="font-semibold">before formatting</span></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-lg">📝 Notes</h3>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>You can use math operators: <code className="bg-black/10 px-1 rounded">+</code>, <code className="bg-black/10 px-1 rounded">-</code>, <code className="bg-black/10 px-1 rounded">*</code>, <code className="bg-black/10 px-1 rounded">/</code></li>
                <li>You can use JS functions: <code className="bg-black/10 px-1 rounded">Math.round()</code>, <code className="bg-black/10 px-1 rounded">Math.min()</code>, <code className="bg-black/10 px-1 rounded">parseInt()</code></li>
                <li>Expressions must return a value — the final result replaces the original</li>
              </ul>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
