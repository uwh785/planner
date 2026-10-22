import { ValidationError } from '@/domain/validation';

export type CredentialErrors = { email?: string; password?: string };

/** Client-side basics only; the server stays the authority. */
export function validateCredentials(
  email: string,
  password: string,
): CredentialErrors {
  const errors: CredentialErrors = {};
  if (email.trim() === '') {
    errors.email = 'Email is required';
  }
  if (password === '') {
    errors.password = 'Password is required';
  }
  return errors;
}

/** Throws ValidationError for the first missing field; returns the trimmed email. */
export function credentials(
  email: string,
  password: string,
): { email: string } {
  const errors = validateCredentials(email, password);
  const message = errors.email ?? errors.password;
  if (message) {
    throw new ValidationError(message);
  }
  return { email: email.trim() };
}
