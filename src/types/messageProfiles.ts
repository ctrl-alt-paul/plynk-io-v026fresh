
export interface MessageProfileOutput {
  key: string;
  label: string;
  lastValue?: number | string;
  format: string;
  script: string;
}

export interface MessageProfile {
  profileName: string;
  outputs: MessageProfileOutput[];
  /**
   * The type of message profile - 'default' for built-in profiles, 'user' for user-created profiles, 'community' for community profiles
   */
  messageProfileType?: 'default' | 'user' | 'community';
}
