import type { AppContainer } from '@/application/container';
import type { SqlDatabase } from '@/application/ports/SqlDatabase';
import { databaseFileName } from '../db/databaseName';
import { initDatabase } from '../db/initDatabase';
import {
  createRepositories,
  type RepositoryDeps,
} from '../db/repositories/createRepositories';

/** Builds the container over an already migrated database. */
export function buildContainer(
  db: SqlDatabase,
  schemaVersion: number,
  deps?: RepositoryDeps,
): AppContainer {
  return {
    ...createRepositories(db, deps),
    schemaVersion,
    close: () => db.close(),
  };
}

export interface ContainerOptions {
  /** Signed-in user; selects the database file (planner_<userId>.db). */
  userId: string;
}

/** Opens the user's database, migrates it and builds the container. */
export async function createContainer(
  options: ContainerOptions,
): Promise<AppContainer> {
  const fileName = databaseFileName(options.userId);
  const { db, schemaVersion } = await initDatabase(fileName);
  return buildContainer(db, schemaVersion);
}
