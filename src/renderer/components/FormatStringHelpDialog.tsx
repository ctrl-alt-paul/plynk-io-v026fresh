
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

interface FormatStringHelpDialogProps {
  trigger?: React.ReactNode;
}

export function FormatStringHelpDialog({ trigger }: FormatStringHelpDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full">
            <Info className="h-4 w-4" />
            <span className="sr-only">What is a Format String?</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            ✏️ What is a Format String?
          </DialogTitle>
          <DialogDescription>
            Customize how a value is displayed or output
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-md space-y-2">
              <h3 className="font-semibold text-lg">🔤 Example Formats:</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Format</th>
                      <th className="text-left py-2 px-3">Description</th>
                      <th className="text-left py-2 px-3">Result with `1922.91`</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">{"{value}"}</td>
                      <td className="py-2 px-3">Raw output injection</td>
                      <td className="py-2 px-3">`1922.91`</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">RPM: {"{value}"}</td>
                      <td className="py-2 px-3">Prefix label</td>
                      <td className="py-2 px-3">`RPM: 1922.91`</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">{"{value}"} km/h</td>
                      <td className="py-2 px-3">Add suffix</td>
                      <td className="py-2 px-3">`1922.91 km/h`</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">0.00</td>
                      <td className="py-2 px-3">Round to 2 decimals</td>
                      <td className="py-2 px-3">`1922.91`</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">0</td>
                      <td className="py-2 px-3">Round to whole number</td>
                      <td className="py-2 px-3">`1923`</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">0.0000</td>
                      <td className="py-2 px-3">Force 4 decimal places</td>
                      <td className="py-2 px-3">`1922.9100`</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">Speed = {"{value}"}</td>
                      <td className="py-2 px-3">Template</td>
                      <td className="py-2 px-3">`Speed = 1922.91`</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3 font-mono bg-black/10 rounded">RPM-{"{value}"}-Hz</td>
                      <td className="py-2 px-3">Compound format</td>
                      <td className="py-2 px-3">`RPM-1922.91-Hz`</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-md">
              <h3 className="font-semibold text-lg">🧠 How It Works</h3>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Format runs <span className="font-semibold">after</span> inversion and <span className="font-semibold">after</span> transform script</li>
                <li>If <code className="bg-black/10 px-1 rounded">{"{value}"}</code> is included → result replaces it</li>
                <li>If not, decimal formatting (<code className="bg-black/10 px-1 rounded">0.00</code>) is used instead</li>
              </ul>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
