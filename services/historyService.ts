import { HistoryRecord } from '../types';
import { clearStudentProfiles } from './studentProfileService';

const HISTORY_KEY = 'attendanceHistory';

/**
 * Retrieves all history records from localStorage.
 */
export const getHistoryRecords = (): HistoryRecord[] => {
  try {
    const recordsJSON = localStorage.getItem(HISTORY_KEY);
    if (recordsJSON) {
      const records = JSON.parse(recordsJSON) as HistoryRecord[];
      // Sort by most recent first
      return records.sort((a, b) => b.id - a.id);
    }
    return [];
  } catch (error) {
    console.error("Failed to parse history records:", error);
    return [];
  }
};

/**
 * Saves a new history record to localStorage.
 * @param newRecord The new record to add.
 */
export const saveHistoryRecord = (newRecord: HistoryRecord) => {
  try {
    const existingRecords = getHistoryRecords();
    // Add the new record to the start of the array
    const updatedRecords = [newRecord, ...existingRecords.filter(r => r.id !== newRecord.id)];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedRecords));
  } catch (error) {
    console.error("Failed to save history record:", error);
  }
};

/**
 * Clears all history records and learned student profiles from localStorage.
 */
export const clearHistory = (): void => {
  try {
    localStorage.removeItem(HISTORY_KEY);
    // Also clear the learned faces for a full reset
    clearStudentProfiles(); 
  } catch (error) {
    console.error("Failed to clear history:", error);
  }
};
