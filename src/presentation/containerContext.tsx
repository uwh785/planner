import { createContext, useContext, useEffect, useState } from 'react';
import type { AppContainer, ContainerSource } from '@/application/container';

const ContainerContext = createContext<AppContainer | null>(null);

export const ContainerProvider = ContainerContext.Provider;

/** The repositories, once the local database is open; null until then. */
export const useContainer = (): AppContainer | null =>
  useContext(ContainerContext);

/**
 * Holds one reference on the container for the lifetime of the calling
 * component. Every acquire is paired with a release in the effect cleanup, so
 * React dev double effects and remounts never leak a database connection.
 */
export function useAcquiredContainer(
  source: ContainerSource,
): AppContainer | null {
  const [container, setContainer] = useState<AppContainer | null>(null);

  useEffect(() => {
    let active = true;
    source
      .acquire()
      .then(opened => {
        if (active) {
          setContainer(opened);
          if (__DEV__) {
            console.log(`db ready (schema v${opened.schemaVersion})`);
          }
        }
      })
      .catch(error => {
        if (active) {
          console.error('db init failed', error);
        }
      });
    return () => {
      active = false;
      setContainer(null);
      source.release();
    };
  }, [source]);

  return container;
}
