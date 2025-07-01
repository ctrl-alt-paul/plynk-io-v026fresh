
import { useEffect, useState } from 'react';
import { WLEDOutputProfile, getAllWLEDProfiles, loadWLEDProfile, saveWLEDProfile, migrateWLEDProfile } from '@/lib/wledProfiles';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle } from 'lucide-react';

/**
 * Helper component that migrates existing WLED profiles to the new format
 * without the global segments array
 */
const WLEDProfileMigrationHelper: React.FC = () => {
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const [migrationResults, setMigrationResults] = useState<{
    total: number;
    migrated: number;
    skipped: number;
  }>({ total: 0, migrated: 0, skipped: 0 });

  const migrateProfiles = async () => {
    try {
      setIsMigrating(true);
      setMigrationComplete(false);
      
      // Get all profile filenames
      const profileFiles = await getAllWLEDProfiles();
      const results = { total: profileFiles.length, migrated: 0, skipped: 0 };
      
      // Load and check each profile
      for (const fileName of profileFiles) {
        const profile = await loadWLEDProfile(fileName);
        if (!profile) {
          results.skipped++;
          continue;
        }
        
        // Check if migration is needed
        if (profile.segments && Array.isArray(profile.segments)) {
          // Migrate the profile
          const migratedProfile = migrateWLEDProfile(profile);
          
          // Save the migrated profile back
          await saveWLEDProfile(migratedProfile);
          results.migrated++;
        } else {
          results.skipped++;
        }
      }
      
      setMigrationResults(results);
      setMigrationComplete(true);
      
      if (results.migrated > 0) {
        toast({
          title: "Migration Complete",
          description: `Successfully migrated ${results.migrated} profiles to the new format.`,
        });
      } else {
        toast({
          title: "No Migration Needed",
          description: "All profiles are already using the current format.",
        });
      }
    } catch (error) {
      //console.error('Error during WLED profile migration:', error);
      toast({
        title: "Migration Error",
        description: `Error migrating profiles: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      {migrationComplete ? (
        <>
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>
            Migration complete: {migrationResults.migrated} profiles updated, 
            {migrationResults.skipped} already up-to-date
          </span>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={migrateProfiles}
          disabled={isMigrating}
        >
          {isMigrating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Migrating...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Migrate WLED Profiles
            </>
          )}
        </Button>
      )}
    </div>
  );
};

export default WLEDProfileMigrationHelper;
