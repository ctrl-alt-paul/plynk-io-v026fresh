
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";

interface JsonEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jsonContent: string;
  onJsonContentChange: (content: string) => void;
  onApply: () => void;
}

export function JsonEditorDialog({
  open,
  onOpenChange,
  jsonContent,
  onJsonContentChange,
  onApply
}: JsonEditorDialogProps) {
  const [jsonError, setJsonError] = useState<string | null>(null);
  
  // Validate JSON before applying
  const handleValidateAndApply = () => {
    try {
      const parsed = JSON.parse(jsonContent);
      
      // Check if process field exists and is not empty
      if (!parsed.process || typeof parsed.process !== 'string' || !parsed.process.trim()) {
        setJsonError("The 'process' field is missing or empty. This field is required.");
        return;
      }

      // Validate memoryProfileType if present
      if (parsed.memoryProfileType && !['default', 'user', 'community'].includes(parsed.memoryProfileType)) {
        setJsonError("The 'memoryProfileType' field must be either 'default', 'user', or 'community'.");
        return;
      }

      // If memoryProfileType is missing, add it as 'user' for new profiles
      if (!parsed.memoryProfileType) {
        parsed.memoryProfileType = 'user';
        onJsonContentChange(JSON.stringify(parsed, null, 2));
      }
      
      // Additional validation can be added here
      
      // Clear any previous errors
      setJsonError(null);
      
      // Apply changes
      onApply();
    } catch (e) {
      setJsonError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Edit Memory Profile JSON</DialogTitle>
          <DialogDescription>
            Edit the full JSON of the memory profile. The <code className="bg-blue-100 px-1 rounded">process</code> field is required and specifies the executable to attach to. The <code className="bg-blue-100 px-1 rounded">memoryProfileType</code> field indicates whether this is a 'default', 'user', or 'community' profile.
          </DialogDescription>
        </DialogHeader>
        
        {jsonError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertDescription>
              {jsonError}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-4">
          <Textarea
            value={jsonContent}
            onChange={(e) => {
              onJsonContentChange(e.target.value);
              setJsonError(null); // Clear error on change
            }}
            rows={18}
            className="font-mono"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="default" onClick={handleValidateAndApply}>Apply</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
