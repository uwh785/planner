import type { AppBoot } from '@/application/services';
import { createAppServices } from './createAppServices';
import type { AppServicesOptions } from './createAppServices';

/** Shown instead of the app when the build cannot start; no secrets, no URLs. */
const FATAL_MESSAGE =
  'Planner is not set up correctly in this build. Please install an official version.';

/**
 * Builds the services without ever throwing. A configuration failure is
 * logged for developers and returned as a `fatal` state, so the component
 * still registers and the user sees a clear screen instead of a crash.
 */
export function bootstrapApp(options?: AppServicesOptions): AppBoot {
  try {
    return { kind: 'ready', services: createAppServices(options) };
  } catch (error) {
    console.error('startup failed', error);
    return { kind: 'fatal', message: FATAL_MESSAGE };
  }
}
