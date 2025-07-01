
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

interface PointerHelpDialogProps {
  trigger?: React.ReactNode;
}

export function PointerHelpDialog({ trigger }: PointerHelpDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full">
            <Info className="h-4 w-4" />
            <span className="sr-only">What Are Pointer Chains?</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            🧩 What Are Pointer Chains?
          </DialogTitle>
          <DialogDescription>
            Understanding dynamic memory addresses in games
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            <p>
              Pointer Chains are dynamic memory addresses that change every time a game runs.
            </p>
            <p>
              Instead of pointing directly to a value like 0x12345678, a game might store the location 
              of that value at another memory location. You must follow a chain of memory addresses to 
              reach the value.
            </p>
            
            <div className="bg-muted/50 p-4 rounded-md space-y-2">
              <h3 className="font-semibold text-lg">📘 Example Chain</h3>
              <pre className="whitespace-pre-wrap font-mono text-sm bg-black/10 p-3 rounded">
{`Start: daytona.exe + 0x1234
 ↓ [Pointer]
Offset: 0x10
 ↓ [Pointer]
Offset: 0x8
 ↓ [Pointer]
Offset: 0x4
 ↓
Final value: RPM = 4567`}
              </pre>
              <p className="font-semibold mt-2">Pointer Chain format:</p>
              <pre className="whitespace-pre-wrap font-mono text-sm bg-black/10 p-3 rounded">
                daytona.exe+0x1234 → [0x10] → [0x8] → [0x4]
              </pre>
            </div>
            
            <div>
              <h3 className="font-semibold text-lg">🧠 When to Use Pointer Chains</h3>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>The memory address changes each time the game runs</li>
                <li>Cheat Engine or trainers show you "multi-level pointers"</li>
                <li>You can't get a stable static address</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-lg">🔧 How to Use in PLYNK-IO</h3>
              <ol className="list-decimal pl-5 space-y-1 mt-2">
                <li>Enable Pointer Chain mode</li>
                <li>Set Module Name and Base Offset</li>
                <li>Add offsets: 0x10, 0x8, 0x4, etc.</li>
                <li>The memory reader will follow each step automatically</li>
              </ol>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-md">
              <h3 className="font-semibold text-lg">📌 Formula</h3>
              <p>Each step:</p>
              <pre className="whitespace-pre-wrap font-mono text-sm bg-black/10 p-3 rounded mt-2">
                address = read(address) + offset
              </pre>
              <p className="mt-2">The final address gives you the value you want.</p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
