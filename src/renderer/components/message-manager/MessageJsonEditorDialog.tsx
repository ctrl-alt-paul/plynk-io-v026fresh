
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";

interface MessageJsonEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jsonContent: string;
  onJsonContentChange: (content: string) => void;
  onApply: () => void;
}

export function MessageJsonEditorDialog({
  open,
  onOpenChange,
  jsonContent,
  onJsonContentChange,
  onApply
}: MessageJsonEditorDialogProps) {
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string>("");
  
  // Extract profile name from JSON when dialog opens
  useEffect(() => {
    if (open && jsonContent) {
      try {
        const parsed = JSON.parse(jsonContent);
        if (parsed.profileName) {
          // Remove .json extension if present for display (case-insensitive)
          const displayName = parsed.profileName.replace(/\.json$/i, '');
          setProfileName(displayName);
        } else {
          setProfileName("");
        }
      } catch (e) {
        setProfileName("");
      }
    }
  }, [open, jsonContent]);

  // Live update JSON content when profile name changes
  const updateJsonWithProfileName = (newProfileName: string) => {
    try {
      const parsed = JSON.parse(jsonContent);
      
      // Trim whitespace and check if .json extension is already present (case-insensitive)
      const trimmedName = newProfileName.trim();
      const hasJsonExtension = /\.json$/i.test(trimmedName);
      
      // Only add .json extension if not already present
      const finalProfileName = hasJsonExtension 
        ? trimmedName 
        : `${trimmedName}.json`;
      
      // Update the profileName in the JSON
      parsed.profileName = finalProfileName;
      
      // Update the JSON content
      onJsonContentChange(JSON.stringify(parsed, null, 2));
      
      // Clear any existing errors since we successfully updated
      setJsonError(null);
    } catch (e) {
      // If JSON is invalid, don't break the user experience
      // Just update the profile name state, validation will happen on Apply
      console.log('JSON parsing error during live update:', e);
    }
  };

  const handleProfileNameChange = (newName: string) => {
    setProfileName(newName);
    updateJsonWithProfileName(newName);
  };
  
  // Validate JSON before applying
  const handleValidateAndApply = () => {
    try {
      // Ensure profile name is provided
      if (!profileName || !profileName.trim()) {
        setJsonError("Profile name is required.");
        return;
      }

      const parsed = JSON.parse(jsonContent);

      // Check if outputs field exists and is an array
      if (!parsed.outputs || !Array.isArray(parsed.outputs)) {
        setJsonError("The 'outputs' field is missing or not an array. This field is required.");
        return;
      }

      // Validate messageProfileType if present
      if (parsed.messageProfileType && !['default', 'user', 'community'].includes(parsed.messageProfileType)) {
        setJsonError("The 'messageProfileType' field must be either 'default', 'user', or 'community'.");
        return;
      }

      // If messageProfileType is missing, add it as 'user' for new profiles
      if (!parsed.messageProfileType) {
        parsed.messageProfileType = 'user';
        onJsonContentChange(JSON.stringify(parsed, null, 2));
      }
      
      // Validate outputs structure
      for (let i = 0; i < parsed.outputs.length; i++) {
        const output = parsed.outputs[i];
        if (!output.key || typeof output.key !== 'string') {
          setJsonError(`Output at index ${i} is missing required 'key' field.`);
          return;
        }
        if (!output.label || typeof output.label !== 'string') {
          setJsonError(`Output at index ${i} is missing required 'label' field.`);
          return;
        }
      }
      
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
          <DialogTitle>Edit Message Profile JSON</DialogTitle>
          <DialogDescription>
            Enter the profile name and edit the JSON structure. The profile name will automatically update the JSON content in real-time. The <code className="bg-blue-100 px-1 rounded">outputs</code> field contains the message outputs array. The <code className="bg-blue-100 px-1 rounded">messageProfileType</code> field indicates whether this is a 'default', 'user', or 'community' profile.
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
          <div className="space-y-2">
            <Label htmlFor="profileName">Profile Name</Label>
            <Input
              id="profileName"
              value={profileName}
              onChange={(e) => {
                handleProfileNameChange(e.target.value);
                setJsonError(null); // Clear error on change
              }}
              placeholder="Enter profile name (e.g., TestProfile)"
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              The .json extension will be added automatically and the JSON content will update as you type.
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="jsonContent">JSON Content</Label>
            <Textarea
              id="jsonContent"
              value={jsonContent}
              onChange={(e) => {
                onJsonContentChange(e.target.value);
                setJsonError(null); // Clear error on change
              }}
              rows={18}
              className="font-mono"
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="default" onClick={handleValidateAndApply}>Apply</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
