/**
 * Mirrors backend/src/common/validators/password-strength.validator.ts
 * exactly — at least one lowercase letter, one uppercase letter,
 * one digit, and one symbol. Length (min 8) is checked separately
 * with .min(8) so each rule keeps its own error message.
 *
 * The backend is the real enforcement point; this exists only so
 * the user sees the problem immediately while typing instead of
 * after a round-trip. If the rule ever changes, change it in both
 * places — this file is the single frontend copy.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).*$/;

/** For plain (non-Zod) forms: returns true only if the password meets both length and composition rules. */
export function isStrongPassword(value: string): boolean {
  return value.length >= PASSWORD_MIN_LENGTH && PASSWORD_STRENGTH_REGEX.test(value);
}
