// Admin credentials for Settings page - change in production
export const ADMIN_USERNAME = 'admin';
export const ADMIN_DEFAULT_PASSWORD = '1234';

// Forgot password - only this email can request OTP to reset admin password (must match backend RESET_EMAIL)
export const FORGOT_PASSWORD_EMAIL = 'oliyaruviprinters@gmail.com';

export const ADMIN_AUTH_KEY = 'admin_authenticated';
export const ADMIN_PASSWORD_KEY = 'admin_password';
export const OTP_PENDING_KEY = 'otp_pending';

export function getAdminPassword(): string {
  try {
    return localStorage.getItem(ADMIN_PASSWORD_KEY) || ADMIN_DEFAULT_PASSWORD;
  } catch {
    return ADMIN_DEFAULT_PASSWORD;
  }
}

export function setAdminPassword(password: string) {
  localStorage.setItem(ADMIN_PASSWORD_KEY, password);
}
