
import React from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface GitHubDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userCode: string;
  verificationUri: string;
  isPolling: boolean;
}

export function GitHubDeviceDialog({
  open,
  onOpenChange,
  userCode,
  verificationUri,
  isPolling,
}: GitHubDeviceDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const handleOpenGitHub = () => {
    if (window.electron?.openExternal) {
      window.electron.openExternal(verificationUri);
    } else {
      window.open(verificationUri, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            GitHub Authorization Required
          </DialogTitle>
          <DialogDescription>
            Complete the authorization process to connect your GitHub account.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Your device activation code:
            </p>
            <div className="bg-muted rounded-lg p-4 font-mono text-lg font-bold text-center">
              {userCode}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={handleCopyCode}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Code
                </>
              )}
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Steps to complete:</p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Click "Open GitHub" below</li>
              <li>Paste or enter the activation code</li>
              <li>Authorize PLYNK-IO to access your account</li>
              <li>Return to this app - connection will complete automatically</li>
            </ol>
          </div>

          <Button onClick={handleOpenGitHub} className="w-full">
            <ExternalLink className="h-4 w-4 mr-2" />
            Open GitHub Authorization
          </Button>

          {isPolling && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Waiting for authorization...
              </p>
              <div className="mt-2">
                <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
