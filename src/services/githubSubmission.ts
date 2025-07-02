import { format } from 'date-fns';
import { MemoryProfile, MemoryProfileOutput } from '@/types/memoryProfiles';
import { GitHubUser } from '@/state/githubAuthStore';

// Hard-coded GitHub repository configuration
const GITHUB_OWNER = 'ctrl-alt-paul';
const GITHUB_REPO = 'plynk-io-v026fresh';

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

export interface GitHubIssueData {
  title: string;
  body: string;
  labels: string[];
}

// Token encryption/decryption utilities to match the auth store
const STORAGE_KEY = 'github_auth_token';

const decryptToken = (encrypted: string): string | null => {
  try {
    const decoded = atob(encrypted);
    return decoded.replace('_plynk_salt', '');
  } catch {
    return null;
  }
};

const getStoredToken = (): string | null => {
  const encrypted = localStorage.getItem(STORAGE_KEY);
  return encrypted ? decryptToken(encrypted) : null;
};

export class GitHubSubmissionService {
  static validateProfileForSubmission(profile: MemoryProfile, selectedOutputIds: string[]): ValidationError[] {
    const errors: ValidationError[] = [];
    
    const selectedOutputs = profile.outputs.filter(output => 
      selectedOutputIds.includes(output.label)
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

  static formatSubmissionDate(date: Date): string {
    return format(date, 'dd MMM yyyy');
  }

  static createIssueTitle(gameName: string, username: string, submissionDate: Date): string {
    const formattedDate = this.formatSubmissionDate(submissionDate);
    return `${gameName} – (Submitted by ${username} on ${formattedDate})`;
  }

  static getGitHubLabels(emulator: string): string[] {
    return [
      'memory-profile',
      'pending-verify',
      emulator.toLowerCase()
    ];
  }

  static createIssueBody(submissionData: SubmissionData, user: GitHubUser, submissionDate: Date): string {
    const selectedOutputs = submissionData.profile.outputs.filter(output => 
      submissionData.selectedOutputIds.includes(output.label)
    );

    const addressesTable = selectedOutputs.map(output => {
      const addressValue = this.getAddressValue(output);
      const addressType = this.getAddressTypeLabel(output);
      const notes = submissionData.outputNotes[output.label] || output.notes || 'N/A';
      return `| ${output.label} | ${addressValue} | ${output.type} | ${addressType} | ${notes} |`;
    }).join('\n');

    const profileJson = JSON.stringify({
      process: submissionData.profile.process,
      pollInterval: submissionData.profile.pollInterval,
      outputs: selectedOutputs.map(output => ({
        label: output.label,
        type: output.type,
        address: output.address,
        offset: output.offset,
        useModuleOffset: output.useModuleOffset,
        moduleName: output.moduleName,
        notes: submissionData.outputNotes[output.label] || output.notes || '',
        invert: output.invert,
        format: output.format,
        script: output.script,
        offsets: output.offsets,
        bitmask: output.bitmask,
        bitwiseOp: output.bitwiseOp,
        bitfield: output.bitfield
      }))
    }, null, 2);

    return `## Game Information
**Game Name:** ${submissionData.gameName}
**Game Version:** ${submissionData.gameVersion || 'N/A'}
**Emulator:** ${submissionData.emulator}
**Process:** ${submissionData.profile.process}
**Poll Interval:** ${submissionData.profile.pollInterval}ms

## Submission Details
**Submitted by:** ${user.login}
**Submission Date:** ${this.formatSubmissionDate(submissionDate)}
**Number of Memory Addresses:** ${selectedOutputs.length}

## Description
${submissionData.globalNotes || 'No additional notes provided.'}

## Memory Addresses

| Label | Address | Type | Address Type | Notes |
|-------|---------|------|--------------|-------|
${addressesTable}

## Complete Profile JSON

\`\`\`json
${profileJson}
\`\`\`

---
*This memory profile was submitted through PLYNK-IO and is pending verification.*`;
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

      const submissionDate = new Date();
      
      const issueData: GitHubIssueData = {
        title: this.createIssueTitle(submissionData.gameName, user.login, submissionDate),
        body: this.createIssueBody(submissionData, user, submissionDate),
        labels: this.getGitHubLabels(submissionData.emulator)
      };

      // Call Electron IPC to create GitHub issue
      if (!window.electron) {
        throw new Error('Electron API not available');
      }

      // Get the user's token using the same encryption method as the auth store
      const token = getStoredToken();
      if (!token) {
        throw new Error('No GitHub token found. Please reconnect to GitHub.');
      }

      // Pass the token directly to the IPC call instead of using global
      const result = await window.electron.githubCreateIssue(GITHUB_OWNER, GITHUB_REPO, issueData, token);

      if (result.success && result.issueUrl) {
        return {
          success: true,
          issueUrl: result.issueUrl
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to create GitHub issue'
        };
      }
    } catch (error) {
      console.error('GitHub submission error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}
