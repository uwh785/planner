import { createContext, useContext } from 'react';
import type { MessageKey } from '@/application/i18n';

/**
 * Lets a signed-in screen leave one polite sentence for the sign-in screen
 * that follows ("some tasks could not be saved"), since its own screen is
 * gone by then. Provided by SessionGate, which clears it on the next sign-in.
 */
export const SignOutNoticeContext = createContext<(key: MessageKey) => void>(
  () => undefined,
);

export const useLeaveSignOutNotice = () => useContext(SignOutNoticeContext);
