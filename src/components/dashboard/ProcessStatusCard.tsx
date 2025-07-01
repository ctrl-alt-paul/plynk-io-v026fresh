
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Cpu, Radio, Search } from 'lucide-react';

interface ProcessStatusCardProps {
  processName: string | null;
  pid: number | null;
  activeGameProfile: string | null;
  activeMemoryProfile: string | null;
  isPolling: boolean;
  activeOutputs: {
    enabled: number;
    total: number;
  };
  targetInterval: number;
  currentPollRate: number;
  skippedPolls: number;
  isLoading: boolean;
  detectedGameProfile?: any;
  isMessageDetected?: boolean;
  isMessageListenerEnabled?: boolean;
  isMessageListenerActive?: boolean;
  isProcessMonitorRunning?: boolean;
  messageStatus?: 'off' | 'listening' | 'active';
  isDetecting?: boolean;
  isWaitingForMameStart?: boolean;
  messageSpeed?: number;
  timeoutCountdown?: number | null;
}

export function ProcessStatusCard({
  processName,
  pid,
  activeGameProfile,
  activeMemoryProfile,
  isPolling,
  activeOutputs,
  targetInterval,
  currentPollRate,
  skippedPolls,
  isLoading,
  detectedGameProfile,
  isMessageDetected,
  isMessageListenerEnabled = false,
  isMessageListenerActive = false,
  isProcessMonitorRunning = false,
  messageStatus = 'off',
  isDetecting = false,
  isWaitingForMameStart = false,
  messageSpeed = 0,
  timeoutCountdown = null
}: ProcessStatusCardProps) {
  // Memoized formatters to prevent unnecessary recalculations
  const formatPollRate = useMemo(() => (rate: number): string => {
    return rate > 0 ? `${rate.toFixed(1)} polls/sec` : '0 polls/sec';
  }, []);
  
  const formatMessageSpeed = useMemo(() => (speed: number): string => {
    return speed > 0 ? `${speed.toFixed(1)} msgs/sec` : '0 msgs/sec';
  }, []);
  
  const formatInterval = useMemo(() => (ms: number): string => {
    return `${ms}ms`;
  }, []);

  // Memoized profile display values - prioritize detected profile
  const displayValues = useMemo(() => {
    let displayGameProfile = activeGameProfile;
    let displayMemoryProfile = activeMemoryProfile;
    let displayMessagesProfile: string | null = null;
    let displayActiveOutputs = activeOutputs;
    
    // If we have a detected game profile, show it instead
    if (detectedGameProfile) {
      displayGameProfile = detectedGameProfile.profileName;
      displayMemoryProfile = detectedGameProfile.memoryFile || displayMemoryProfile;
      displayMessagesProfile = detectedGameProfile.messageFile || "Built-in";
      
      // Calculate outputs from detected profile
      const outputs = detectedGameProfile.outputs || [];
      displayActiveOutputs = {
        total: outputs.length,
        enabled: outputs.filter((output: any) => output.isActive !== false).length
      };
    }
    
    return { displayGameProfile, displayMemoryProfile, displayMessagesProfile, displayActiveOutputs };
  }, [detectedGameProfile, activeGameProfile, activeMemoryProfile, activeOutputs]);

  // Memoized process status
  const processStatus = useMemo(() => {
    if (isPolling) {
      return {
        label: 'Active',
        badge: (
          <Badge className="bg-green-500 text-white hover:bg-green-600">
            <Check className="h-3 w-3 mr-1" />
            Active
          </Badge>
        )
      };
    }
    
    if (isProcessMonitorRunning) {
      return {
        label: 'Listening',
        badge: (
          <Badge variant="outline" className="text-blue-700 border-blue-300">
            <Radio className="h-3 w-3 mr-1" />
            Listening
          </Badge>
        )
      };
    }
    
    return {
      label: 'Inactive',
      badge: (
        <Badge variant="destructive">
          <X className="h-3 w-3 mr-1" />
          Inactive
        </Badge>
      )
    };
  }, [isPolling, isProcessMonitorRunning]);

  // Memoized message listener status
  const messageListenerStatus = useMemo(() => {
    if (messageStatus === 'off') {
      return {
        label: 'Inactive',
        badge: (
          <Badge variant="destructive">
            <X className="h-3 w-3 mr-1" />
            Inactive
          </Badge>
        )
      };
    }
    
    if (messageStatus === 'active') {
      return {
        label: 'Active',
        badge: (
          <Badge className="bg-green-500 text-white hover:bg-green-600">
            <Check className="h-3 w-3 mr-1" />
            Active
          </Badge>
        )
      };
    }

    if (messageStatus === 'listening') {
      if (isDetecting) {
        return {
          label: 'Detecting',
          badge: (
            <Badge variant="outline" className="text-orange-700 border-orange-300">
              <Search className="h-3 w-3 mr-1" />
              {isWaitingForMameStart ? 'Detecting...' : 'Listening'}
            </Badge>
          )
        };
      }
      
      return {
        label: 'Listening',
        badge: (
          <Badge variant="outline" className="text-blue-700 border-blue-300">
            <Radio className="h-3 w-3 mr-1" />
            Listening
          </Badge>
        )
      };
    }

    return {
      label: 'Unknown',
      badge: <Badge variant="secondary">Unknown</Badge>
    };
  }, [messageStatus, isDetecting, isWaitingForMameStart]);
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Cpu className="h-5 w-5" />
            <span>Process Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Cpu className="h-5 w-5" />
          <span>Process and Messages Status</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Process Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Messages Status:</span>
              {messageListenerStatus.badge}
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Process Status:</span>
              {processStatus.badge}
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Process Name:</span>
              <span className="text-sm font-mono">
                {processName || "No process attached"}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">PID:</span>
              <span className="text-sm font-mono">
                {pid || "N/A"}
              </span>
            </div>
          </div>

          {/* Profile Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Game Profile:</span>
              <div className="flex items-center space-x-1">
                <span className="text-sm font-mono">
                  {displayValues.displayGameProfile || "None"}
                </span>
                {isMessageDetected && displayValues.displayGameProfile && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">
                    Message
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Memory Profile:</span>
              <span className="text-sm font-mono">
                {displayValues.displayMemoryProfile || "None"}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Messages Profile:</span>
              <span className="text-sm font-mono">
                {displayValues.displayMessagesProfile || "None"}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Active Outputs:</span>
              <span className="text-sm font-mono">
                {displayValues.displayActiveOutputs.enabled} of {displayValues.displayActiveOutputs.total}
              </span>
            </div>
          </div>

          {/* Performance Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Target Interval:</span>
              <span className="text-sm font-mono">
                {formatInterval(targetInterval)}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Rate:</span>
              <span className="text-sm font-mono">
                {formatPollRate(currentPollRate)}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Skipped Polls:</span>
              <span className="text-sm font-mono">
                {skippedPolls}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Message Speed:</span>
              <span className="text-sm font-mono">
                {formatMessageSpeed(messageSpeed)}
              </span>
            </div>
            
            {/* Timeout Countdown - only show when active */}
            {timeoutCountdown !== null && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Timeout:</span>
                <span className={`text-sm font-mono ${timeoutCountdown <= 10 ? 'text-red-600 font-semibold' : 'text-orange-600'}`}>
                  {timeoutCountdown}s
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Status Indicator */}
        {!isPolling && messageStatus === 'off' && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              {detectedGameProfile ? "Game profile auto-detected via messages. Start memory polling to see live data." : "No active memory polling or messages read."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
