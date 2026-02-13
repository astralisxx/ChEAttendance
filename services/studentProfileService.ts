import { StudentProfile } from '../types';

const PROFILES_KEY = 'studentProfiles';

/**
 * Retrieves all student profiles from localStorage.
 */
export const getStudentProfiles = (): StudentProfile[] => {
  try {
    const profilesJSON = localStorage.getItem(PROFILES_KEY);
    return profilesJSON ? JSON.parse(profilesJSON) : [];
  } catch (error) {
    console.error("Failed to parse student profiles:", error);
    return [];
  }
};

/**
 * Saves or updates multiple student profiles.
 * @param newProfiles An array of new profiles to add or update.
 */
export const saveStudentProfiles = (newProfiles: StudentProfile[]) => {
  try {
    const existingProfiles = getStudentProfiles();
    const profileMap = new Map(existingProfiles.map(p => [p.name, p]));

    newProfiles.forEach(newProfile => {
      profileMap.set(newProfile.name, newProfile);
    });
    
    const updatedProfiles = Array.from(profileMap.values());
    localStorage.setItem(PROFILES_KEY, JSON.stringify(updatedProfiles));
  } catch (error) {
    console.error("Failed to save student profiles:", error);
  }
};


/**
 * Clears all student profiles from localStorage.
 */
export const clearStudentProfiles = (): void => {
  try {
    localStorage.removeItem(PROFILES_KEY);
  } catch (error) {
    console.error("Failed to clear student profiles:", error);
  }
};
