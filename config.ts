// --- ADMIN & ACCESS CONFIGURATION ---
// This is the master key that grants access to the Admin Panel.
// KEEP THIS KEY SECRET.
export const MASTER_KEY = "adminche";


// --- EMAIL NOTIFICATION SERVICE ---
// This service will send an email to you every time a user logs in for the first time.
//
// HOW TO SET UP YOUR GMAIL NOTIFICATIONS (takes 2 minutes):
// 1. Go to https://formspree.io/
// 2. Click "Create a new form".
// 3. Enter your Gmail address when prompted and create the form.
// 4. On the form's "Integration" page, you will see a URL that looks like:
//    https://formspree.io/f/xxxxxxxx
// 5. Copy that URL and paste it below to replace the placeholder.

export const NOTIFICATION_ENDPOINT = "https://formspree.io/f/xgolayqv"; // <-- REPLACE THIS URL
