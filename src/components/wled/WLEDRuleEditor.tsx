
import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { WLEDEffect, WLEDRule } from '@/lib/wledProfiles';
import { X, Plus, AlertTriangle } from 'lucide-react';

interface WLEDRuleEditorProps {
  rules: WLEDRule[];
  availableEffects: WLEDEffect[];
  availableSegments: number[];
  isConnected: boolean;
  expandedRules: string[];
  onAddRule: () => void;
  onDeleteRule: (ruleId: string) => void;
  onUpdateRule: (ruleId: string, field: string, value: any) => void;
  onToggleSegment: (ruleId: string, segmentId: number, checked: boolean) => void;
  onToggleExpansion: (ruleId: string) => void;
}

export const WLEDRuleEditor: React.FC<WLEDRuleEditorProps> = ({
  rules,
  availableEffects,
  availableSegments,
  isConnected,
  expandedRules,
  onAddRule,
  onDeleteRule,
  onUpdateRule,
  onToggleSegment,
  onToggleExpansion
}) => {
  // Helper function to get effect name from ID
  const getEffectName = (effectId: number): string => {
    const effect = availableEffects.find(e => e.id === effectId);
    return effect ? effect.name : `Effect #${effectId}`;
  };
  
  // Updated helper function to generate rule summary with turnOffSegment status
  const getRuleSummary = (rule: WLEDRule): string => {
    // Generate the trigger part
    const triggerText = rule.triggerType === 'exact'
      ? `Value = ${rule.exactValue}`
      : `${rule.minValue}–${rule.maxValue}`;
    
    // Generate the segments part
    const segments = rule.segments || [];
    const segmentText = segments.length > 0
      ? `(Segments: ${segments.sort((a, b) => a - b).join(', ')})`
      : '(No segments)';
    
    // Check if we're turning segments off
    if (rule.turnOffSegment) {
      return `${triggerText} → Turn OFF ${segmentText}`;
    }
    
    // Generate the effect part for regular rules
    const effectName = getEffectName(rule.effect || 0);
    
    // Combine everything
    return `${triggerText} → ${effectName} ${segmentText}`;
  };

  // Modified renderAddRuleButton to preserve form values when clicked
  const handleAddRuleClick = (event: React.MouseEvent) => {
    event.preventDefault(); // Prevent form submission
    onAddRule(); // Call the passed onAddRule function
  };

  return (
    <div className="mt-3">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium">Rules</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleAddRuleClick} 
          type="button"
          className="h-7 text-xs px-2"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Rule
        </Button>
      </div>
      
      {/* Connection Status Warning - Modified to be non-intrusive and indicate offline functionality */}
      {!isConnected && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md p-2 mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <p className="text-xs">
            {rules.length > 0 
              ? "Device is disconnected. Limited effects and segments are available in offline mode."
              : "Device is disconnected. Rules will use basic effects and segment 0 until connected."}
          </p>
        </div>
      )}
      
      {/* Show "no rules" message only when there are no rules (regardless of connection) */}
      {rules.length === 0 && (
        <div className="text-center p-4 border rounded-md">
          <p className="text-muted-foreground text-sm">No rules added yet</p>
          <Button 
            variant="outline" 
            className="mt-2 h-7 text-xs" 
            onClick={handleAddRuleClick}
            type="button"
          >
            Add Your First Rule
          </Button>
        </div>
      )}
      
      {/* Always show rules if they exist, regardless of connection status */}
      {rules.length > 0 && (
        <div className="space-y-3">
          {rules.map((rule, index) => {
            const isExpanded = expandedRules.includes(rule.id);
            const isTurnOffSegmentActive = rule.turnOffSegment === true;
            
            return (
              <div key={`rule-${rule.id}`} className="border rounded-md overflow-hidden shadow-sm">
                {/* Rule Header - Now the entire header is clickable */}
                <div 
                  className="flex items-center justify-between px-3 py-2 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onToggleExpansion(rule.id)}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Rule {index + 1}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[300px] sm:max-w-[400px] md:max-w-[500px]">
                      {getRuleSummary(rule)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent triggering the parent onClick
                        onDeleteRule(rule.id);
                      }}
                      type="button"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Rule Content */}
                {isExpanded && (
                  <div className="px-4 py-3 bg-background border-t">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                      {/* Trigger Type */}
                      <div>
                        <label className="block text-xs font-medium mb-1">Trigger Type</label>
                        <Select
                          value={rule.triggerType}
                          onValueChange={(value: 'exact' | 'range') => onUpdateRule(rule.id, 'triggerType', value)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Select trigger type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="exact">Exact Value</SelectItem>
                            <SelectItem value="range">Value Range</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Value Input(s) based on trigger type */}
                      {rule.triggerType === 'exact' ? (
                        <div>
                          <label className="block text-xs font-medium mb-1">Value</label>
                          <Input
                            type="number"
                            value={rule.exactValue || 0}
                            onChange={(e) => onUpdateRule(rule.id, 'exactValue', parseInt(e.target.value, 10))}
                            className="h-7 text-xs"
                          />
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs font-medium mb-1">Min Value</label>
                            <Input
                              type="number"
                              value={rule.minValue || 0}
                              onChange={(e) => onUpdateRule(rule.id, 'minValue', parseInt(e.target.value, 10))}
                              className="h-7 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Max Value</label>
                            <Input
                              type="number"
                              value={rule.maxValue || 0}
                              onChange={(e) => onUpdateRule(rule.id, 'maxValue', parseInt(e.target.value, 10))}
                              className="h-7 text-xs"
                            />
                          </div>
                        </>
                      )}
                      
                      {/* Effect Selector */}
                      <div className={rule.triggerType === 'range' ? 'md:col-span-2' : ''}>
                        <label className="block text-xs font-medium mb-1">Effect</label>
                        <Select
                          value={rule.effect.toString()}
                          onValueChange={(value) => onUpdateRule(rule.id, 'effect', parseInt(value, 10))}
                          disabled={isTurnOffSegmentActive}
                        >
                          <SelectTrigger className={`h-7 text-xs ${isTurnOffSegmentActive ? "opacity-50" : ""}`}>
                            <SelectValue placeholder="Select effect" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableEffects.length > 0 ? (
                              availableEffects.map(effect => (
                                <SelectItem key={`effect-${rule.id}-${effect.id}`} value={effect.id.toString()}>
                                  {effect.name}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="0">Solid</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Target Segments - Scrollable horizontal layout with better spacing */}
                      <div className="col-span-2 md:col-span-4 mt-1">
                        <label className="block text-xs font-medium mb-2">Target Segments</label>
                        <div className="flex flex-wrap gap-2">
                          {availableSegments.length > 0 ? (
                            availableSegments.map((segmentId) => (
                              <div key={`segment-${rule.id}-${segmentId}`} className="flex items-center border rounded px-2 py-1 bg-muted/20">
                                <Checkbox 
                                  id={`segment-${rule.id}-${segmentId}`}
                                  checked={rule.segments?.includes(segmentId) || false}
                                  onCheckedChange={(checked) => 
                                    onToggleSegment(rule.id, segmentId, checked === true)
                                  }
                                  className="h-3 w-3 mr-1.5"
                                />
                                <label 
                                  htmlFor={`segment-${rule.id}-${segmentId}`}
                                  className="text-xs"
                                >
                                  {segmentId}
                                </label>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              No segments available
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Turn Off Segment Toggle - New feature */}
                      <div className="col-span-2 md:col-span-4">
                        <div className="flex items-center justify-start space-x-2 mt-1 mb-2 py-2 border-t border-b">
                          <Switch 
                            checked={rule.turnOffSegment === true}
                            onCheckedChange={(checked) => onUpdateRule(rule.id, 'turnOffSegment', checked)}
                            id={`turn-off-${rule.id}`}
                          />
                          <label 
                            htmlFor={`turn-off-${rule.id}`}
                            className="text-xs font-medium cursor-pointer"
                          >
                            Turn Off Segment
                          </label>
                          <span className="text-xs text-muted-foreground ml-2">
                            (Disables all other settings)
                          </span>
                        </div>
                      </div>

                      {/* Color Picker - disabled when turnOffSegment is active */}
                      <div className="col-span-2">
                        <label className="block text-xs font-medium mb-1">Color</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="color"
                            value={`#${rule.color[0].toString(16).padStart(2, '0')}${rule.color[1].toString(16).padStart(2, '0')}${rule.color[2].toString(16).padStart(2, '0')}`}
                            onChange={(e) => {
                              const hex = e.target.value.substring(1);
                              const r = parseInt(hex.substring(0, 2), 16);
                              const g = parseInt(hex.substring(2, 4), 16);
                              const b = parseInt(hex.substring(4, 6), 16);
                              onUpdateRule(rule.id, 'color', [r, g, b]);
                            }}
                            className={`w-8 h-6 p-0 border-0 ${isTurnOffSegmentActive ? "opacity-50" : ""}`}
                            disabled={isTurnOffSegmentActive}
                          />
                          <span className={`text-xs ${isTurnOffSegmentActive ? "text-muted-foreground" : ""}`}>
                            RGB: [{rule.color[0]}, {rule.color[1]}, {rule.color[2]}]
                          </span>
                        </div>
                      </div>

                      {/* Brightness Slider - disabled when turnOffSegment is active */}
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${isTurnOffSegmentActive ? "text-muted-foreground" : ""}`}>
                          Brightness: {isTurnOffSegmentActive ? "0" : rule.brightness}
                        </label>
                        <Slider
                          value={[isTurnOffSegmentActive ? 0 : rule.brightness]}
                          min={0}
                          max={255}
                          step={1}
                          onValueChange={(values) => onUpdateRule(rule.id, 'brightness', values[0])}
                          className={`py-0 ${isTurnOffSegmentActive ? "opacity-50" : ""}`}
                          disabled={isTurnOffSegmentActive}
                        />
                      </div>

                      {/* Flash Toggle - disabled when turnOffSegment is active */}
                      <div className="flex items-center">
                        <div>
                          <label className={`block text-xs font-medium mb-1 ${isTurnOffSegmentActive ? "text-muted-foreground" : ""}`}>Flash</label>
                          <Switch
                            checked={isTurnOffSegmentActive ? false : rule.flash}
                            onCheckedChange={(checked) => onUpdateRule(rule.id, 'flash', checked)}
                            disabled={isTurnOffSegmentActive}
                            className={`h-4 w-7 data-[state=checked]:bg-primary ${isTurnOffSegmentActive ? "opacity-50" : ""}`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
