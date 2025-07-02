
import React, { useEffect } from 'react';
import { ExternalLink, Copy, Check, CheckCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState } from 'react';
import { GitHubUser } from '@/state/githubAuthStore';
import { GitHubAuthService } from '@/services/githubAuth';

interface GitHubDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userCode: string;
  verificationUri: string;
  isPolling: boolean;
  isConnected: boolean;
  connectedUser: GitHubUser | null;
  onCancel: () => void;
}

export function GitHubDeviceDialog({
  open,
  onOpenChange,
  userCode,
  verificationUri,
  isPolling,
  isConnected,
  connectedUser,
  onCancel,
}: GitHubDeviceDialogProps) {
  const [copied, setCopied] = useState(false);

  // Clean up polling when dialog is closed or component unmounts
  useEffect(() => {
    return () => {
      if (!isConnected) {
        console.log('Cleaning up GitHub polling on dialog close');
        GitHubAuthService.stopPolling();
      }
    };
  }, [isConnected]);

  // Clean up polling when dialog is explicitly closed
  useEffect(() => {
    if (!open && !isConnected) {
      console.log('Dialog closed, stopping GitHub polling');
      GitHubAuthService.stopPolling();
    }
  }, [open, isConnected]);

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
    console.log('Opening GitHub authorization page');
    if (window.electron?.openExternal) {
      window.electron.openExternal(verificationUri);
    } else {
      window.open(verificationUri, '_blank');
    }
  };

  const handleButtonClick = () => {
    if (isConnected) {
      onOpenChange(false);
    } else {
      console.log('Cancelling GitHub authorization');
      GitHubAuthService.stopPolling();
      onCancel();
    }
  };

  const handleDialogOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isConnected) {
      console.log('Dialog closing, stopping polling');
      GitHubAuthService.stopPolling();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isConnected ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                GitHub Connected Successfully!
              </>
            ) : (
              'GitHub Authorization Required'
            )}
          </DialogTitle>
          <DialogDescription>
            {isConnected 
              ? 'Your GitHub account has been successfully connected to PLYNK-IO.'
              : 'Complete the authorization process to connect your GitHub account.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {isConnected && connectedUser ? (
            // Success state
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={connectedUser.avatar_url} alt={connectedUser.name || connectedUser.login} />
                  <AvatarFallback>{(connectedUser.name || connectedUser.login).charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="font-medium text-green-800">
                    {connectedUser.name || connectedUser.login}
                  </p>
                  <p className="text-sm text-green-600">
                    @{connectedUser.login}
                  </p>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                You can now submit your projects to GitHub and view your submissions.
              </p>
            </div>
          ) : (
            // Authorization flow state
            <>
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
            </>
          )}
          
          <Button onClick={handleButtonClick} variant="outline" className="w-full">
            {isConnected ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
