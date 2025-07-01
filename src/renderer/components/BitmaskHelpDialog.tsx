
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

interface BitmaskHelpDialogProps {
  trigger?: React.ReactNode;
}

export function BitmaskHelpDialog({ trigger }: BitmaskHelpDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full">
            <Info className="h-4 w-4" />
            <span className="sr-only">What is a Bitmask?</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            🧮 What is a Bitmask and Bitwise Operation?
          </DialogTitle>
          <DialogDescription>
            Read or manipulate individual bits of a memory value
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-md">
              <h3 className="font-semibold text-lg">📘 Bitmask Definition</h3>
              <p className="mt-2">
                A <span className="font-semibold">bitmask</span> is a binary value used to isolate or alter specific bits in another number. It's applied using <span className="font-semibold">bitwise operators</span> like <code className="bg-black/10 px-1 rounded">AND</code>, <code className="bg-black/10 px-1 rounded">OR</code>, or <code className="bg-black/10 px-1 rounded">XOR</code>. Think of it like a filter — it lets you <span className="font-semibold">extract</span>, <span className="font-semibold">toggle</span>, or <span className="font-semibold">test</span> bits from a byte.
              </p>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-md space-y-2">
              <h3 className="font-semibold text-lg">🔧 Bitwise Operation Definitions</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Operation</th>
                      <th className="text-left py-2 px-3">Symbol</th>
                      <th className="text-left py-2 px-3">What it Does</th>
                      <th className="text-left py-2 px-3">Use Case</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 px-3">AND</td>
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">&</td>
                      <td className="py-2 px-3">Keeps bits that exist in both values</td>
                      <td className="py-2 px-3">Extract a lamp or gear status</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3">OR</td>
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">|</td>
                      <td className="py-2 px-3">Turns on any bits set in either value</td>
                      <td className="py-2 px-3">Force LEDs on</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3">XOR</td>
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">^</td>
                      <td className="py-2 px-3">Toggles bits that differ</td>
                      <td className="py-2 px-3">Flashing light states</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3">NOT</td>
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">~</td>
                      <td className="py-2 px-3">Inverts every bit (1→0, 0→1)</td>
                      <td className="py-2 px-3">Reverse bitflags or invert logic</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-md space-y-2">
              <h3 className="font-semibold text-lg">🔍 Bitmask Visual Example</h3>
              <p className="font-medium">Raw Value: <code className="bg-black/10 px-1 rounded">0b11001101</code> (205 in decimal)</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Mask</th>
                      <th className="text-left py-2 px-3">Operation</th>
                      <th className="text-left py-2 px-3">Binary Result</th>
                      <th className="text-left py-2 px-3">Decimal</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">0b00000001</td>
                      <td className="py-2 px-3">AND</td>
                      <td className="py-2 px-3 font-mono">0b00000001</td>
                      <td className="py-2 px-3">1</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">0b00000100</td>
                      <td className="py-2 px-3">AND</td>
                      <td className="py-2 px-3 font-mono">0b00000100</td>
                      <td className="py-2 px-3">4</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">0b11110000</td>
                      <td className="py-2 px-3">AND</td>
                      <td className="py-2 px-3 font-mono">0b11000000</td>
                      <td className="py-2 px-3">192</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-md space-y-2">
              <h3 className="font-semibold text-lg">💡 Use Cases in PLYNK-IO</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Scenario</th>
                      <th className="text-left py-2 px-3">Input</th>
                      <th className="text-left py-2 px-3">Bitmask</th>
                      <th className="text-left py-2 px-3">Meaning</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 px-3">Lamp Status</td>
                      <td className="py-2 px-3 font-mono">0xCD</td>
                      <td className="py-2 px-3 font-mono">0x01</td>
                      <td className="py-2 px-3">Is lamp #1 ON? (<code className="bg-black/10 px-1 rounded">result {'>'} 0</code>)</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3">Gear Flags</td>
                      <td className="py-2 px-3 font-mono">0xCD</td>
                      <td className="py-2 px-3 font-mono">0x0F</td>
                      <td className="py-2 px-3">Extract current gear (last 4 bits)</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3">Brake Signal</td>
                      <td className="py-2 px-3 font-mono">0x08</td>
                      <td className="py-2 px-3 font-mono">0x08</td>
                      <td className="py-2 px-3">Test if brake is pressed (bit 3 = 1)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
