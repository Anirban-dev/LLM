interface PendingSignupData {
  username: string;
  email: string;
  passwordHash: string;
}

interface OtpEntry {
  otp: string;
  expiresAt: number; // Unix timestamp ms
  pendingData?: PendingSignupData;
}

// In-memory cache for 5-minute OTPs (No MongoDB storage)
const otpStore = new Map<string, OtpEntry>();

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * Stores a 6-digit OTP code in memory for 5 minutes.
 */
export function setMemoryOtp(
  email: string,
  otp: string,
  pendingData?: PendingSignupData
): void {
  const normalizedEmail = email.toLowerCase().trim();
  const expiresAt = Date.now() + FIVE_MINUTES_MS;

  otpStore.set(normalizedEmail, {
    otp: otp.trim(),
    expiresAt,
    pendingData,
  });

  // Auto cleanup after 5 minutes
  setTimeout(() => {
    const current = otpStore.get(normalizedEmail);
    if (current && current.expiresAt <= Date.now()) {
      otpStore.delete(normalizedEmail);
    }
  }, FIVE_MINUTES_MS + 1000);
}

/**
 * Verifies an OTP code against memory cache.
 */
export function verifyMemoryOtp(
  email: string,
  inputOtp: string
): { valid: boolean; message?: string; pendingData?: PendingSignupData } {
  const normalizedEmail = email.toLowerCase().trim();
  const entry = otpStore.get(normalizedEmail);

  if (!entry) {
    return { valid: false, message: 'OTP not found or expired. Please request a new code.' };
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(normalizedEmail);
    return { valid: false, message: 'OTP code has expired (valid for 5 minutes only).' };
  }

  if (entry.otp !== inputOtp.trim()) {
    return { valid: false, message: 'Invalid OTP code. Please check and try again.' };
  }

  const pendingData = entry.pendingData;
  otpStore.delete(normalizedEmail); // Delete immediately after successful verification

  return { valid: true, pendingData };
}
