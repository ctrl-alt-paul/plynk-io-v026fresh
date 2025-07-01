import React, { useState, useEffect, useCallback, useRef } from "react";
import { MemoryStick, RefreshCw, HelpCircle, FileEdit, Upload } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useProfileNavigation } from "@/hooks/useProfileNavigation";
import { Process } from "@/types/memoryAddress";
import { MemoryProfile } from "@/types/memoryProfiles";
import { profileStorage } from "@/lib/profileStorage";
import { UnsavedChangesProvider } from "@/components/UnsavedChangesProvider";
import { UnsavedChangesWarning } from "@/components/UnsavedChangesWarning";
import { MemoryProfileSubmissionDialog } from '@/components/MemoryProfileSubmissionDialog';
import { useGitHubAuth } from '@/state/githubAuthStore';

// Import the refactored components
import {
  AddressForm,
  MemoryAddressTable,
  MemoryProfileManager,
  PollingControls,
  JsonEditorDialog
} from "@/renderer/components/memory-manager";

// Import the help dialog
import { MemoryManagerHelpDialog } from "@/renderer/components/MemoryManagerHelpDialog";

// Import custom hooks
import { useMemoryAddressManager } from "@/hooks/useMemoryAddressManager";
import { useProfileManager } from "@/hooks/useProfileManager";
import { useMemoryReader } from "@/hooks/useMemoryReader";
import { useModuleNameUpdater } from "@/hooks/useModuleNameUpdater";

const MemoryManagerContent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [selectedProcess, setSelectedProcess] = useState<string | null>(null);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number | null>(null);
  
  // Add submission dialog state
  const [showSubmissionDialog, setShowSubmissionDialog] = useState(false);
  
  const {
    focusedMemoryProfile,
    clearFocus
  } = useProfileNavigation();
  
  // Add GitHub auth hook
  const { isConnected } = useGitHubAuth();
  
  // New state for JSON editing modal
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [editedJson, setEditedJson] = useState("");

  // Initialize memory address manager hook
  const addressManager = useMemoryAddressManager({
    selectedProcess
  });

  // Initialize profile manager hook
  const profileManager = useProfileManager({
    onAddressesLoad: addressManager.setMemoryAddresses,
    onSelectedProcessChange: setSelectedProcess,
    onPollIntervalChange: (interval) => memoryReader.setPollInterval(interval),
    selectedProcess,
    memoryAddresses: addressManager.memoryAddresses
  });

  // Initialize memory reader hook
  const memoryReader = useMemoryReader({
    onAddressesUpdate: addressManager.updateAddressesWithResults
  });

  // Initialize module name updater hook
  const moduleNameUpdater = useModuleNameUpdater({
    currentProfile: profileManager.currentProfile,
    selectedProcess,
    memoryAddresses: addressManager.memoryAddresses,
    updateMemoryAddressField: addressManager.updateMemoryAddressField
  });
  
  // Load available memory profiles on component mount
  useEffect(() => {
    const loadAvailableProfiles = async () => {
      try {
        const profiles = await profileManager.loadAvailableProfiles();

        // Check if there's a profile in the URL query params
        const queryParams = new URLSearchParams(location.search);
        const profileName = queryParams.get('profile');
        if (profileName) {
          profileManager.loadMemoryProfile(profileName);
        } else if (focusedMemoryProfile && focusedMemoryProfile.fileName) {
          // Load profile from context if available
          profileManager.loadMemoryProfile(focusedMemoryProfile.fileName);
        }
      } catch (error) {
        //console.error("Failed to load memory profiles:", error);
        toast.error("Failed to load memory profiles");
      }
    };
    loadAvailableProfiles();
    fetchProcesses();
    return () => {
      if (memoryReader.isPolling) {
        memoryReader.handleStopPolling();
      }
      // Clear focus when component unmounts
      clearFocus();
    };
  }, [location.search, focusedMemoryProfile]);
  
  useEffect(() => {
    if (!memoryReader.isPollEnabled && memoryReader.isPolling) {
      memoryReader.handleStopPolling();
    }
  }, [memoryReader.isPollEnabled, memoryReader.isPolling]);
  
  // Reset offsets when toggling pointer chain mode
  useEffect(() => {
    if (!addressManager.usePointerChain) {
      addressManager.clearNewOffsets();
    }
  }, [addressManager.usePointerChain]);
  
  const fetchProcesses = useCallback(async () => {
    try {
      if (window.electron) {
        memoryReader.setIsLoading(true);
        const processList = await window.electron.getProcesses();
        setProcesses(processList.sort((a, b) => a.name.localeCompare(b.name)));
        memoryReader.setIsLoading(false);
      }
    } catch (error) {
      toast.error("Failed to fetch processes");
      memoryReader.setIsLoading(false);
    }
  }, []);
  
  // Handle applying edited JSON - simplified to not auto-save
  const handleApplyEditedJson = () => {
    try {
      //console.log("Applying edited JSON:", editedJson);
      const parsed = JSON.parse(editedJson);

      if (!parsed || typeof parsed !== "object") {
        toast.error("Invalid profile structure");
        return;
      }

      if (typeof parsed.process === "string") {
        const processName = parsed.process.trim();
        //console.log(`Setting process name from JSON editor: "${processName}"`);
        setSelectedProcess(processName);
      } else {
        //console.warn("No process field found in JSON data");
        toast.error("Missing 'process' field in profile - this field is required");
        return;
      }

      // Check for invalid root-level moduleName
      if ('moduleName' in parsed && parsed.moduleName !== undefined) {
        //console.warn("Removing invalid root-level moduleName field from JSON data");
        toast.warning("Invalid root-level 'moduleName' field removed - please use 'process' instead");
        delete parsed.moduleName;
      }

      if (typeof parsed.pollInterval === "number") {
        profileManager.setDefaultPollInterval(parsed.pollInterval);
        memoryReader.setPollInterval(parsed.pollInterval);
      }

      // Define allowed keys for a memory output
      const allowedKeys = new Set([
        "label",
        "type",
        "address",
        "offset",
        "offsetFormat",
        "invert",
        "format",
        "script",
        "offsets",
        "bitmask",
        "bitwiseOp",
        "bitfield",
        "useModuleOffset",
        "moduleName"
      ]);

      // Build clean memoryAddresses array
      const sanitizedOutputs = Array.isArray(parsed.outputs)
        ? parsed.outputs.map((record) => {
            const cleaned: any = {
              id: Date.now().toString() + Math.random().toString(36).substring(2),
              value: null,
              rawValue: null,
              finalValue: null,
              lastRead: null
            };

            for (const key of Object.keys(record)) {
              if (allowedKeys.has(key)) {
                cleaned[key] = record[key];
              }
            }

            // Apply default fallbacks
            cleaned.label = cleaned.label ?? "";
            cleaned.type = cleaned.type ?? "Int32";
            cleaned.address = cleaned.address ?? "";
            cleaned.offset = cleaned.offset ?? "";
            cleaned.offsetFormat = cleaned.offsetFormat ?? "hex";
            cleaned.useModuleOffset = cleaned.useModuleOffset ?? false;
            cleaned.moduleName = cleaned.moduleName ?? "";
            cleaned.invert = cleaned.invert ?? false;
            cleaned.format = cleaned.format ?? "";
            cleaned.script = cleaned.script ?? "";
            cleaned.offsets = cleaned.offsets ?? [];
            cleaned.bitmask = cleaned.bitmask ?? "";
            cleaned.bitwiseOp = cleaned.bitwiseOp ?? "";
            cleaned.bitfield = cleaned.bitfield ?? false;

            return cleaned;
          })
        : [];

      addressManager.setMemoryAddresses(sanitizedOutputs);
      
      toast.success("Profile updated from JSON");
      setShowJsonModal(false);
    } catch (e) {
      //console.error("JSON parse failed", e);
      toast.error("Failed to parse JSON");
    }
  };

  // Add function to get user-created outputs
  const getUserCreatedOutputs = () => {
    return addressManager.memoryAddresses.filter(addr => addr.source === 'user');
  };

  const hasValidAddresses = addressManager.memoryAddresses.length > 0;
  const userOutputs = getUserCreatedOutputs();
  const hasUserOutputs = userOutputs.length > 0;

  return (
    <div className="container mx-auto py-2">
      {/* Unsaved Changes Warning */}
      <UnsavedChangesWarning />
      
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MemoryStick className="h-6 w-6" />
            <h1 className="text-2xl font-bold tracking-tight">Memory Manager</h1>
          </div>
          
          {/* Memory Profile Controls */}
          <div className="flex items-center gap-3">
            <MemoryManagerHelpDialog 
              trigger={
                <Button variant="ghost" className="p-1 w-auto h-auto min-h-0 icon-large-override">
                  <HelpCircle className="text-blue-500" />
                </Button>
              } 
            />
            
            {/* Add Submission Button */}
            {hasUserOutputs && (
              <Button
                onClick={() => setShowSubmissionDialog(true)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Submit to Community
                {!isConnected && (
                  <Badge variant="secondary" className="text-xs">
                    GitHub Required
                  </Badge>
                )}
              </Button>
            )}
            
            <MemoryProfileManager
              availableProfiles={profileManager.availableProfiles}
              currentProfileName={profileManager.currentProfileName}
              currentProfile={profileManager.currentProfile}
              memoryAddresses={addressManager.memoryAddresses}
              defaultPollInterval={profileManager.defaultPollInterval}
              isLoading={memoryReader.isLoading}
              isSaving={profileManager.isSaving}
              selectedProcess={selectedProcess}
              onProfileSelect={(profileName, profileType: 'default' | 'user' | 'community') => {
                // Clear original addresses when switching profiles
                addressManager.clearOriginalAddresses();
                profileManager.loadMemoryProfile(profileName, profileType);
              }}
              onSaveAsNew={() => {
                if (profileManager.currentProfile) {
                  // Make sure we have the most up-to-date process in the JSON
                  const currentProcess = selectedProcess || profileManager.currentProfile.process;
                  const profileObj = {
                    process: currentProcess,
                    pollInterval: profileManager.defaultPollInterval,
                    outputs: addressManager.memoryAddresses.map(addr => 
                      profileStorage.convertAddressToProfileOutput(addr)
                    )
                  };
                  setEditedJson(JSON.stringify(profileObj, null, 2));
                } else {
                  setEditedJson(JSON.stringify({
                    process: selectedProcess || "",
                    pollInterval: profileManager.defaultPollInterval,
                    outputs: addressManager.memoryAddresses.map(addr => 
                      profileStorage.convertAddressToProfileOutput(addr)
                    )
                  }, null, 2));
                }
                setShowJsonModal(true);
              }}
              onOverwrite={() => profileManager.saveMemoryProfile(profileManager.currentProfileName!, true)}
              onDelete={profileManager.deleteProfile}
              onClear={() => {
                addressManager.clearOriginalAddresses();
                profileManager.clearData();
              }}
              onSaveConfirm={profileManager.saveMemoryProfile}
              onOverwriteConfirm={() => profileManager.saveMemoryProfile(profileManager.currentProfileName!, true)}
              openJsonEditor={(json) => {
                setEditedJson(json);
                setShowJsonModal(true);
              }}
            />
          </div>
        </div>

        <p className="text-muted-foreground mt-1 mb-6">
          Create and manage memory profiles for reading process memory with custom address mappings
        </p>
      </div>

      <div className="grid gap-6">
        {/* New Memory Address Section */}
        <div className="bg-card p-6 rounded-lg shadow border">
          {/* Process Selection with Update Button */}
          <div className="flex flex-col gap-4">
            <PollingControls
              isPollEnabled={memoryReader.isPollEnabled}
              isPolling={memoryReader.isPolling}
              pollInterval={memoryReader.pollInterval}
              isLoading={memoryReader.isLoading}
              selectedProcess={selectedProcess}
              fetchProcesses={fetchProcesses}
              setPollInterval={memoryReader.setPollInterval}
              startPolling={() => memoryReader.handleStartPolling(selectedProcess, addressManager.memoryAddresses)}
              stopPolling={memoryReader.handleStopPolling}
              readMemory={() => memoryReader.readMemory(selectedProcess, addressManager.memoryAddresses)}
              onProcessChange={setSelectedProcess}
              currentProfileName={profileManager.currentProfileName}
              hasAddresses={hasValidAddresses}
              mode="process-only"
              disableCaching={memoryReader.disableCaching}
              toggleCaching={() => memoryReader.setDisableCaching(!memoryReader.disableCaching)}
              errorCount={memoryReader.errorCount}
              lastError={memoryReader.lastError}
            />
            
            {/* Update Module Names Button */}
            {moduleNameUpdater.showUpdateButton && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <FileEdit className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-800">
                  Process changed from "{moduleNameUpdater.originalProcess}" to "{selectedProcess}". 
                  Update module names in memory addresses?
                </span>
                <Button
                  onClick={moduleNameUpdater.updateModuleNames}
                  size="sm"
                  className="ml-auto"
                >
                  Update Module Names
                </Button>
              </div>
            )}
          </div>
          
          <AddressForm
            newAddress={addressManager.newAddress}
            updateNewAddressField={addressManager.updateNewAddressField}
            usePointerChain={addressManager.usePointerChain}
            setUsePointerChain={addressManager.setUsePointerChain}
            offsets={addressManager.offsets}
            addOffset={addressManager.addNewOffset}
            removeOffset={addressManager.removeNewOffset}
            clearOffsets={addressManager.clearNewOffsets}
            currentOffset={addressManager.currentOffset}
            setCurrentOffset={addressManager.setCurrentOffset}
            addMemoryAddress={addressManager.addMemoryAddress}
            selectedProcess={selectedProcess}
            toggleUseModuleOffset={addressManager.toggleUseModuleOffset}
          />
        </div>
        
        {/* Profile Settings Section */}
        {profileManager.currentProfileName && (
          <div className="bg-blue-50 p-4 rounded-md">
            <h2 className="text-xl font-semibold mb-4">Profile Settings: {profileManager.currentProfileName}</h2>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="poll-interval">Poll Interval (ms)</Label>
                <input
                  id="poll-interval"
                  type="number"
                  min="1"
                  className="w-24 rounded border border-gray-300 px-2 py-1"
                  value={profileManager.defaultPollInterval}
                  onChange={(e) => {
                    const newValue = parseInt(e.target.value, 10);
                    if (newValue > 0) {
                      profileManager.setDefaultPollInterval(newValue);
                      memoryReader.setPollInterval(newValue);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Memory Addresses Section */}
        <div className={`${profileManager.currentProfileName ? 'bg-blue-50 p-4 rounded-md' : ''}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Memory Addresses</h2>
            
            {/* Polling Controls */}
            {hasValidAddresses && (
              <div className="flex items-center gap-2">
                <PollingControls
                  isPollEnabled={memoryReader.isPollEnabled}
                  isPolling={memoryReader.isPolling}
                  pollInterval={memoryReader.pollInterval}
                  isLoading={memoryReader.isLoading}
                  selectedProcess={selectedProcess}
                  fetchProcesses={fetchProcesses}
                  setPollInterval={memoryReader.setPollInterval}
                  startPolling={() => memoryReader.handleStartPolling(selectedProcess, addressManager.memoryAddresses)}
                  stopPolling={memoryReader.handleStopPolling}
                  readMemory={() => memoryReader.readMemory(selectedProcess, addressManager.memoryAddresses)}
                  onProcessChange={setSelectedProcess}
                  currentProfileName={profileManager.currentProfileName}
                  hasAddresses={hasValidAddresses}
                  mode="controls-only"
                  performanceMetrics={memoryReader.performanceMetrics}
                  disableCaching={memoryReader.disableCaching}
                  toggleCaching={() => memoryReader.setDisableCaching(!memoryReader.disableCaching)}
                  fastModeEnabled={memoryReader.fastModeEnabled}
                  toggleFastMode={memoryReader.toggleFastMode}
                  errorCount={memoryReader.errorCount}
                  lastError={memoryReader.lastError}
                />
              </div>
            )}
          </div>
          
          <MemoryAddressTable
            memoryAddresses={addressManager.memoryAddresses}
            removeMemoryAddress={addressManager.removeMemoryAddress}
            updateMemoryAddressField={addressManager.updateMemoryAddressField}
            addOffset={addressManager.addOffset}
            removeOffset={addressManager.removeOffset}
            newOffset={addressManager.newOffset}
            setNewOffset={addressManager.setNewOffset}
            moveMemoryAddress={addressManager.moveMemoryAddress}
          />
        </div>
      </div>
      
      {/* Add Submission Dialog */}
      {profileManager.currentProfile && (
        <MemoryProfileSubmissionDialog
          open={showSubmissionDialog}
          onOpenChange={setShowSubmissionDialog}
          profile={profileManager.currentProfile}
          userOutputs={userOutputs}
        />
      )}
      
      {/* JSON Editor Dialog */}
      <JsonEditorDialog
        open={showJsonModal}
        onOpenChange={setShowJsonModal}
        jsonContent={editedJson}
        onJsonContentChange={setEditedJson}
        onApply={handleApplyEditedJson}
      />
      
      {/* Bottom controls */}
      <div className="mt-6 flex justify-end">
        <div className="flex items-center">
          <div className="flex items-center gap-2">
            <Label htmlFor="debug-logging" className="text-sm">Debug Logging</Label>
            <Switch 
              id="debug-logging" 
              checked={memoryReader.debugLoggingEnabled} 
              onCheckedChange={(checked) => memoryReader.setDebugLoggingEnabled(checked)} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default function MemoryManager() {
  return (
    <UnsavedChangesProvider>
      <MemoryManagerContent />
    </UnsavedChangesProvider>
  );
}
