/** What a known subject lends a new class of the same subject. */
export interface KnownSubject {
  /** The spelling already in use. */
  subject: string;
  teacher: string;
  color: string;
}

/**
 * Subjects are compared through this key and never displayed through it:
 * trimmed, accents folded (NFD splits "Í" into "I" plus a combining mark,
 * which is then dropped) and lower-cased, so "FISICA" finds "Física".
 */
export function normalizeSubject(subject: string): string {
  return subject.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** The subjects already used, by folded key; the first class of each wins. */
export function buildSubjectCatalog(
  classes: readonly { subject: string; teacher: string; color: string }[],
): Map<string, KnownSubject> {
  const catalog = new Map<string, KnownSubject>();
  for (const c of classes) {
    const key = normalizeSubject(c.subject);
    if (key !== '' && !catalog.has(key)) {
      catalog.set(key, {
        subject: c.subject,
        teacher: c.teacher,
        color: c.color,
      });
    }
  }
  return catalog;
}

/** Known subjects containing the folded query; an empty query lists them all. */
export function filterSubjects(
  catalog: ReadonlyMap<string, KnownSubject>,
  query: string,
): KnownSubject[] {
  const needle = normalizeSubject(query);
  return [...catalog]
    .filter(([key]) => key.includes(needle))
    .map(([, known]) => known);
}

export interface InheritResult {
  subject: string;
  teacher: string;
  color: string;
  /** True when the teacher or the color came from the known subject. */
  inherited: boolean;
}

/**
 * Typing a subject that is already known lends its teacher and its color to
 * the form, unless the user has edited that field. Null for a blank or an
 * unknown subject, which changes nothing.
 */
export function inheritFromSubject(
  catalog: ReadonlyMap<string, KnownSubject>,
  typed: string,
  current: { teacher: string; color: string },
  edited: { teacher: boolean; color: boolean },
): InheritResult | null {
  const known = catalog.get(normalizeSubject(typed));
  if (known === undefined) {
    return null;
  }
  const takeTeacher = !edited.teacher && known.teacher !== '';
  const takeColor = !edited.color && known.color !== '';
  return {
    subject: known.subject,
    teacher: takeTeacher ? known.teacher : current.teacher,
    color: takeColor ? known.color : current.color,
    inherited: takeTeacher || takeColor,
  };
}
