
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Play, Square, ExternalLink } from "lucide-react";

interface MessageListenerControlsProps {
  isListening: boolean;
  isDashboardListenerEnabled: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
}

const MessageListenerControls: React.FC<MessageListenerControlsProps> = ({
  isListening,
  isDashboardListenerEnabled,
  onStartListening,
  onStopListening
}) => {
  const navigate = useNavigate();
  const isStartDisabled = isDashboardListenerEnabled || isListening;

  const handleDashboardSettingsClick = () => {
    navigate('/dashboard?settings=open');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Message Capture</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isDashboardListenerEnabled && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center gap-2">
              <span>
                Dashboard Message Listener is active. Please disable it in Dashboard Settings to use manual capture.
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDashboardSettingsClick}
                className="h-auto p-1 hover:bg-destructive/20"
                title="Go to Dashboard Settings"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex items-center gap-4">
          {!isListening ? (
            <Button 
              onClick={onStartListening} 
              disabled={isStartDisabled}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Start Listening
            </Button>
          ) : (
            <Button 
              onClick={onStopListening} 
              variant="destructive" 
              className="flex items-center gap-2"
            >
              <Square className="h-4 w-4" />
              Stop Listening
            </Button>
          )}
          
          <span className="text-sm text-muted-foreground">
            {isListening 
              ? "Listening for WM_COPYDATA messages..." 
              : "Click Start Listening to begin message capture"
            }
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          Supports MAME, OutputBlaster, and other emulators that send WM_COPYDATA messages
        </div>
      </CardContent>
    </Card>
  );
};

export default MessageListenerControls;
