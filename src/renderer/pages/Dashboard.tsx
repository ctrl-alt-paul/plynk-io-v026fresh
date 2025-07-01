import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Settings, ChevronDown, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ProcessStatusCard } from '@/components/dashboard/ProcessStatusCard';
import { DashboardSettingsSection } from '@/components/dashboard/DashboardSettingsSection';
import { MemoryOutputTable } from '@/components/dashboard/MemoryOutputTable';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useLogContext } from '@/contexts/LogContext';
import { useMonitorControlsContext } from '@/contexts/MonitorControlsContext';
import { useMessageAttachment } from '@/contexts/MessageAttachmentContext';
import { getDevices } from '@/lib/deviceStore';
import { getAllWLEDProfiles, loadWLEDProfile } from '@/lib/wledProfiles';
import { profileStorage } from '@/lib/profileStorage';
import { Device } from '@/types/devices';
import { WLEDOutputProfile } from '@/lib/wledProfiles';

interface DescriptionConfig {
  changeIntervalSeconds: number;
  descriptions: string[];
}

export default function Dashboard() {
  const location = useLocation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [wledProfiles, setWledProfiles] = useState<WLEDOutputProfile[]>([]);
  const [currentDescription, setCurrentDescription] = useState<string>('Monitor active processes, memory polling, and real-time output data');
  const [descriptionConfig, setDescriptionConfig] = useState<DescriptionConfig | null>(null);
  
  const dashboardData = useDashboardData();
  const {
    isLoggingEnabled
  } = useLogContext();
  const {
    isProcessMonitorRunning,
    isMessageListenerEnabled
  } = useMonitorControlsContext();

  // Use global message attachment state
  const {
    detectedProfile,
    isDetecting,
    isWaitingForMameStart,
    messageOutputs,
    messageStatus,
    isListening,
    messageSpeed,
    timeoutCountdown
  } = useMessageAttachment();

  // Check URL parameters and auto-open settings if requested
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('settings') === 'open') {
      setIsSettingsOpen(true);
    }
  }, [location]);

  // Load description configuration
  useEffect(() => {
    const loadDescriptionConfig = async () => {
      try {
        const response = await fetch('/config/descriptions.json');
        const config: DescriptionConfig = await response.json();
        setDescriptionConfig(config);
        
        // Set initial random description
        const randomIndex = Math.floor(Math.random() * config.descriptions.length);
        setCurrentDescription(config.descriptions[randomIndex]);
      } catch (error) {
        console.error('Failed to load description config:', error);
        // Fallback to default description
        setCurrentDescription('Monitor active processes, memory polling, and real-time output data');
      }
    };

    loadDescriptionConfig();
  }, []);

  // Set up description rotation
  useEffect(() => {
    if (!descriptionConfig || descriptionConfig.descriptions.length === 0) return;

    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * descriptionConfig.descriptions.length);
      setCurrentDescription(descriptionConfig.descriptions[randomIndex]);
    }, descriptionConfig.changeIntervalSeconds * 1000);

    return () => clearInterval(interval);
  }, [descriptionConfig]);

  // Load devices and WLED profiles
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load devices
        const devicesList = await getDevices();
        setDevices(devicesList);

        // Load WLED profiles
        const wledProfileFiles = await getAllWLEDProfiles();
        const loadedWledProfiles = await Promise.all(wledProfileFiles.map(async fileName => {
          const profile = await loadWLEDProfile(fileName);
          return profile;
        }));
        setWledProfiles(loadedWledProfiles.filter(Boolean) as WLEDOutputProfile[]);
      } catch (error) {
        console.error('Failed to load device or WLED profile data:', error);
      }
    };
    loadData();
  }, []);

  // Determine if message listener is active (connected to a game)
  const isMessageListenerActive = messageStatus === 'active';
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6" />
            <h1 className="text-2xl font-bold tracking-tight">PLYNK-IO: Player Link Input Output</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                  <ChevronDown className={`h-4 w-4 transition-transform ${isSettingsOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </div>
        
        <p className="text-muted-foreground mt-1">
          {currentDescription}
        </p>
      </div>

      {/* Settings Section */}
      <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <CollapsibleContent className="space-y-2">
          <DashboardSettingsSection />
        </CollapsibleContent>
      </Collapsible>

      {/* Process Status Panel */}
      <ProcessStatusCard 
        processName={dashboardData.processName} 
        pid={dashboardData.pid} 
        activeGameProfile={dashboardData.activeGameProfile} 
        activeMemoryProfile={dashboardData.activeMemoryProfile} 
        isPolling={dashboardData.isPolling} 
        activeOutputs={dashboardData.activeOutputs} 
        targetInterval={dashboardData.targetInterval} 
        currentPollRate={dashboardData.currentPollRate} 
        skippedPolls={dashboardData.skippedPolls} 
        isLoading={dashboardData.isLoading} 
        detectedGameProfile={detectedProfile?.gameProfile} 
        isMessageDetected={!!detectedProfile} 
        isMessageListenerEnabled={isMessageListenerEnabled} 
        isMessageListenerActive={isMessageListenerActive} 
        isProcessMonitorRunning={isProcessMonitorRunning} 
        messageStatus={messageStatus} 
        isDetecting={isDetecting} 
        isWaitingForMameStart={isWaitingForMameStart} 
        messageSpeed={messageSpeed}
        timeoutCountdown={timeoutCountdown}
      />

      {/* Memory & Output Status Table */}
      <MemoryOutputTable 
        isPolling={dashboardData.isPolling} 
        activeGameProfile={dashboardData.activeGameProfile} 
        activeMemoryProfile={dashboardData.activeMemoryProfile} 
        detectedGameProfile={detectedProfile?.gameProfile} 
        isMessageDetected={!!detectedProfile} 
        messageOutputs={messageOutputs} 
        devices={devices} 
        wledProfiles={wledProfiles} 
      />
    </div>
  );
}
