import React, { useEffect, useState } from "react";
import { 
  TableCompact,
  TableCompactHeader,
  TableCompactBody,
  TableCompactRow,
  TableCompactHead,
  TableCompactCell
} from "@/components/ui/table-compact";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save } from "lucide-react";
import { useGameManager } from "../context/GameManagerContext";
import { MappingTableRow } from "./MappingTableRow";
import { toast } from "sonner";

// Type guard to check if output is MemoryProfileOutput
const isMemoryOutput = (output: any): output is import("@/types/memoryProfiles").MemoryProfileOutput => {
  return 'address' in output && 'type' in output;
};

export const GameProfileMappingTable: React.FC = () => {
  const { 
    selectedGameProfile, 
    selectedMemoryProfile, 
    mappings, 
    isLoading,
    devices,
    wledProfileObjects,
    updateMapping: contextUpdateMapping,
    handleSaveSettings 
  } = useGameManager();
  
  // Add state for test values
  const [testValues, setTestValues] = useState<Record<number, string>>({});
  const [testLoading, setTestLoading] = useState<Record<number, boolean>>({});

  // Adapter function to ensure compatible interface with MappingTableRow
  const updateMapping = (index: number, field: string, value: any) => {
    // Determine if we need to handle a special case for deviceType
    if (field === "deviceType") {
      // First update deviceType
      contextUpdateMapping(index, "deviceType" as keyof typeof mappings[0], value);
      
      // Then reset dependent fields
      contextUpdateMapping(index, "targetDevice" as keyof typeof mappings[0], "");
      contextUpdateMapping(index, "outputChannel" as keyof typeof mappings[0], "");
    } else {
      // For other fields, pass directly to context update function
      contextUpdateMapping(index, field as keyof typeof mappings[0], value);
    }
  };

  // Use effect to update the window function whenever mappings change
  useEffect(() => {
    // Create or update the function that allows other components to get current mappings
    (window as any).getCurrentMappings = () => {
      return mappings;
    };

    return () => {
      // Clean up function when component unmounts
      delete (window as any).getCurrentMappings;
    };
  }, [mappings]);

  // Handle Save Settings with improved error handling and refresh
  const handleSaveButtonClick = async () => {
    if (!selectedGameProfile) {
      toast.error("No game profile selected");
      return;
    }
    
    try {      
      // Update form component with current mappings
      const formUpdateMappingsFunc = (window as any).updateMappingsFromForm;
      if (typeof formUpdateMappingsFunc === 'function') {
        formUpdateMappingsFunc(mappings);
        
        // Small delay to ensure state is updated
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Call handleSaveSettings from context
      const success = await handleSaveSettings();
      
      if (success) {
        // Add a small delay to ensure the context has updated the mappings
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Trigger a re-render by updating a local state or forcing refresh
        // The mappings will automatically refresh through the context
        const event = new CustomEvent('mappingsRefreshed');
        window.dispatchEvent(event);
      }
    } catch (error) {
      //console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    }
  };
  
  // Handle test value input change with enhanced PacDrive validation
  const handleTestValueChange = (index: number, value: string) => {
    // Apply PacDrive validation directly here as well
    const mapping = mappings[index];
    if (mapping && mapping.deviceType === "PacDrive") {
      // Only allow "0" and "1" for PacDrive
      if (value === "" || value === "0" || value === "1") {
        setTestValues(prev => ({
          ...prev,
          [index]: value
        }));
      }
      // No else branch - silently ignore invalid inputs
    } else {
      // For non-PacDrive, allow anything
      setTestValues(prev => ({
        ...prev,
        [index]: value
      }));
    }
  };
  
  // Handle test dispatch button click with enhanced debugging
  const handleTestDispatch = async (index: number) => {
    try {
      const mapping = mappings[index];
      const testValue = testValues[index];
      
      if (!mapping || !testValue) {
        toast.error("Missing mapping data or test value");
        return;
      }
      
      // Set loading state for this row first
      setTestLoading(prev => ({
        ...prev,
        [index]: true
      }));
      
      // Convert test value to appropriate type based on output type
      let convertedValue: any = testValue;
      
      // For PacDrive devices, ensure we get EXACT string "0" or "1"
      if (mapping.deviceType === "PacDrive") {
        // Only allow exact "0" or "1" string values
        if (testValue !== "0" && testValue !== "1") {
          toast.error("PacDrive values must be 0 or 1");
          setTestLoading(prev => ({ ...prev, [index]: false }));
          return;
        }
      }
      else if (isMemoryOutput(mapping.output) && (mapping.output.type === "Float" || mapping.output.type === "Double")) {
        convertedValue = parseFloat(testValue);
      } else if (isMemoryOutput(mapping.output) && (mapping.output.type === "Int" || mapping.output.type === "Int32" || mapping.output.type === "Byte")) {
        convertedValue = parseInt(testValue, 10);
      } else if (isMemoryOutput(mapping.output) && mapping.output.type === "Boolean") {
        convertedValue = testValue.toLowerCase() === "true" || testValue === "1" ? 1 : 0;
      }
      
      if (isMemoryOutput(mapping.output) && isNaN(convertedValue) && typeof convertedValue === "number") {
        toast.error("Invalid numeric value");
        setTestLoading(prev => ({ ...prev, [index]: false }));
        return;
      }
      
      // Construct test output object
      const testOutput = {
        label: mapping.output.label,
        device: mapping.deviceType,
        targetDevice: mapping.targetDevice,
        channel: mapping.outputChannel,
        wledProfileId: mapping.deviceType === "WLED" ? mapping.outputChannel : undefined,
        value: convertedValue,
        isActive: mapping.active
      };
      
      try {
        const result = await window.electron.testOutputDispatch?.(testOutput);
        
        if (result?.success) {
          toast.success(`Test succeeded for ${mapping.output.label}`);
        } else {
          toast.error(`Test failed: ${result?.error || "Unknown error"}`);
        }
      } catch (dispatchError) {
        toast.error(`Test dispatch exception: ${dispatchError instanceof Error ? dispatchError.message : "Unknown error"}`);
      }
    } catch (error) {
      toast.error(`Test failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      // Clear loading state
      setTestLoading(prev => ({
        ...prev,
        [index]: false
      }));
    }
  };
  
  if (!selectedMemoryProfile && !selectedGameProfile) {
    return (
      <Card className="mt-8">
        <CardContent className="pt-6">
          <div className="text-center text-gray-500 py-8">
            Select a memory profile or game profile to view mapping options.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Output Mapping Table</CardTitle>
        <Button 
          onClick={handleSaveButtonClick}
          disabled={isLoading || !selectedGameProfile}
          size="sm"
        >
          <Save className="mr-2 h-4 w-4" />
          Save Settings
        </Button>
      </CardHeader>
      <CardContent>
        <TableCompact>
          <TableCompactHeader>
            <TableCompactRow>
              <TableCompactHead>Memory Output</TableCompactHead>
              <TableCompactHead>Address</TableCompactHead>
              <TableCompactHead>Device Type</TableCompactHead>
              <TableCompactHead>Target Device</TableCompactHead>
              <TableCompactHead>Channel/Profile</TableCompactHead>
              <TableCompactHead>Active</TableCompactHead>
              <TableCompactHead>Test Value</TableCompactHead>
              <TableCompactHead>Test</TableCompactHead>
            </TableCompactRow>
          </TableCompactHeader>
          <TableCompactBody>
            {mappings.map((mapping, index) => (
              <MappingTableRow 
                key={`mapping-${index}`} 
                mapping={mapping} 
                index={index} 
                devices={devices}
                wledProfileObjects={wledProfileObjects}
                updateMapping={updateMapping}
                testValue={testValues[index] || ""}
                onTestValueChange={(value) => handleTestValueChange(index, value)}
                onTestDispatch={() => handleTestDispatch(index)}
                isTestLoading={testLoading[index] || false}
              />
            ))}
            {mappings.length === 0 && (
              <TableCompactRow>
                <TableCompactCell colSpan={8} className="text-center py-8">
                  No outputs found in the selected memory profile.
                </TableCompactCell>
              </TableCompactRow>
            )}
          </TableCompactBody>
        </TableCompact>

        {/* Hidden button for parent components to fetch mappings */}
        <div className="hidden">
          <Button id="getMappingsButton" onClick={() => {
            // Update form component with current mappings
            const formUpdateMappingsFunc = (window as any).updateMappingsFromForm;
            if (typeof formUpdateMappingsFunc === 'function') {
              formUpdateMappingsFunc(mappings);
            } else {
              //console.error("updateMappingsFromForm function not found on window object");
              toast.error("Failed to synchronize mappings with form");
            }
          }}>
            Get Mappings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
