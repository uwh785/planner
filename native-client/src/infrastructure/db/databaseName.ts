/**
 * File name of a user's database: `planner_<userId>.db`. One file per
 * signed-in user keeps accounts isolated on a shared device, which is why the
 * tables carry no user_id column. Ids that could escape the directory or
 * confuse the file system are refused.
 */
export function databaseFileName(userId: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(userId)) {
    throw new Error('Unsafe user id for a database file name');
  }
  return `planner_${userId}.db`;
}
