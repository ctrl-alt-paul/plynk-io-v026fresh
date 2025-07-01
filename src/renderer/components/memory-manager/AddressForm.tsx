import React, { useState, useCallback } from 'react';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { OffsetChip } from "@/components/ui/table-styles";
import { ModuleNameInput } from "@/renderer/components/ModuleNameInput";
import { ModuleOffsetHelpDialog } from "@/renderer/components/ModuleOffsetHelpDialog";
import { PointerHelpDialog } from "@/renderer/components/PointerHelpDialog";
import { FormatStringHelpDialog } from "@/renderer/components/FormatStringHelpDialog";
import { TransformScriptHelpDialog } from "@/renderer/components/TransformScriptHelpDialog";
import { InvertHelpDialog } from "@/renderer/components/InvertHelpDialog";
import { BitmaskHelpDialog } from "@/renderer/components/BitmaskHelpDialog";
import { toast } from "sonner";
import { validations } from "@/utils/validations";
import { NewMemoryAddress, memoryTypes } from "@/types/memoryAddress";
import { getPointerChainSummary } from "@/renderer/utils/addressFormatters";
import { parseOffset } from "@/renderer/utils/memoryUtils";
interface AddressFormProps {
  newAddress: NewMemoryAddress;
  updateNewAddressField: (field: string, value: string | boolean | number) => void;
  usePointerChain: boolean;
  setUsePointerChain: (value: boolean) => void;
  offsets: string[];
  addOffset: () => void;
  removeOffset: (index: number) => void;
  clearOffsets: () => void;
  currentOffset: string;
  setCurrentOffset: (value: string) => void;
  addMemoryAddress: () => void;
  selectedProcess: string | null;
  toggleUseModuleOffset: (checked: boolean) => void;
}
const AddressForm: React.FC<AddressFormProps> = ({
  newAddress,
  updateNewAddressField,
  usePointerChain,
  setUsePointerChain,
  offsets,
  addOffset,
  removeOffset,
  clearOffsets,
  currentOffset,
  setCurrentOffset,
  addMemoryAddress,
  selectedProcess,
  toggleUseModuleOffset
}) => {
  const [isAdvancedOptionsOpen, setIsAdvancedOptionsOpen] = useState(false);
  const isAddressFormValid = useCallback((): boolean => {
    if (newAddress.useModuleOffset) {
      const hasValidOffset = parseOffset(newAddress.offset, newAddress.offsetFormat) !== null;
      // Must provide explicit module name for module-relative addresses
      return (newAddress.moduleName?.trim() || "") !== "" && hasValidOffset;
    }
    return (newAddress.address?.trim() || "") !== "";
  }, [newAddress]);
  const getPointerChainSummaryWithContext = useCallback((baseAddress: string): React.ReactNode | null => {
    return getPointerChainSummary(usePointerChain, offsets, baseAddress);
  }, [usePointerChain, offsets]);
  return <Card>
      <CardHeader>
        <CardTitle className="text-xl">New Memory Address</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-x-6">
            <div className="w-auto flex items-center space-x-2">
              <Label htmlFor="use-module-offset" className="flex items-center space-x-2 cursor-pointer">
                <Switch id="use-module-offset" checked={newAddress.useModuleOffset} onCheckedChange={toggleUseModuleOffset} />
                <span>Use Module + Offset</span>
              </Label>
              <ModuleOffsetHelpDialog />
            </div>
            
            <div className="w-auto flex items-center space-x-2">
              <Label htmlFor="pointer-chain" className="flex items-center space-x-2 cursor-pointer">
                <Switch id="pointer-chain" checked={usePointerChain} onCheckedChange={setUsePointerChain} />
                <span>Use Pointer Chain</span>
              </Label>
              <PointerHelpDialog />
            </div>
          </div>
          
          {!newAddress.useModuleOffset ? <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-3">
                <Label htmlFor="address-label">Label</Label>
                <Input id="address-label" value={newAddress.label} onChange={e => updateNewAddressField("label", e.target.value)} />
              </div>
              <div className="md:col-span-5">
                <Label htmlFor="memory-address">Memory Address</Label>
                <Input id="memory-address" value={newAddress.address} onChange={e => updateNewAddressField("address", e.target.value)} placeholder="0x12345678" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="memory-type">Type</Label>
                <Select value={newAddress.type} onValueChange={value => updateNewAddressField("type", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {memoryTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {newAddress.type === "CustomSize" && <div className="md:col-span-2">
                  <Label htmlFor="custom-size">Size (bytes)</Label>
                  <Input id="custom-size" type="number" min="1" max="8" value={newAddress.customSize || 1} onChange={e => updateNewAddressField("customSize", parseInt(e.target.value, 10) || 1)} placeholder="1-8 bytes" />
                </div>}
            </div> : <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-3">
                <Label htmlFor="module-label">Label</Label>
                <Input id="module-label" value={newAddress.label} onChange={e => updateNewAddressField("label", e.target.value)} />
              </div>
              <div className="md:col-span-3">
                <Label htmlFor="module-name">Module Name</Label>
                <ModuleNameInput id="module-name" value={newAddress.moduleName} onChange={value => updateNewAddressField("moduleName", value)} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="offset">Offset</Label>
                <Input id="offset" value={newAddress.offset} onChange={e => updateNewAddressField("offset", e.target.value)} placeholder="0x00000000" />
              </div>
              <div className="md:col-span-1">
                <Label htmlFor="offset-format">Format</Label>
                <Select value={newAddress.offsetFormat} onValueChange={value => updateNewAddressField("offsetFormat", value as "hex" | "decimal")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem key="hex" value="hex">Hex</SelectItem>
                    <SelectItem key="decimal" value="decimal">Dec</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="memory-type">Type</Label>
                <Select value={newAddress.type} onValueChange={value => updateNewAddressField("type", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {memoryTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {newAddress.type === "CustomSize" && <div className="md:col-span-2">
                  <Label htmlFor="custom-size">Size (bytes)</Label>
                  <Input id="custom-size" type="number" min="1" max="8" value={newAddress.customSize || 1} onChange={e => updateNewAddressField("customSize", parseInt(e.target.value, 10) || 1)} placeholder="1-8 bytes" />
                </div>}
            </div>}
          
          {/* Process information hint */}
          {newAddress.useModuleOffset && <div className="text-sm text-muted-foreground p-2 bg-muted/30 rounded-md">
              <strong>Note:</strong> Memory will be read from process: <span className="font-mono">{selectedProcess || "[No process selected]"}</span>
            </div>}
          
          {/* Pointer chain offset configuration */}
          {usePointerChain && <div className="bg-muted/50 p-4 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">Pointer Chain Offsets</h4>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={clearOffsets} disabled={offsets.length === 0}>
                    Clear All
                  </Button>
                </div>
              </div>
              
              <div className="flex items-end gap-2 mb-2">
                <div className="max-w-[200px]">
                  <Label htmlFor="new-offset">New Offset (hex)</Label>
                  <Input id="new-offset" value={currentOffset} onChange={e => setCurrentOffset(e.target.value)} placeholder="0x00000000" className="font-mono" />
                </div>
                <Button onClick={addOffset} className="h-[38px]" disabled={!currentOffset}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add
                </Button>
              </div>
              
              {offsets.length > 0 ? <div className="flex flex-wrap gap-2 mt-2">
                  {offsets.map((offset, i) => <OffsetChip key={`${offset}-${i}`} offset={offset} index={i} onRemove={() => removeOffset(i)} />)}
                </div> : <div className="text-sm text-muted-foreground mt-2">
                  No offsets added yet. Add at least one offset to create a pointer chain.
                </div>}
              
              {getPointerChainSummaryWithContext(newAddress.useModuleOffset ? `${newAddress.moduleName}+${newAddress.offset}` : newAddress.address)}
            </div>}
          
          {/* Advanced options */}
          <Collapsible open={isAdvancedOptionsOpen} onOpenChange={setIsAdvancedOptionsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="flex w-full justify-start items-center p-0 h-auto">
                <span className="text-sm font-medium">Advanced Options</span>
                <span className="ml-2">
                  {isAdvancedOptionsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="mt-2">
              <div className="space-y-4">
                {/* First Row: Bitmask / Bitwise Operation / Use Bitfield */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Label htmlFor="bitmask">
                        Bitmask
                      </Label>
                      <BitmaskHelpDialog />
                    </div>
                    <Input id="bitmask" value={newAddress.bitmask} onChange={e => updateNewAddressField("bitmask", e.target.value)} placeholder="0xFF" />
                  </div>
                  
                  <div>
                    <Label htmlFor="bitwise-op">Bitwise Operation</Label>
                    <Select value={newAddress.bitwiseOp === "" ? "none" : newAddress.bitwiseOp} onValueChange={value => updateNewAddressField("bitwiseOp", value === "none" ? "" : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem key="none" value="none">None</SelectItem>
                        <SelectItem key="AND" value="AND">AND</SelectItem>
                        <SelectItem key="OR" value="OR">OR</SelectItem>
                        <SelectItem key="XOR" value="XOR">XOR</SelectItem>
                        <SelectItem key="NOT" value="NOT">NOT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="mb-2">Use Bitfield</Label>
                    <div className="flex items-center h-10">
                      <Switch checked={newAddress.bitfield} onCheckedChange={checked => updateNewAddressField("bitfield", checked)} />
                      <span className="ml-2 text-sm">{newAddress.bitfield ? "Yes" : "No"}</span>
                    </div>
                  </div>
                </div>
                
                {/* Second Row: Format String / Transform Script / Invert Value */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="format-string" className="flex items-center gap-2 mb-2">
                      Format String
                      <FormatStringHelpDialog />
                    </Label>
                    <Input id="format-string" value={newAddress.format} onChange={e => updateNewAddressField("format", e.target.value)} placeholder="{value} or format pattern (0.00)" />
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="script" className="mb-2 flex items-center gap-2">
                        Transform Script
                        <TransformScriptHelpDialog />
                      </Label>
                    </div>
                    <Input id="script" value={newAddress.script} onChange={e => updateNewAddressField("script", e.target.value)} placeholder="value * 100" />
                  </div>
                  
                  <div>
                    <Label className="flex items-center gap-2 mb-2">
                      Invert Value
                      <InvertHelpDialog />
                    </Label>
                    <div className="flex items-center h-10">
                      <Switch checked={newAddress.invert} onCheckedChange={checked => updateNewAddressField("invert", checked)} />
                      <span className="ml-2 text-sm">{newAddress.invert ? "Yes" : "No"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={addMemoryAddress} className="w-auto" disabled={!isAddressFormValid()}>
          <Plus className="mr-1 h-4 w-4" />
          Add Memory Address
        </Button>
      </CardFooter>
    </Card>;
};
export default AddressForm;