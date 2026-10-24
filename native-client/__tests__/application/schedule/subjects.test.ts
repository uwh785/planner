import {
  buildSubjectCatalog,
  filterSubjects,
  inheritFromSubject,
  normalizeSubject,
} from '@/application/schedule/subjects';

const cls = (subject: string, teacher = '', color = '') => ({
  subject,
  teacher,
  color,
});

describe('subject catalog', () => {
  it('folds case, accents and padding into one key', () => {
    expect(normalizeSubject('  FÍSICA ')).toBe('fisica');
    expect(normalizeSubject('Física')).toBe('fisica');
    expect(normalizeSubject('')).toBe('');
  });

  it('keeps the first class of each subject', () => {
    const catalog = buildSubjectCatalog([
      cls('FÍSICA', 'Ruiz', '#FF453A'),
      cls('FISICA', 'Otro', '#0A84FF'),
      cls('MATEMÁTICAS', 'Paz'),
      cls('   '),
    ]);
    expect([...catalog.keys()]).toEqual(['fisica', 'matematicas']);
    expect(catalog.get('fisica')).toEqual({
      subject: 'FÍSICA',
      teacher: 'Ruiz',
      color: '#FF453A',
    });
  });

  it('filters by the folded query and lists all for an empty one', () => {
    const catalog = buildSubjectCatalog([
      cls('FÍSICA'),
      cls('MATEMÁTICAS'),
      cls('QUÍMICA'),
    ]);
    expect(filterSubjects(catalog, 'fis').map(s => s.subject)).toEqual([
      'FÍSICA',
    ]);
    expect(filterSubjects(catalog, 'ICA').map(s => s.subject)).toEqual([
      'FÍSICA',
      'MATEMÁTICAS',
      'QUÍMICA',
    ]);
    expect(filterSubjects(catalog, '')).toHaveLength(3);
    expect(filterSubjects(catalog, 'zzz')).toEqual([]);
  });
});

describe('inheriting a known subject', () => {
  const catalog = buildSubjectCatalog([cls('FÍSICA', 'Ruiz', '#FF453A')]);
  const blank = { teacher: '', color: '#0A84FF' };

  it('copies teacher and color when neither was edited', () => {
    expect(
      inheritFromSubject(catalog, 'fisica', blank, {
        teacher: false,
        color: false,
      }),
    ).toEqual({
      subject: 'FÍSICA',
      teacher: 'Ruiz',
      color: '#FF453A',
      inherited: true,
    });
  });

  it('keeps what the user edited', () => {
    expect(
      inheritFromSubject(
        catalog,
        'Física',
        { teacher: 'Mine', color: '#0A84FF' },
        { teacher: true, color: false },
      ),
    ).toMatchObject({ teacher: 'Mine', color: '#FF453A', inherited: true });
    expect(
      inheritFromSubject(
        catalog,
        'Física',
        { teacher: 'Mine', color: '#BF5AF2' },
        { teacher: true, color: true },
      ),
    ).toMatchObject({ teacher: 'Mine', color: '#BF5AF2', inherited: false });
  });

  it('does nothing for an unknown or blank subject', () => {
    expect(
      inheritFromSubject(catalog, 'Arte', blank, {
        teacher: false,
        color: false,
      }),
    ).toBeNull();
    expect(
      inheritFromSubject(catalog, '  ', blank, {
        teacher: false,
        color: false,
      }),
    ).toBeNull();
  });

  it('does not inherit an empty teacher or color over the form', () => {
    const bare = buildSubjectCatalog([cls('ARTE')]);
    expect(
      inheritFromSubject(
        bare,
        'arte',
        { teacher: 'X', color: '#FF453A' },
        {
          teacher: false,
          color: false,
        },
      ),
    ).toMatchObject({ teacher: 'X', color: '#FF453A', inherited: false });
  });
});
