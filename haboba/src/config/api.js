// API base URL — uses Expo Constants for environment-based config.
// In production, set EXPO_PUBLIC_API_URL in your EAS build profile.
// Falls back to localhost for development.

const DEV_API_URL = 'http://localhost:4000/v1';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEV_API_URL;
