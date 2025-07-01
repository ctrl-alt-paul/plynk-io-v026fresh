
import React, { useState, useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableCompact } from "@/components/ui/table-compact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { OffsetChip } from "@/components/ui/table-styles";
import { MemoryAddress } from "@/types/memoryAddress";
import { renderValueOrError } from "@/renderer/utils/addressFormatters";
import { DraggableTableRow, DragHandle } from './DraggableTableRow';

interface MemoryAddressTableProps {
  memoryAddresses: MemoryAddress[];
  removeMemoryAddress: (id: string) => void;
  updateMemoryAddressField: (id: string, field: string, value: any) => void;
  addOffset: (addressId: string) => void;
  removeOffset: (addressId: string, offsetIndex: number) => void;
  newOffset: string;
  setNewOffset: (value: string) => void;
  moveMemoryAddress?: (dragIndex: number, hoverIndex: number) => void;
}

export const MemoryAddressTable: React.FC<MemoryAddressTableProps> = ({
  memoryAddresses,
  removeMemoryAddress,
  updateMemoryAddressField,
  addOffset,
  removeOffset,
  newOffset,
  setNewOffset,
  moveMemoryAddress
}) => {
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number | null>(null);

  const getFormattedAddressWithContext = useCallback((addr: MemoryAddress): string => {
    if (addr.useModuleOffset) {
      return `${addr.moduleName}+${addr.offset}`;
    }
    return addr.address || "—";
  }, []);

  const togglePointerChainRow = useCallback((index: number | null) => {
    setSelectedAddressIndex(prevIndex => prevIndex === index ? null : index);
  }, []);

  if (memoryAddresses.length === 0) {
    return (
      <div className="text-center p-8 border border-dashed rounded-lg">
        <div className="text-muted-foreground">No memory addresses added yet.</div>
        <div className="text-sm mt-2">Add a memory address above to get started.</div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="rounded-md border bg-card">
        <TableCompact>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]"></TableHead>
              <TableHead className="w-[80px]">Type</TableHead>
              <TableHead className="w-[240px]">Label</TableHead>
              <TableHead className="w-[360px]">Address</TableHead>
              <TableHead className="w-[160px]">Raw Value</TableHead>
              <TableHead className="w-[160px]">Final Value</TableHead>
              <TableHead className="w-[100px]">Last Read</TableHead>
              <TableHead className="w-[60px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {memoryAddresses.map((addr, index) => (
              <React.Fragment key={`fragment-${addr.id}-${index}`}>
                <DraggableTableRow 
                  key={`main-row-${addr.id}-${index}`}
                  id={addr.id}
                  index={index}
                  moveRow={moveMemoryAddress || (() => {})}
                >
                  <TableCell className="w-[30px] pr-0">
                    <DragHandle />
                  </TableCell>
                  <TableCell className="font-mono text-xs align-middle">
                    {addr.type}{addr.type === "CustomSize" && addr.customSize ? `(${addr.customSize})` : ""}
                  </TableCell>
                  <TableCell className="align-middle">
                    {addr.label || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs align-middle">
                    <div className="flex items-center">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 p-0"
                          onClick={() => togglePointerChainRow(index)}
                        >
                          {selectedAddressIndex === index ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </Button>
                        <span className="overflow-x-auto block max-w-[360px]" title={getFormattedAddressWithContext(addr)}>
                          {getFormattedAddressWithContext(addr)}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs align-middle">
                    {renderValueOrError(addr, 'raw')}
                  </TableCell>
                  <TableCell className="font-mono text-xs align-middle">
                    {renderValueOrError(addr, 'final')}
                  </TableCell>
                  <TableCell className="text-xs align-middle">
                    {addr.lastRead ? format(addr.lastRead, "HH:mm:ss.SSS") : "—"}
                  </TableCell>
                  <TableCell className="align-middle">
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => removeMemoryAddress(addr.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                </DraggableTableRow>
                
                {selectedAddressIndex === index && (
                  <TableRow key={`details-row-${addr.id}-${index}`}>
                    <TableCell colSpan={8} className="p-0">
                      <div className="bg-muted/20 p-3 border-t">
                        
                        {/* Module Name and Offset Field */}
                        <div className="flex flex-wrap gap-4 mb-4 items-end">
                          <div className="w-full md:w-[240px]">
                            <Label className="text-sm">Module Name</Label>
                            <Input
                              value={addr.moduleName || ""}
                              onChange={(e) => updateMemoryAddressField(addr.id, "moduleName", e.target.value)}
                              placeholder="e.g. game.exe"
                            />
                          </div>
                          
                          <div className="w-full md:w-[240px]">
                            <Label className="text-sm">Offset (hex)</Label>
                            <Input
                              value={addr.offset || ""}
                              onChange={(e) => updateMemoryAddressField(addr.id, "offset", e.target.value)}
                              placeholder="e.g. 0x434C18"
                              className="font-mono text-sm"
                            />
                          </div>
                        </div>
                
                        <div className="mb-4">
                          <h4 className="text-sm font-medium mb-2">Pointer Chain</h4>

                          {/* Offset chips */}
                          {(addr.offsets || []).map((offset, i) => (
                            <OffsetChip
                              key={`${addr.id}-${offset}-${i}`}
                              offset={offset}
                              index={i}
                              onRemove={() => removeOffset(addr.id, i)}
                            />
                          ))}
                          
                          {/* Summary */}
                          <div className="text-xs font-mono text-muted-foreground mt-2 mb-2">
                            {getFormattedAddressWithContext(addr)} → [{addr.offsets?.join(" → ")}]
                          </div>
                          
                          {/* New offset input and Add button */}
                          <div className="flex items-end gap-2 mb-2">
                            <div className="max-w-[200px]">
                              <Label htmlFor={`new-offset-${addr.id}`} className="text-sm">New Offset (hex)</Label>
                              <Input
                                id={`new-offset-${addr.id}`}
                                value={selectedAddressIndex === index ? newOffset : ""}
                                onChange={(e) => setNewOffset(e.target.value)}
                                placeholder="0x12345678"
                                className="font-mono text-sm"
                              />
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-[38px]"
                              onClick={() => addOffset(addr.id)}
                              disabled={!newOffset}
                            >
                              + Add Offset
                            </Button>
                          </div>

                        </div>
                
                        {/* Bitmask / Bitwise Op / Bitfield */}
                        <div className="flex flex-wrap gap-4 mb-4 items-end">
                          <div className="w-full md:w-[160px]">
                            <Label className="text-sm">Bitmask</Label>
                            <Input
                              value={addr.bitmask || ""}
                              onChange={(e) => updateMemoryAddressField(addr.id, "bitmask", e.target.value)}
                              placeholder="e.g. 0xFF"
                            />
                          </div>
                
                          <div className="w-full md:w-[180px]">
                            <Label className="text-sm">Bitwise Operation</Label>
                            <Select
                              value={addr.bitwiseOp === "" ? "none" : addr.bitwiseOp}
                              onValueChange={(value) =>
                                updateMemoryAddressField(addr.id, "bitwiseOp", value === "none" ? "" : value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="None" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem key="none-edit" value="none">None</SelectItem>
                                <SelectItem key="AND-edit" value="AND">AND</SelectItem>
                                <SelectItem key="OR-edit" value="OR">OR</SelectItem>
                                <SelectItem key="XOR-edit" value="XOR">XOR</SelectItem>
                                <SelectItem key="NOT-edit" value="NOT">NOT</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`bitfield-${addr.id}`}
                              checked={addr.bitfield}
                              onCheckedChange={(checked) =>
                                updateMemoryAddressField(addr.id, "bitfield", checked)
                              }
                            />
                            <Label htmlFor={`bitfield-${addr.id}`} className="text-sm">Use Bitfield</Label>
                          </div>
                        </div>
                
                        {/* Format / Script / Invert */}
                        <div className="flex flex-wrap gap-4 mb-2 items-end">
                          <div className="w-full md:w-[280px]">
                            <Label className="text-sm">Format String</Label>
                            <Input
                              value={addr.format || ""}
                              onChange={(e) => updateMemoryAddressField(addr.id, "format", e.target.value)}
                              placeholder="e.g. RPM={value}"
                            />
                          </div>
                
                          <div className="w-full md:w-[380px]">
                            <Label className="text-sm">Transform Script</Label>
                            <Input
                              value={addr.script || ""}
                              onChange={(e) => updateMemoryAddressField(addr.id, "script", e.target.value)}
                              placeholder="e.g. value * 2"
                            />
                          </div>
                
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`invert-${addr.id}`}
                              checked={addr.invert}
                              onCheckedChange={(checked) =>
                                updateMemoryAddressField(addr.id, "invert", checked)
                              }
                            />
                            <Label htmlFor={`invert-${addr.id}`} className="text-sm">Invert Value</Label>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </TableCompact>
      </div>
    </DndProvider>
  );
};

export default MemoryAddressTable;
