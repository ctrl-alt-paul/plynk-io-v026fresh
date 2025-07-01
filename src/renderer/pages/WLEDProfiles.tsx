import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuid } from 'uuid';
import { 
  getAllWLEDProfiles, 
  loadWLEDProfile, 
  saveWLEDProfile,
  deleteWLEDProfile,
  WLEDOutputProfile,
  WLEDSegment,
  WLEDRule,
  WLEDEffect,
  importAndSaveWLEDProfile,
  getDefaultEffects
} from '@/lib/wledProfiles';
import { useWLEDDeviceConnection } from '@/hooks/useWLEDDeviceConnection';
import { useWLEDProfileChanges } from '@/hooks/useWLEDProfileChanges';
import { UnsavedChangesProvider } from '@/components/UnsavedChangesProvider';
import { UnsavedChangesWarning } from '@/components/UnsavedChangesWarning';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, Trash2, Save, Edit, X, Settings, ArrowRight, 
  AlertTriangle, CheckCircle, RefreshCw, Loader, ChevronDown, ChevronUp, Lightbulb 
} from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { deviceStore, getWLEDDevices, findWLEDDeviceByIP } from '@/lib/deviceStore';
import { WLEDDevice } from '@/types/devices';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { TableCompact } from '@/components/ui/table-compact';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { WLEDRuleEditor, ImportSettingsDialog } from '@/components/wled';
import { DeleteConfirmDialog } from '@/renderer/components/memory-manager/dialogs/DeleteConfirmDialog';
import { getProfileSegments } from '@/lib/wledSegmentUtils';
import { WLEDProfilesHelpDialog } from '@/renderer/components/WLEDProfilesHelpDialog';
import { HelpCircle } from 'lucide-react';

// Update WLEDRule interface to support multiple segments
interface WLEDProfileWithRules extends WLEDOutputProfile {
  rules: WLEDRule[];
}

// Updated WLEDRule interface with segments array
interface UpdatedWLEDRule extends Omit<WLEDRule, 'segmentId'> {
  segments: number[];
}

// Interface for profile table display data
interface ProfileTableData {
  id: string;
  name: string;
  description?: string; // Add description to table data
  deviceIP: string;
  rulesCount: number;
  fileName: string;
}

// New interface for device-grouped profiles
interface DeviceProfileGroup {
  deviceName: string;
  deviceIP: string;
  profiles: ProfileTableData[];
}

// Updated schema for profile form validation to include description
const profileFormSchema = z.object({
  name: z.string().min(2, { message: "Profile name must be at least 2 characters" }),
  deviceIP: z.string().min(7, { message: "Please select a WLED device" }),
  description: z.string().optional(), // Description is optional
});

const WLEDProfilesContent: React.FC = () => {
  const { toast } = useToast();
  const [profileList, setProfileList] = useState<string[]>([]);
  const [profileTableData, setProfileTableData] = useState<ProfileTableData[]>([]);
  const [deviceGroups, setDeviceGroups] = useState<DeviceProfileGroup[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<WLEDProfileWithRules | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);
  const [wledDevices, setWledDevices] = useState<WLEDDevice[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [expandedRules, setExpandedRules] = useState<string[]>([]);
  const [isCreatingNewProfile, setIsCreatingNewProfile] = useState<boolean>(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState<boolean>(false);
  const [testingProfiles, setTestingProfiles] = useState<Record<string, boolean>>({});
  
  // WLED device connection hook
  const {
    ipAddress,
    isConnected,
    isLoading: isFetchingEffects,
    effects: availableEffects,
    availableSegments,
    connectToDevice,
    disconnectDevice,
    isConnectedTo,
    setProfileSegments // Get the new function from the hook
  } = useWLEDDeviceConnection();

  // Updated form definition for profile details to include description
  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      deviceIP: "",
      description: "", // Initialize empty description
    },
  });

  // Unsaved changes tracking hook
  const {
    setOriginalProfileState,
    clearOriginalState
  } = useWLEDProfileChanges(
    selectedProfile,
    editingProfileId,
    isCreatingNewProfile,
    isLoadingProfile,
    form
  );

  // Load all available profiles on component mount
  useEffect(() => {
    const initialize = async () => {
      // First load devices, then load profiles
      await loadWledDevices();
      await loadProfiles();
    };
    
    initialize();
  }, []);

  // Load WLED devices from the device store
  const loadWledDevices = async () => {
    try {
      //console.log("Loading WLED devices from device store...");
      await deviceStore.loadDevices();
      const devices = getWLEDDevices();
      //console.log("WLED devices loaded:", devices.map(d => `${d.name} (${d.ipAddress})`));
      setWledDevices(devices);
      return devices;
    } catch (error) {
      //console.error("Failed to load WLED devices:", error);
      toast({
        title: "Error Loading Devices",
        description: "Failed to load WLED devices from device store.",
        variant: "destructive",
      });
      return [];
    }
  };

  // Fetch all saved profiles and their data for the table
  const loadProfiles = async () => {
    try {
      const profiles = await getAllWLEDProfiles();
      setProfileList(profiles);
      
      // Load profile details for table display
      const tableData: ProfileTableData[] = [];
      for (const profileId of profiles) {
        const profile = await loadWLEDProfile(profileId);
        if (profile) {
          tableData.push({
            id: profile.id,
            fileName: profileId,
            name: profile.name || 'Untitled Profile',
            description: profile.description, // Include description in table data
            deviceIP: profile.deviceIP || '–',
            rulesCount: profile.rules?.length || 0
          });
        }
      }
      setProfileTableData(tableData);
      
      // Group profiles by device
      const devices = getWLEDDevices();
      //console.log("Grouping profiles by device. Available devices:", 
      //  devices.map(d => `${d.name} (${d.ipAddress})`));
        
      groupProfilesByDevice(tableData, devices);
    } catch (error) {
      //console.error("Failed to load profiles:", error);
      toast({
        title: "Error Loading Profiles",
        description: "Failed to load saved WLED profiles.",
        variant: "destructive",
      });
    }
  };
  
  // Group profiles by device IP
  const groupProfilesByDevice = (profiles: ProfileTableData[], devices: WLEDDevice[]) => {
    //console.log("Grouping profiles:", profiles);
    //console.log("Using devices:", devices);
    
    // Create a map of device IPs to profiles
    const deviceMap = new Map<string, ProfileTableData[]>();
    
    // First pass: organize profiles by device IP
    profiles.forEach(profile => {
      if (profile.deviceIP && profile.deviceIP !== '–') {
        if (!deviceMap.has(profile.deviceIP)) {
          deviceMap.set(profile.deviceIP, []);
        }
        deviceMap.get(profile.deviceIP)!.push(profile);
      } else {
        // Handle profiles without a device IP (put in "Unknown" group)
        if (!deviceMap.has('unknown')) {
          deviceMap.set('unknown', []);
        }
        deviceMap.get('unknown')!.push(profile);
      }
    });
    
    // Convert map to DeviceProfileGroup array with proper device names
    const groups: DeviceProfileGroup[] = [];
    deviceMap.forEach((profiles, deviceIP) => {
      // Find the device by IP to get its name
      const device = deviceIP === 'unknown' ? null : devices.find(d => d.ipAddress === deviceIP);
      
      // Use the device name if found, otherwise use a fallback name
      const deviceName = deviceIP === 'unknown' 
        ? 'Unknown Device' 
        : (device ? device.name : `Unknown Device`);
        
      //console.log(`Creating device group: ${deviceName} (${deviceIP}) with ${profiles.length} profiles`);
      
      groups.push({
        deviceIP,
        deviceName,
        profiles
      });
    });
    
    //console.log("Final device groups:", groups);
    setDeviceGroups(groups);
  };

  // Load a specific profile by filename - UPDATED to handle unsaved changes tracking
  const handleSelectProfile = async (fileName: string) => {
    try {
      setIsLoadingProfile(true);
      setIsLoading(true);
      
      // Clear unsaved changes before loading new profile
      clearOriginalState();
      
      const profile = await loadWLEDProfile(fileName);
      
      if (!profile) {
        toast({
          title: "Profile Error",
          description: `Could not load profile: ${fileName}`,
          variant: "destructive",
        });
        return;
      }
      
      // Convert the profile to include rules (if they don't exist yet)
      const profileWithRules: WLEDProfileWithRules = {
        ...profile,
        rules: profile.rules || [], // Handle case where rules might not exist
        description: profile.description || "", // Ensure description exists
      };
      
      // Convert legacy rules to new format with segments array
      if (profileWithRules.rules.length > 0) {
        profileWithRules.rules = profileWithRules.rules.map(rule => {
          if ('segmentId' in rule && !('segments' in rule)) {
            return {
              ...rule,
              segments: [rule.segmentId as number]
            } as unknown as WLEDRule;
          }
          return rule;
        });
      }
      
      setSelectedProfile(profileWithRules);
      
      // IMPORTANT: Extract all unique segments from the profile's rules
      const profileSegments = getProfileSegments(profileWithRules);
      //console.log("Profile segments extracted:", profileSegments);
      
      // Store segments for this specific device IP
      if (profileWithRules.deviceIP) {
        setProfileSegments(profileWithRules.deviceIP, profileSegments);
      }
      
      // Set form values with the loaded profile data
      form.reset({
        name: profileWithRules.name || "",
        deviceIP: profileWithRules.deviceIP || "",
        description: profileWithRules.description || ""
      });
      
      // Attempt to connect to the device if we have a device IP
      if (profileWithRules.deviceIP) {
        await connectToDevice(profileWithRules.deviceIP);
      }
      
      // Clear the creating new profile state when selecting an existing one
      setIsCreatingNewProfile(false);
      
      // Store original profile state for change detection after a small delay
      setTimeout(() => {
        setOriginalProfileState(profileWithRules);
        setIsLoadingProfile(false);
      }, 100);
      
    } catch (error) {
      toast({
        title: "Profile Error",
        description: `Failed to load profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
      setIsLoadingProfile(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new profile - UPDATED to clear unsaved changes tracking
  const handleNewProfile = () => {
    // Clear unsaved changes tracking for new profile
    clearOriginalState();
    
    // We'll create a temporary ID, but don't set name/description as they'll come from the form
    const newProfile: WLEDProfileWithRules = {
      id: uuid(),
      name: "", // No longer hardcoding the name
      description: "", // No longer hardcoding the description
      deviceIP: "",
      importedAt: new Date().toISOString(),
      rules: []
    };
    
    // Set the selected profile to the new profile
    setSelectedProfile(newProfile);
    
    // Set creating new profile state to true
    setIsCreatingNewProfile(true);
    
    // Set editing mode to true for the new profile form
    setIsEditing(true);
    
    // Reset any device connections to start fresh
    disconnectDevice();
    
    // Reset stored segments to default [0]
    setProfileSegments("", [0]);
    
    // Reset form with empty values instead of hardcoded defaults
    form.reset({
      name: "", // Start with an empty name field
      deviceIP: "",
      description: "" // Start with an empty description field
    });
  };

  // Handle editing a profile - UPDATED to set original state for change tracking
  const handleEditProfile = (profileId: string) => {
    // Toggle editing state if clicking the same profile
    if (editingProfileId === profileId) {
      setEditingProfileId(null);
      clearOriginalState();
    } else {
      // Find the profile we want to edit
      const profileToEdit = profileTableData.find(p => p.id === profileId);
      if (profileToEdit) {
        // Load the full profile
        handleSelectProfile(profileToEdit.fileName);
        setEditingProfileId(profileId);
        setIsEditing(true);
        // Clear the creating new profile state since we're editing an existing one
        setIsCreatingNewProfile(false);
        
        // Reset expanded rules state to ensure all rules start minimized
        setExpandedRules([]);
      }
    }
  };

  // UPDATED to handle device selection and segment display
  const handleDeviceSelect = (ipAddress: string) => {
    try {
      // Preserve current form values before device connection
      const currentName = form.getValues("name");
      const currentDescription = form.getValues("description");
      
      //console.log("Current form values before device selection:", {
      //  name: currentName,
      //  description: currentDescription,
      //  deviceIP: ipAddress
      //});
      
      // Update the device IP in the form
      form.setValue("deviceIP", ipAddress);
      
      // Connect to the device
      connectToDevice(ipAddress).then(() => {
        // After connection completes, restore the name and description values
        setTimeout(() => {
          //console.log("Restoring form values after device connection");
          form.setValue("name", currentName);
          form.setValue("description", currentDescription);
        }, 0);
      });
    } catch (error) {
      //console.error("Error connecting to WLED device:", error);
      toast({
        title: "Connection Error",
        description: `Failed to connect to WLED device: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    }
  };

  // Modified addRule function to preserve form values when adding new rules
  const addRule = useCallback(() => {
    if (!selectedProfile) {
      //console.log("Cannot add rule: No profile selected");
      return;
    }
    
    try {
      //console.log("Adding new rule to profile", selectedProfile.id);
      
      // First, capture the current form values - this is key to fixing the issue
      const currentName = form.getValues("name");
      const currentDescription = form.getValues("description");
      const currentDeviceIP = form.getValues("deviceIP");
      
      //console.log("Current form values before adding rule:", {
      //  name: currentName,
      //  description: currentDescription,
      //  deviceIP: currentDeviceIP
      //});
      
      // Use either availableSegments or a default segment when disconnected
      const segments = availableSegments.length > 0 
        ? [availableSegments[0]] 
        : [0]; // Default to segment 0 when disconnected
      
      // Show a warning toast if we're in offline mode
      if (!isConnected) {
        toast({
          title: "Offline Mode",
          description: "Creating rule in offline mode with limited features. Effects and segments will update when connected.",
        });
      }
      
      const newRule: WLEDRule = {
        id: uuid(),
        triggerType: 'exact',
        exactValue: 1,
        segments: segments,
        effect: 0,
        color: [255, 255, 255],
        brightness: 128,
        flash: false
      };
      
      // Update the profile WITHOUT triggering a complete profile reload
      setSelectedProfile(prevProfile => {
        if (!prevProfile) return null;
        
        // Create a new profile object with the updated form values AND the new rule
        const updatedProfile = {
          ...prevProfile,
          name: currentName || prevProfile.name,
          description: currentDescription || prevProfile.description,
          rules: [...prevProfile.rules, newRule]
        };
        
        // Log updated profile to help with debugging
        //console.log("Updated profile with new rule:", updatedProfile);
        //console.log("Current device connection:", { ipAddress, isConnected });
        
        return updatedProfile;
      });
      
      // Important: Add a small delay before re-syncing the form values
      // This ensures the form values are preserved after React finishes re-renders
      setTimeout(() => {
        //console.log("Re-syncing form values after adding rule");
        form.setValue("name", currentName);
        form.setValue("description", currentDescription);
        form.setValue("deviceIP", currentDeviceIP);
      }, 0);
      
    } catch (error) {
      //console.error("Error adding rule:", error);
      toast({
        title: "Error Adding Rule",
        description: `Failed to add rule: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  }, [selectedProfile, availableSegments, toast, ipAddress, form, isConnected]);

  // Delete a rule from the profile - modified to maintain device connection
  const deleteRule = useCallback((ruleId: string) => {
    if (!selectedProfile) return;
    
    setSelectedProfile(prevProfile => {
      if (!prevProfile) return null;
      
      // Create new profile with rule removed
      return {
        ...prevProfile,
        rules: prevProfile.rules.filter(rule => rule.id !== ruleId)
      };
    });
  }, [selectedProfile]);

  // Update a rule's property - modified to maintain device connection
  const updateRule = useCallback((ruleId: string, field: string, value: any) => {
    if (!selectedProfile) return;
    
    setSelectedProfile(prevProfile => {
      if (!prevProfile) return null;
      
      // Create new profile with updated rule
      return {
        ...prevProfile,
        rules: prevProfile.rules.map(rule => 
          rule.id === ruleId 
            ? { ...rule, [field]: value } 
            : rule
        )
      };
    });
  }, [selectedProfile]);

  // Toggle a segment in the segments array for a rule
  const toggleSegment = useCallback((ruleId: string, segmentId: number, checked: boolean) => {
    if (!selectedProfile) return;
    
    setSelectedProfile(prevProfile => {
      if (!prevProfile) return null;
      
      // Create new profile with updated segments for the rule
      return {
        ...prevProfile,
        rules: prevProfile.rules.map(rule => {
          if (rule.id === ruleId) {
            const segments = rule.segments || [];
            if (checked) {
              // Add segment if it's not already in the array
              if (!segments.includes(segmentId)) {
                return { ...rule, segments: [...segments, segmentId] };
              }
            } else {
              // Remove segment from array
              return { ...rule, segments: segments.filter(id => id !== segmentId) };
            }
          }
          return rule;
        })
      };
    });
  }, [selectedProfile]);

  // Delete the selected profile - UPDATED to clear unsaved changes
  const handleDeleteProfile = async (profileId: string) => {
    const profileToDelete = profileTableData.find(p => p.id === profileId);
    if (!profileToDelete) return;
    
    // Set the profile to delete and open the confirmation dialog
    setProfileToDelete(profileToDelete.fileName);
    setDeleteDialogOpen(true);
  };
  
  // Function to execute the actual deletion after confirmation - UPDATED to clear unsaved changes
  const executeProfileDeletion = async () => {
    if (!profileToDelete) return;
    
    try {
      setIsLoading(true);
      
      // Call the new delete function with the file name
      const result = await deleteWLEDProfile(profileToDelete);
      
      if (result.success) {
        // If the profile being deleted is currently selected, clear the selection
        const deletedId = profileTableData.find(p => p.fileName === profileToDelete)?.id;
        if (deletedId && editingProfileId === deletedId) {
          setEditingProfileId(null);
          setSelectedProfile(null);
          setIsEditing(false);
          clearOriginalState(); // Clear unsaved changes tracking
        }
        
        // Refresh the profiles list
        await loadProfiles();
      }
    } catch (error) {
      //console.error('Error deleting profile:', error);
      toast({
        title: "Delete Failed",
        description: `Could not delete profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      // Reset delete dialog state
      setProfileToDelete(null);
      setIsLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  // Save the current profile - UPDATED to clear unsaved changes after save
  const handleSaveProfile = async (data: z.infer<typeof profileFormSchema>) => {
    if (!selectedProfile) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Debug logging
      //console.log("Form data submitted:", data);
      //console.log("Original profile before update:", selectedProfile);
      
      // Create a completely updated profile object with form data
      const updatedProfile: WLEDProfileWithRules = {
        ...selectedProfile,
        name: data.name, // Always use form name value
        description: data.description || "", // Always use form description value
        deviceIP: data.deviceIP, // Always use form deviceIP value
      };
      
      // More detailed debug logging
      //console.log("Updated profile before save:", {
      //  id: updatedProfile.id,
      //  name: updatedProfile.name,
      //  description: updatedProfile.description,
      //  deviceIP: updatedProfile.deviceIP
      //});
      
      // Save the profile to disk
      await saveWLEDProfile(updatedProfile);
      
      // Update the selected profile state to keep UI in sync
      // This is critical to ensure the profile is displayed correctly after save
      setSelectedProfile(updatedProfile);
      
      // Clear unsaved changes after successful save
      clearOriginalState();
      
      toast({
        title: "Profile Saved",
        description: `Successfully saved profile: ${updatedProfile.name}`,
      });
      
      // Refresh the profile list to show updated data
      await loadProfiles();
      setIsEditing(false);
      setEditingProfileId(null);
      
      // Reset the creating new profile state
      setIsCreatingNewProfile(false);
      
    } catch (error) {
      //console.error("Failed to save profile:", error);
      toast({
        title: "Save Failed",
        description: `Could not save profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get device name for a given IP address
  const getDeviceNameByIP = (ip: string): string => {
    const device = wledDevices.find(d => d.ipAddress === ip);
    return device ? device.name : "Unknown Device";
  };

  // Get effect name by ID
  const getEffectName = (effectId: number): string => {
    // If we have live effects from the device, use those
    const effect = availableEffects.find(e => e.id === effectId);
    if (effect) return effect.name;
    
    // If not connected, check if we can find the effect in the default list
    const defaultEffects = getDefaultEffects();
    const defaultEffect = defaultEffects.find(e => e.id === effectId);
    if (defaultEffect) return defaultEffect.name;
    
    // Fallback for unknown effects
    return `Effect #${effectId}`;
  };

  // Cancel editing - UPDATED to clear unsaved changes
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingProfileId(null);
    clearOriginalState(); // Clear unsaved changes tracking
    
    // Also clean up selected profile if it was a new unsaved profile
    if (selectedProfile && !profileTableData.some(p => p.id === selectedProfile.id)) {
      setSelectedProfile(null);
    }
    // Reset the creating new profile state
    setIsCreatingNewProfile(false);
  };

  const renderDeviceSelect = (field: any) => (
    <FormItem>
      <FormLabel>WLED Device</FormLabel>
      <div className="flex gap-2">
        <FormControl className="flex-1">
          <Select 
            value={field.value} 
            onValueChange={(value) => handleDeviceSelect(value)}
            disabled={isFetchingEffects}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a WLED device" />
            </SelectTrigger>
            <SelectContent>
              {wledDevices.length === 0 ? (
                <SelectItem key="no-devices-select" value="no-devices" disabled>No WLED devices found</SelectItem>
              ) : (
                wledDevices.map((device) => (
                  <SelectItem key={`device-${device.id}`} value={device.ipAddress}>
                    {device.ipAddress} – {device.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </FormControl>
        {isFetchingEffects && (
          <Button variant="outline" size="icon" disabled>
            <Loader className="h-4 w-4 animate-spin" />
          </Button>
        )}
        {!isFetchingEffects && field.value && (
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => connectToDevice(field.value)}
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>
      <FormDescription className="flex items-center gap-1">
        {isConnected ? (
          <>
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span>Connected to {ipAddress}: {availableEffects.length} effects, {availableSegments.length} segments</span>
          </>
        ) : field.value ? (
          <>
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            <span>Not connected. Try refreshing.</span>
          </>
        ) : (
          "Select a WLED device from your device manager"
        )}
      </FormDescription>
      <FormMessage />
    </FormItem>
  );
  
  // Updated renderAddRuleButton to explicitly set type="button" and remove the disabled attribute
  const renderAddRuleButton = () => (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={addRule} 
      type="button"
    >
      <Plus className="h-4 w-4 mr-2" />
      Add Rule
    </Button>
  );
  
  // Toggle rule expansion state
  const toggleRuleExpansion = (ruleId: string) => {
    setExpandedRules(prev => 
      prev.includes(ruleId) 
        ? prev.filter(id => id !== ruleId) 
        : [...prev, ruleId]
    );
  };

  // Render the redesigned rule editor with improved spacing
  const renderRuleEditor = (profile: WLEDProfileWithRules) => {
    // Only render if we're editing this specific profile
    if (!profile || !editingProfileId || profile.id !== editingProfileId) return null;
    
    return (
      <div className="border-t pt-4 pb-3 px-4">
        <Form {...form}>
          <form id="profile-edit-form" onSubmit={form.handleSubmit(handleSaveProfile)}>
            {/* Compact Header with Actions */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold flex items-center">
                Editing: {profile.name}
              </h3>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={handleCancelEdit} type="button" size="sm">
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  form="profile-edit-form"
                  disabled={isLoading}
                  size="sm"
                >
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </div>
            </div>
            
            {/* Compact Profile Form with improved spacing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <div className="flex items-center">
                      <FormLabel className="min-w-24 mr-2 mb-0">Profile Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter profile name" {...field} className="h-8" />
                      </FormControl>
                    </div>
                    <FormMessage className="text-xs mt-0" />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="deviceIP"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <div className="flex items-center">
                      <FormLabel className="min-w-24 mr-2 mb-0">WLED Device</FormLabel>
                      <div className="flex gap-1 flex-1">
                        <FormControl className="flex-1">
                          <Select 
                            value={field.value} 
                            onValueChange={(value) => handleDeviceSelect(value)}
                            disabled={isFetchingEffects}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select a WLED device" />
                            </SelectTrigger>
                            <SelectContent>
                              {wledDevices.length === 0 ? (
                                <SelectItem key="no-devices-edit" value="no-devices" disabled>No WLED devices found</SelectItem>
                              ) : (
                                wledDevices.map((device) => (
                                  <SelectItem key={`edit-device-${device.id}`} value={device.ipAddress}>
                                    {device.ipAddress} – {device.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        {isFetchingEffects && (
                          <Button variant="outline" size="icon" disabled className="h-8 w-8">
                            <Loader className="h-3 w-3 animate-spin" />
                          </Button>
                        )}
                        {!isFetchingEffects && field.value && (
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={() => connectToDevice(field.value)}
                            type="button"
                            className="h-8 w-8"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <FormDescription className="flex items-center gap-1 text-xs mt-0">
                      {isConnected ? (
                        <>
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span>Connected: {availableEffects.length} effects, {availableSegments.length} segments</span>
                        </>
                      ) : field.value ? (
                        <>
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                          <span>Not connected. Try refreshing.</span>
                        </>
                      ) : (
                        "Select a WLED device"
                      )}
                    </FormDescription>
                    <FormMessage className="text-xs mt-0" />
                  </FormItem>
                )}
              />
            </div>

            {/* Add description field */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel>Profile Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter notes or description for this profile (optional)" 
                      className="min-h-[60px]" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Rules Section with the shared component */}
            <div className="mt-2">
              <WLEDRuleEditor
                rules={profile.rules}
                availableEffects={availableEffects}
                availableSegments={availableSegments}
                isConnected={isConnected && !!form.getValues("deviceIP")}
                expandedRules={expandedRules}
                onAddRule={addRule}
                onDeleteRule={deleteRule}
                onUpdateRule={updateRule}
                onToggleSegment={toggleSegment}
                onToggleExpansion={toggleRuleExpansion}
              />
            </div>
          </form>
        </Form>
      </div>
    );
  };

  // Render a new profile editor with Import Settings button
  const renderNewProfileEditor = () => {
    // Only render if we're creating a new profile and we have a selected profile
    if (!isCreatingNewProfile || !selectedProfile) return null;
    
    return (
      <div className="mt-8 border p-6 rounded-lg">
        <Form {...form}>
          <form id="new-profile-form" onSubmit={form.handleSubmit(handleSaveProfile)}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Create New Profile</h2>
              <Button 
                onClick={handleOpenImportDialog} 
                type="button"
                variant="outline"
              >
                Import Settings from Device
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profile Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter profile name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="deviceIP"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WLED Device</FormLabel>
                    <div className="flex gap-2">
                      <FormControl className="flex-1">
                        <Select 
                          value={field.value} 
                          onValueChange={(value) => handleDeviceSelect(value)}
                          disabled={isFetchingEffects}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a WLED device" />
                          </SelectTrigger>
                          <SelectContent>
                            {wledDevices.length === 0 ? (
                              <SelectItem key="no-devices-select" value="no-devices" disabled>No WLED devices found</SelectItem>
                            ) : (
                              wledDevices.map((device) => (
                                <SelectItem key={`device-${device.id}`} value={device.ipAddress}>
                                  {device.ipAddress} – {device.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      {isFetchingEffects && (
                        <Button variant="outline" size="icon" disabled>
                          <Loader className="h-4 w-4 animate-spin" />
                        </Button>
                      )}
                      {!isFetchingEffects && field.value && (
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={() => connectToDevice(field.value)}
                          type="button"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <FormDescription className="flex items-center gap-1">
                      {isConnected ? (
                        <>
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span>Connected to {ipAddress}: {availableEffects.length} effects, {availableSegments.length} segments</span>
                        </>
                      ) : field.value ? (
                        <>
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                          <span>Not connected. Try refreshing.</span>
                        </>
                      ) : (
                        "Select a WLED device from your device manager"
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Add description field to new profile form */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel>Profile Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter notes or description for this profile (optional)" 
                      className="min-h-[80px]" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="border-t pt-4 mt-4">
              {/* Use the shared WLEDRuleEditor component */}
              <WLEDRuleEditor
                rules={selectedProfile.rules}
                availableEffects={availableEffects}
                availableSegments={availableSegments}
                isConnected={isConnected && !!form.getValues("deviceIP")}
                expandedRules={expandedRules}
                onAddRule={addRule}
                onDeleteRule={deleteRule}
                onUpdateRule={updateRule}
                onToggleSegment={toggleSegment}
                onToggleExpansion={toggleRuleExpansion}
              />
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={handleCancelEdit} type="button">
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Profile
              </Button>
            </div>
          </form>
        </Form>
      </div>
    );
  };

  // Update the profile row rendering to show description as a secondary line if available
  const renderProfileRow = (profile: ProfileTableData) => (
    <TableRow key={`profile-${profile.id}`}>
      <TableCell className="font-medium">
        <div>
          {profile.name}
          {profile.description && (
            <p className="text-xs text-muted-foreground truncate max-w-[500px]">
              {profile.description}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell>{profile.rulesCount} rules</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleTestProfile(profile)}
            disabled={testingProfiles[profile.id]}
            className="h-8"
          >
            {testingProfiles[profile.id] ? (
              <Loader className="h-3 w-3 mr-1 animate-spin" />
            ) : null}
            Test Profile
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => handleEditProfile(profile.id)}
            type="button"
            className="h-8 w-8"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => handleDeleteProfile(profile.id)}
            type="button"
            className="h-8 w-8 text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  // Add the missing function to handle opening the import dialog
  const handleOpenImportDialog = () => {
    setIsImportDialogOpen(true);
  };
  
  // Update the handleProfileImported function to properly import and save the profile
  const handleProfileImported = async (ipAddress: string) => {
    try {
      setIsLoading(true);
      
      // Import the profile from the WLED device at the specified IP address
      const result = await importAndSaveWLEDProfile(ipAddress);
      
      if (result && result.fileName) {
        // If import was successful and we have a fileName, select that profile
        await loadProfiles();
        
        // Find and select the newly imported profile
        const importedProfileData = profileTableData.find(p => p.fileName === result.fileName);
        if (importedProfileData) {
          await handleSelectProfile(result.fileName);
          setEditingProfileId(importedProfileData.id);
          setIsEditing(true);
        }
      } else {
        // Just refresh the profiles list if we don't have a specific profile to select
        await loadProfiles();
      }
      
      // Reset the creating new profile state if we were in that mode
      setIsCreatingNewProfile(false);
      
      // Show success toast
      toast({
        title: "Profile Imported",
        description: "WLED profile has been imported successfully",
      });
    } catch (error) {
      //console.error("Failed to import profile:", error);
      toast({
        title: "Import Failed",
        description: `Could not import profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Render the device group headers with correct names
  const renderDeviceGroupHeader = (group: DeviceProfileGroup) => {
    if (group.deviceIP === 'unknown') {
      return <h3 className="text-lg font-semibold mb-2">Unknown Device</h3>;
    }
    
    return (
      <h3 className="text-lg font-semibold mb-2 flex items-center">
        <span>{group.deviceName}</span>
        <span className="text-sm font-normal text-muted-foreground ml-2">
          ({group.deviceIP})
        </span>
      </h3>
    );
  };

  // Add the handleTestProfile function
  const handleTestProfile = async (profile: ProfileTableData) => {
    if (testingProfiles[profile.id]) {
      // Prevent multiple simultaneous test requests to the same profile
      return;
    }

    try {
      // Set the loading state for this specific profile
      setTestingProfiles(prev => ({
        ...prev,
        [profile.id]: true
      }));

      // Load the full profile data since the table data doesn't have the complete profile
      const fullProfile = await loadWLEDProfile(profile.fileName);
      
      if (!fullProfile || !fullProfile.deviceIP) {
        throw new Error("Profile has no device IP address");
      }

      // Send the profile to the device
      await window.electron.sendWLEDProfileToDevice(fullProfile);
      
      toast({
        title: "Profile Test Successful",
        description: `Profile settings sent to ${fullProfile.deviceIP}`,
      });
    } catch (error) {
      //console.error("Failed to test profile:", error);
      toast({
        title: "Test Failed",
        description: `Could not send profile to device: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      // Clear the loading state
      setTestingProfiles(prev => ({
        ...prev,
        [profile.id]: false
      }));
    }
  };

  return (
    <div className="container mx-auto py-2">
      <UnsavedChangesWarning />
      
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-6 w-6" />
            <h1 className="text-2xl font-bold">WLED Profiles</h1>
          </div>
          <div className="flex gap-2 items-center">
            <WLEDProfilesHelpDialog 
              trigger={
                <Button variant="ghost" className="p-1 w-auto h-auto min-h-0 icon-large-override">
                  <HelpCircle className="h-5 w-5 text-blue-600" />
                  <span className="sr-only">WLED Profiles Help</span>
                </Button>
              }
            />
            {!isCreatingNewProfile && (
              <>
                <Button onClick={handleNewProfile} type="button">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Profile
                </Button>
                <Button onClick={handleOpenImportDialog} type="button" variant="outline">
                  Import Settings from Device
                </Button>
              </>
            )}
          </div>
        </div>
        
        <p className="text-muted-foreground mt-1 mb-0">
          Create and manage WLED lighting profiles with custom rules that respond to game events and data values. 
          Import settings directly from your devices or build profiles from scratch.
        </p>
      </div>
      
      {/* Show empty state when no profiles exist and we're not creating */}
      {profileList.length === 0 && !isCreatingNewProfile && (
        <div className="text-center p-12 border rounded-md">
          <p className="text-muted-foreground mb-4">You haven't created any WLED profiles yet</p>
          <div className="flex flex-col sm:flex-row justify-center gap-2">
            <Button onClick={handleNewProfile} type="button">
              <Plus className="h-4 w-4 mr-2" />
              Create Profile
            </Button>
            <Button onClick={handleOpenImportDialog} type="button" variant="outline">
              Import Settings from Device
            </Button>
          </div>
        </div>
      )}
      
      {/* Profile Table - Only show when there are profiles or we're not in creating mode */}
      {profileList.length > 0 && !isCreatingNewProfile && (
        <div>
          {/* Device-grouped profile list */}
          <div className="space-y-6">
            {deviceGroups.map((group) => (
              <div key={`device-group-${group.deviceIP}`}>
                {renderDeviceGroupHeader(group)}
                <Card>
                  <TableCompact>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[500px]">Name</TableHead>
                        <TableHead>Rules</TableHead>
                        <TableHead className="w-[100px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.profiles.map((profile) => (
                        <React.Fragment key={`profile-fragment-${profile.id}`}>
                          {/* Use the updated profile row renderer */}
                          {renderProfileRow(profile)}
                          
                          {/* In-line profile editor - Enhanced with proper spacing */}
                          {editingProfileId === profile.id && selectedProfile && selectedProfile.id === profile.id && (
                            <TableRow key={`profile-edit-${profile.id}`} className="bg-muted/20 hover:bg-muted/20">
                              <TableCell colSpan={3} className="p-0">
                                {renderRuleEditor(selectedProfile)}
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </TableCompact>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* New Profile Editor - For creating new profiles */}
      {isCreatingNewProfile && renderNewProfileEditor()}
      
      {/* Import Settings Dialog */}
      <ImportSettingsDialog 
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImport={handleProfileImported} // Replace onProfileImported with onImport which is the expected prop name
      />
      
      {/* Add Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={executeProfileDeletion}
        itemName={profileToDelete ? profileToDelete : "this profile"}
      />
    </div>
  );
};

const WLEDProfiles: React.FC = () => {
  return (
    <UnsavedChangesProvider>
      <WLEDProfilesContent />
    </UnsavedChangesProvider>
  );
};

export default WLEDProfiles;
