
import { MemoryProfile, MemoryProfileOutput } from '@/types/memoryProfiles';
import { GitHubUser } from '@/state/githubAuthStore';

export interface SubmissionData {
  profile: MemoryProfile;
  gameName: string;
  gameVersion: string;
  emulator: string;
  globalNotes: string;
  selectedOutputIds: string[];
  outputNotes: Record<string, string>;
}

export interface ValidationError {
  outputId: string;
  field: string;
  message: string;
}

export class GitHubSubmissionService {
  static validateProfileForSubmission(profile: MemoryProfile, selectedOutputIds: string[]): ValidationError[] {
    const errors: ValidationError[] = [];
    
    const selectedOutputs = profile.outputs.filter(output => 
      selectedOutputIds.includes(output.label) // Using label as ID for now
    );

    selectedOutputs.forEach(output => {
      if (output.useModuleOffset) {
        if (!output.moduleName?.trim()) {
          errors.push({
            outputId: output.label,
            field: 'moduleName',
            message: 'Module name is required when using module offset'
          });
        }
        if (!output.offset?.trim()) {
          errors.push({
            outputId: output.label,
            field: 'offset',
            message: 'Offset is required when using module offset'
          });
        }
      } else {
        if (!output.address?.trim()) {
          errors.push({
            outputId: output.label,
            field: 'address',
            message: 'Address is required when not using module offset'
          });
        }
      }
    });

    return errors;
  }

  static getAddressTypeLabel(output: MemoryProfileOutput): string {
    return output.useModuleOffset ? 'Module and Offset' : 'Absolute Address';
  }

  static getAddressValue(output: MemoryProfileOutput): string {
    if (output.useModuleOffset) {
      return `${output.moduleName} + ${output.offset}`;
    }
    return output.address || '';
  }

  static prepareProfileForSubmission(
    profile: MemoryProfile,
    submissionData: SubmissionData,
    user: GitHubUser,
    issueNumber: number
  ): MemoryProfile {
    const selectedOutputs = profile.outputs.filter(output => 
      submissionData.selectedOutputIds.includes(output.label)
    );

    // Transform outputs to community source and update notes
    const transformedOutputs = selectedOutputs.map(output => ({
      ...output,
      source: 'community' as const,
      notes: submissionData.outputNotes[output.label] || output.notes || ''
    }));

    const submissionProfile: MemoryProfile = {
      ...profile,
      outputs: transformedOutputs,
      memoryProfileType: 'community',
      _meta: {
        issue: issueNumber,
        submittedBy: user.login,
        submittedAt: new Date().toISOString(),
        gameName: submissionData.gameName,
        gameVersion: submissionData.gameVersion,
        emulator: submissionData.emulator,
        globalNotes: submissionData.globalNotes
      }
    };

    return submissionProfile;
  }

  static getGitHubLabels(emulator: string): string[] {
    return [
      'memory-profile',
      'pending-verify',
      emulator.toLowerCase()
    ];
  }

  static async submitProfile(submissionData: SubmissionData, user: GitHubUser): Promise<{ success: boolean; error?: string; issueUrl?: string }> {
    try {
      // Validate profile first
      const validationErrors = this.validateProfileForSubmission(
        submissionData.profile,
        submissionData.selectedOutputIds
      );

      if (validationErrors.length > 0) {
        return {
          success: false,
          error: `Validation failed: ${validationErrors.map(e => e.message).join(', ')}`
        };
      }

      // For now, we'll simulate the GitHub submission
      // In a real implementation, this would:
      // 1. Create/find the community profiles repository
      // 2. Create a new issue with the profile data
      // 3. Apply the appropriate labels
      
      const mockIssueNumber = Math.floor(Math.random() * 1000) + 100;
      const preparedProfile = this.prepareProfileForSubmission(
        submissionData.profile,
        submissionData,
        user,
        mockIssueNumber
      );

      console.log('Profile prepared for submission:', preparedProfile);
      console.log('GitHub Labels:', this.getGitHubLabels(submissionData.emulator));
      console.log('Issue Title:', `Memory Profile: ${submissionData.gameName}`);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      return {
        success: true,
        issueUrl: `https://github.com/plynk-io/community-profiles/issues/${mockIssueNumber}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}
