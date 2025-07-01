
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

interface InvertHelpDialogProps {
  trigger?: React.ReactNode;
}

export function InvertHelpDialog({ trigger }: InvertHelpDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full">
            <Info className="h-4 w-4" />
            <span className="sr-only">What is Invert Value?</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            🔄 What is Invert Value?
          </DialogTitle>
          <DialogDescription>
            Flip the sign of a value (multiply by -1)
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-md">
              <h3 className="font-semibold text-lg">📘 Definition</h3>
              <p className="mt-2">
                Inversion is a toggle that <span className="font-semibold">reverses the sign of a numeric value</span>. It multiplies the result by <code className="bg-black/10 px-1 rounded">-1</code>.
              </p>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-md space-y-2">
              <h3 className="font-semibold text-lg">🧪 Example:</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Input Value</th>
                      <th className="text-left py-2 px-3">Invert ON</th>
                      <th className="text-left py-2 px-3">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 px-3 font-mono">+1922.91</td>
                      <td className="py-2 px-3 text-center">✅</td>
                      <td className="py-2 px-3 font-mono">-1922.91</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3 font-mono">-500</td>
                      <td className="py-2 px-3 text-center">✅</td>
                      <td className="py-2 px-3 font-mono">+500</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-md">
              <h3 className="font-semibold text-lg">💡 Use Cases</h3>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Reverse signal polarity (e.g., throttle/brake)</li>
                <li>Match hardware output directions</li>
                <li>Convert push/pull sensor values</li>
              </ul>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
