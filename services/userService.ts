const USERS_KEY = 'authorizedUsers';

// Default users are seeded if none exist in localStorage.
// This is a one-time setup to provide an example user.
// The admin can delete this user.
const seedDefaultUsers = () => {
  const defaultUsers = {
    "GEMINI-DEV-01": "Ahmet Berkay Şimşek",
  };
  localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
  return defaultUsers;
};

/**
 * Retrieves all authorized users from localStorage.
 * Seeds default users if none are found.
 */
export const getUsers = (): Record<string, string> => {
  try {
    const usersJSON = localStorage.getItem(USERS_KEY);
    return usersJSON ? JSON.parse(usersJSON) : seedDefaultUsers();
  } catch (error) {
    console.error("Failed to parse users from localStorage:", error);
    return seedDefaultUsers();
  }
};

/**
 * Generates a new, unique access key for a user and saves it.
 * @param name The name of the new user.
 * @returns The newly generated key.
 */
export const addUser = (name: string): string => {
  const users = getUsers();
  // Generate a unique key
  const newKey = `ODTU-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
  
  users[newKey] = name;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return newKey;
};

/**
 * Deletes a user by their access key.
 * @param key The key of the user to delete.
 */
export const deleteUser = (key: string): void => {
  const users = getUsers();
  delete users[key];
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

/**
 * Validates an access key.
 * @param key The key to validate.
 * @returns The name of the user if the key is valid, otherwise null.
 */
export const getUserNameByKey = (key: string): string | null => {
  const users = getUsers();
  return users[key] || null;
};