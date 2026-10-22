import type { ActiveSession } from '@/domain/auth';

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/**
 * The backend's own auth endpoints. register and login throw
 * `InvalidCredentialsError` on refusal; refresh throws `SessionExpiredError`
 * when the refresh token is no longer accepted. Network and server failures
 * surface as `NetworkError` / `HttpError`.
 */
export interface AuthGateway {
  register(input: RegisterInput): Promise<ActiveSession>;
  login(input: LoginInput): Promise<ActiveSession>;
  /** Rotates the refresh token: the old one stops working. */
  refresh(refreshToken: string): Promise<ActiveSession>;
  logout(refreshToken: string, signal?: AbortSignal): Promise<void>;
}
