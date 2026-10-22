import type { SqlDatabase } from '@/application/ports/SqlDatabase';

type Row = { id: number; label: string | null };

/**
 * Behavior every SqlDatabase adapter must have. Run it against the Node
 * adapter in Jest; the op-sqlite adapter is verified on the emulator.
 */
export function describeSqlDatabaseContract(
  name: string,
  open: () => Promise<SqlDatabase>,
): void {
  describe(`SqlDatabase contract: ${name}`, () => {
    let db: SqlDatabase;

    beforeEach(async () => {
      db = await open();
      await db.execute(
        'CREATE TABLE t (id INTEGER PRIMARY KEY, label TEXT)',
      );
    });

    afterEach(async () => {
      await db.close();
    });

    const all = () => db.query<Row>('SELECT id, label FROM t ORDER BY id');

    it('inserts with params and reads rows back', async () => {
      const result = await db.execute('INSERT INTO t VALUES (?, ?)', [1, 'a']);
      expect(result.rowsAffected).toBe(1);
      expect(await all()).toEqual([{ id: 1, label: 'a' }]);
    });

    it('returns an empty array when nothing matches', async () => {
      expect(await db.query('SELECT * FROM t WHERE id = ?', [99])).toEqual([]);
    });

    it('round-trips null and reports rows affected by updates', async () => {
      await db.execute('INSERT INTO t VALUES (1, NULL), (2, NULL)');
      const result = await db.execute('UPDATE t SET label = ?', ['x']);
      expect(result.rowsAffected).toBe(2);
      await db.execute('UPDATE t SET label = ? WHERE id = 1', [null]);
      expect((await all())[0]).toEqual({ id: 1, label: null });
    });

    it('rejects invalid SQL and stays usable', async () => {
      await expect(db.execute('NOT SQL')).rejects.toBeDefined();
      await expect(db.query('SELECT * FROM missing')).rejects.toBeDefined();
      await db.execute('INSERT INTO t VALUES (1, ?)', ['ok']);
      expect(await all()).toHaveLength(1);
    });

    it('commits a transaction and returns the callback value', async () => {
      const value = await db.transaction(async tx => {
        await tx.execute('INSERT INTO t VALUES (1, ?)', ['a']);
        return 42;
      });
      expect(value).toBe(42);
      expect(await all()).toHaveLength(1);
    });

    it('rolls back and rethrows when the callback throws', async () => {
      await expect(
        db.transaction(async tx => {
          await tx.execute('INSERT INTO t VALUES (1, ?)', ['a']);
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      expect(await all()).toEqual([]);
    });

    it('rolls back when a statement inside the transaction fails', async () => {
      await db.execute('INSERT INTO t VALUES (1, ?)', ['keep']);
      await expect(
        db.transaction(async tx => {
          await tx.execute('INSERT INTO t VALUES (2, ?)', ['gone']);
          await tx.execute('INSERT INTO t VALUES (1, ?)', ['duplicate']);
        }),
      ).rejects.toBeDefined();
      expect(await all()).toEqual([{ id: 1, label: 'keep' }]);
    });

    it('lets a nested transaction use the same transaction', async () => {
      await db.transaction(async tx => {
        await tx.execute('INSERT INTO t VALUES (1, ?)', ['outer']);
        await tx.transaction(async inner => {
          await inner.execute('INSERT INTO t VALUES (2, ?)', ['inner']);
          expect(await inner.query('SELECT id FROM t')).toHaveLength(2);
        });
      });
      expect(await all()).toHaveLength(2);
    });

    it('rolls the outer transaction back over a committed nested one', async () => {
      await expect(
        db.transaction(async tx => {
          await tx.transaction(async inner => {
            await inner.execute('INSERT INTO t VALUES (1, ?)', ['inner']);
          });
          throw new Error('outer fails');
        }),
      ).rejects.toThrow('outer fails');
      expect(await all()).toEqual([]);
    });

    it('rolls back only the nested part when its failure is handled', async () => {
      await db.transaction(async tx => {
        await tx.execute('INSERT INTO t VALUES (1, ?)', ['outer']);
        await expect(
          tx.transaction(async inner => {
            await inner.execute('INSERT INTO t VALUES (2, ?)', ['inner']);
            throw new Error('inner fails');
          }),
        ).rejects.toThrow('inner fails');
      });
      expect(await all()).toEqual([{ id: 1, label: 'outer' }]);
    });

    it('serializes concurrent transactions', async () => {
      await db.execute('INSERT INTO t VALUES (1, ?)', ['0']);
      const bump = () =>
        db.transaction(async tx => {
          const [row] = await tx.query<Row>('SELECT label FROM t WHERE id = 1');
          await tx.execute('UPDATE t SET label = ? WHERE id = 1', [
            String(Number(row?.label) + 1),
          ]);
        });
      await Promise.all([bump(), bump(), bump()]);
      expect((await all())[0]?.label).toBe('3');
    });

    it('orders plain statements after an open transaction', async () => {
      const order: string[] = [];
      const tx = db.transaction(async inner => {
        await inner.execute('INSERT INTO t VALUES (1, ?)', ['a']);
        order.push('tx');
      });
      const after = db.execute('INSERT INTO t VALUES (2, ?)', ['b']).then(() => {
        order.push('plain');
      });
      await Promise.all([tx, after]);
      expect(order).toEqual(['tx', 'plain']);
    });

    it('refuses use of a transaction handle after it finished', async () => {
      let leaked!: SqlDatabase;
      await db.transaction(async tx => {
        leaked = tx;
      });
      await expect(leaked.execute('SELECT 1')).rejects.toThrow(/finished/);
    });
  });
}
