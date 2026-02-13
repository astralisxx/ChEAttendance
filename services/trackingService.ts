import { NOTIFICATION_ENDPOINT } from '../config';

/**
 * Sends a one-time email notification when a user logs in for the first time.
 * @param name The name of the user who logged in.
 */
export const pingUsage = async (name: string): Promise<void> => {
  const hasPinged = localStorage.getItem('usagePingSent');
  if (hasPinged || NOTIFICATION_ENDPOINT.includes('placeholder')) {
    // Don't send if already pinged or if the endpoint is not configured
    return;
  }

  const payload = {
    user: name,
    message: `A user, ${name}, has just accessed the ODTÜChE Attendance application.`,
    accessTime: new Date().toUTCString(),
  };

  try {
    await fetch(NOTIFICATION_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    localStorage.setItem('usagePingSent', 'true');
  } catch (error) {
    // Fail silently to not disrupt user experience
    console.error('Email notification failed:', error);
  }
};
