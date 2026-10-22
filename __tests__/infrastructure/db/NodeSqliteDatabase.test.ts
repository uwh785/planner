import { NodeSqliteDatabase } from '@/infrastructure/db/NodeSqliteDatabase';
import { describeSqlDatabaseContract } from '../../helpers/sqlDatabaseContract';

describeSqlDatabaseContract('NodeSqliteDatabase', async () =>
  NodeSqliteDatabase.openInMemory(),
);
