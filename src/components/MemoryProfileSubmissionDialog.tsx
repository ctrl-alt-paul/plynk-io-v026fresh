import React, { useState, useMemo } from 'react';
import { Upload, Github, CheckCircle, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MemoryProfile, MemoryProfileOutput } from '@/types/memoryProfiles';
import { useGitHubAuth } from '@/state/githubAuthStore';
import { GitHubSubmissionService, SubmissionData, ValidationError } from '@/services/githubSubmission';

interface MemoryProfileSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: MemoryProfile;
  process?: string;
  pollInterval?: number;
  userOutputs: MemoryProfileOutput[];
}

const EMULATOR_OPTIONS = [
  'Teknoparrot',
  'Mame', 
  'Model 2',
  'Supermodel 3',
  'Dolphin',
  'PCSX2',
  'RPCS3',
  'Demul',
  'None'
];

export function MemoryProfileSubmissionDialog({
  open,
  onOpenChange,
  profile,
  process,
  pollInterval,
  userOutputs
}: MemoryProfileSubmissionDialogProps) {
  const { user, isConnected } = useGitHubAuth();
  const [selectedOutputs, setSelectedOutputs] = useState<string[]>([]);
  const [gameName, setGameName] = useState('');
  const [gameVersion, setGameVersion] = useState('');
  const [emulator, setEmulator] = useState('');
  const [globalNotes, setGlobalNotes] = useState('');
  const [outputNotes, setOutputNotes] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Create a temporary profile if none is provided
  const workingProfile = useMemo(() => {
    if (profile) return profile;
    
    return {
      id: 'temp-profile',
      fileName: 'temp-profile',
      process: process || '',
      pollInterval: pollInterval || 16,
      outputs: userOutputs,
      memoryProfileType: 'user' as const
    };
  }, [profile, process, pollInterval, userOutputs]);

  // Initialize output notes from userOutputs
  React.useEffect(() => {
    const initialNotes: Record<string, string> = {};
    userOutputs.forEach(output => {
      initialNotes[output.label] = output.notes || '';
    });
    setOutputNotes(initialNotes);
  }, [userOutputs]);

  // Validate form whenever selections change
  const validation = useMemo(() => {
    if (selectedOutputs.length === 0 || gameName.trim() === '') return { isValid: false, errors: [] };
    
    const errors = GitHubSubmissionService.validateProfileForSubmission(workingProfile, selectedOutputs);
    setValidationErrors(errors);
    
    return {
      isValid: errors.length === 0 && gameName.trim() !== '' && emulator !== '',
      errors
    };
  }, [workingProfile, selectedOutputs, gameName, emulator]);

  const handleOutputToggle = (outputLabel: string, checked: boolean) => {
    setSelectedOutputs(prev => 
      checked 
        ? [...prev, outputLabel]
        : prev.filter(label => label !== outputLabel)
    );
  };

  const handleSelectAll = () => {
    setSelectedOutputs(userOutputs.map(output => output.label));
  };

  const handleDeselectAll = () => {
    setSelectedOutputs([]);
  };

  const handleNotesChange = (outputLabel: string, notes: string) => {
    setOutputNotes(prev => ({
      ...prev,
      [outputLabel]: notes
    }));
  };

  const handleSubmit = async () => {
    if (!isConnected || !user) {
      toast.error('Please connect to GitHub first');
      return;
    }

    if (!validation.isValid) {
      toast.error('Please fix validation errors before submitting');
      return;
    }

    setIsSubmitting(true);

    try {
      const submissionData: SubmissionData = {
        profile: workingProfile,
        gameName: gameName.trim(),
        gameVersion: gameVersion.trim(),
        emulator,
        globalNotes: globalNotes.trim(),
        selectedOutputIds: selectedOutputs,
        outputNotes
      };

      const result = await GitHubSubmissionService.submitProfile(submissionData, user);

      if (result.success) {
        toast.success('Profile submitted successfully!');
        if (result.issueUrl) {
          toast.info(`View submission: ${result.issueUrl}`);
        }
        onOpenChange(false);
        
        // Reset form
        setSelectedOutputs([]);
        setGameName('');
        setGameVersion('');
        setEmulator('');
        setGlobalNotes('');
        setOutputNotes({});
      } else {
        toast.error(result.error || 'Submission failed');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
      console.error('Submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              GitHub Connection Required
            </DialogTitle>
            <DialogDescription>
              You need to connect your GitHub account to submit memory profiles to the community.
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Connect your GitHub account to share your memory profiles with the PLYNK-IO community.
            </p>
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Submit Memory Profile to Community
          </DialogTitle>
          <DialogDescription>
            Share your memory profile with the PLYNK-IO community. Selected addresses will be reviewed and made available to other users.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile Info */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Profile Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Process:</span> {workingProfile.process}
              </div>
              <div>
                <span className="text-muted-foreground">Poll Interval:</span> {workingProfile.pollInterval}ms
              </div>
            </div>
          </div>

          {/* Submission Details */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="gameName">Game Name *</Label>
              <Input
                id="gameName"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="e.g., Sega Rally 3, Daytona USA, etc."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="gameVersion">Game Version</Label>
                <Input
                  id="gameVersion"
                  value={gameVersion}
                  onChange={(e) => setGameVersion(e.target.value)}
                  placeholder="e.g., v1.2.3, Steam Version, etc."
                />
              </div>
              <div>
                <Label htmlFor="emulator">Emulator *</Label>
                <Select value={emulator} onValueChange={setEmulator}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select emulator" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMULATOR_OPTIONS.map(option => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="globalNotes">Description / Notes</Label>
            <Textarea
              id="globalNotes"
              value={globalNotes}
              onChange={(e) => setGlobalNotes(e.target.value)}
              placeholder="Describe the profile, any special requirements, testing notes, etc."
              rows={3}
            />
          </div>

          {/* Memory Addresses Selection */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Select Memory Addresses to Submit</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                  Deselect All
                </Button>
              </div>
            </div>

            {userOutputs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No user-created memory addresses found.</p>
                <p className="text-sm">Create some memory addresses in the Memory Manager first.</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 grid grid-cols-12 gap-2 font-medium text-xs">
                  <div className="col-span-1">Select</div>
                  <div className="col-span-2">Label</div>
                  <div className="col-span-3">Address</div>
                  <div className="col-span-2">Type</div>
                  <div className="col-span-4">Notes</div>
                </div>
                {userOutputs.map((output) => {
                  const hasError = validationErrors.some(err => err.outputId === output.label);
                  const isSelected = selectedOutputs.includes(output.label);
                  
                  return (
                    <div key={output.label} className={`px-3 py-2 grid grid-cols-12 gap-2 border-t text-xs items-center ${hasError && isSelected ? 'bg-red-50' : ''}`}>
                      <div className="col-span-1 flex items-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleOutputToggle(output.label, checked as boolean)}
                        />
                      </div>
                      <div className="col-span-2 font-medium flex items-center">
                        {output.label}
                        {hasError && isSelected && (
                          <AlertCircle className="h-4 w-4 text-red-500 inline ml-1" />
                        )}
                      </div>
                      <div className="col-span-3 font-mono flex items-center">
                        {GitHubSubmissionService.getAddressValue(output)}
                      </div>
                      <div className="col-span-2 flex items-center">
                        <Badge variant="secondary" className="text-xs">
                          {GitHubSubmissionService.getAddressTypeLabel(output)}
                        </Badge>
                      </div>
                      <div className="col-span-4 flex items-center">
                        <Input
                          value={outputNotes[output.label] || ''}
                          onChange={(e) => handleNotesChange(output.label, e.target.value)}
                          placeholder="Add notes..."
                          className="text-xs h-7 w-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Validation Errors
              </h4>
              <ul className="space-y-1 text-sm text-red-700">
                {validationErrors.map((error, index) => (
                  <li key={index}>
                    <strong>{error.outputId}:</strong> {error.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Submission Summary */}
          {selectedOutputs.length > 0 && validation.isValid && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Ready for Submission
              </h4>
              <p className="text-sm text-green-700">
                {selectedOutputs.length} memory address{selectedOutputs.length === 1 ? '' : 'es'} selected for submission to the community.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!validation.isValid || isSubmitting || selectedOutputs.length === 0}
            className="flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
                Submitting...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Submit to GitHub
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
