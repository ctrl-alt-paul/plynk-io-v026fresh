
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

interface ModuleOffsetHelpDialogProps {
  trigger?: React.ReactNode;
}

export function ModuleOffsetHelpDialog({ trigger }: ModuleOffsetHelpDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full">
            <Info className="h-4 w-4" />
            <span className="sr-only">What is Module + Offset?</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            🧱 What is Module + Offset?
          </DialogTitle>
          <DialogDescription>
            Understanding how memory locations are dynamically calculated
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-md">
              <h3 className="font-semibold text-lg">📘 Definition</h3>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>A <span className="font-semibold">Module</span> is a loaded program file (<code className="bg-black/10 px-1 rounded">game.exe</code>, <code className="bg-black/10 px-1 rounded">daytona.exe</code>, etc.)</li>
                <li>An <span className="font-semibold">Offset</span> is the number of bytes forward from the base of that module</li>
              </ul>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-md space-y-2">
              <h3 className="font-semibold text-lg">🧪 Example</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Module</th>
                      <th className="text-left py-2 px-3">Offset</th>
                      <th className="text-left py-2 px-3">Base</th>
                      <th className="text-left py-2 px-3">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 px-3 font-mono">game.exe</td>
                      <td className="py-2 px-3 font-mono">0x123456</td>
                      <td className="py-2 px-3 font-mono">0x400000</td>
                      <td className="py-2 px-3 font-mono">0x523456</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2">This means: "Start at <code className="bg-black/10 px-1 rounded">game.exe</code>, move forward <code className="bg-black/10 px-1 rounded">0x123456</code> bytes"</p>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-md">
              <h3 className="font-semibold text-lg">💡 Why Use It?</h3>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Some games change memory addresses each time they launch</li>
                <li>Static addresses won't work</li>
                <li>This ensures consistency even if the base module shifts</li>
              </ul>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-md">
              <h3 className="font-semibold text-lg">🧠 Related Features</h3>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Pointer Chains often start with Module + Offset</li>
                <li>When <code className="bg-black/10 px-1 rounded">Use Module + Offset</code> is enabled, the app calculates address dynamically at runtime</li>
              </ul>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
