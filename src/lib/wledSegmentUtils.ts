
import { WLEDRule, WLEDOutputProfile } from './wledProfiles';

/**
 * Map to store known segments for each device by IP
 */
const deviceSegmentsMap = new Map<string, number[]>();

/**
 * Extracts all unique segment IDs from a profile's rules
 * @param rules Array of WLED rules to extract segments from
 * @returns Array of unique segment IDs
 */
export const extractUniqueSegments = (rules: WLEDRule[]): number[] => {
  if (!rules || !Array.isArray(rules) || rules.length === 0) {
    return [0]; // Default to segment 0 if no rules
  }
  
  // Create a Set to store unique segment IDs
  const uniqueSegments = new Set<number>();
  
  // Extract segments from each rule
  rules.forEach(rule => {
    // Handle both the old segmentId property and new segments array
    if (rule.segments && Array.isArray(rule.segments)) {
      rule.segments.forEach(segId => uniqueSegments.add(segId));
    } else if (rule.segmentId !== undefined) {
      uniqueSegments.add(rule.segmentId);
    }
  });
  
  // If no segments were found, default to segment 0
  if (uniqueSegments.size === 0) {
    uniqueSegments.add(0);
  }
  
  // Convert Set to array and return
  return Array.from(uniqueSegments).sort((a, b) => a - b);
};

/**
 * Extracts unique segments from a full profile
 * @param profile The WLED profile to extract segments from
 * @returns Array of unique segment IDs
 */
export const getProfileSegments = (profile: WLEDOutputProfile | null): number[] => {
  if (!profile || !profile.rules) {
    return [0];
  }
  
  return extractUniqueSegments(profile.rules);
};

/**
 * Adds segments to the stored device segments map
 * @param deviceIP The device IP address
 * @param segments The segments to add
 */
export const storeDeviceSegments = (deviceIP: string, segments: number[]): void => {
  if (!deviceIP || !segments || segments.length === 0) return;

  // Get existing segments for this device
  const existingSegments = deviceSegmentsMap.get(deviceIP) || [0];
  
  // Merge with new segments and ensure uniqueness
  const mergedSegments = Array.from(new Set([...existingSegments, ...segments])).sort((a, b) => a - b);
  
  // Store updated segments
  deviceSegmentsMap.set(deviceIP, mergedSegments);
  
  //console.log(`Stored segments for device ${deviceIP}:`, mergedSegments);
};

/**
 * Gets all known segments for a device by IP address
 * @param deviceIP The device IP address
 * @returns Array of known segment IDs for this device
 */
export const getDeviceSegments = (deviceIP: string): number[] => {
  if (!deviceIP) return [0];
  
  const segments = deviceSegmentsMap.get(deviceIP);
  return segments || [0];
};

/**
 * Clears segment data for testing or resets
 */
export const clearDeviceSegments = (): void => {
  deviceSegmentsMap.clear();
};
