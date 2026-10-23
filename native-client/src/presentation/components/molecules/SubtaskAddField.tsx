import React from 'react';
import { useT } from '../../i18n/I18nProvider';
import { QuickAddField } from './QuickAddField';

/**
 * The web's "New subtask" form: a labeled field that adds on the keyboard's
 * action key or the Add link, clears itself and shows a refusal as the field
 * error. Resolves to an error sentence, or null when it worked.
 */
export function SubtaskAddField({
  onSubmit,
}: {
  onSubmit: (title: string) => Promise<string | null>;
}) {
  const t = useT();
  return (
    <QuickAddField
      label={t('taskSubtaskNew')}
      onSubmit={onSubmit}
      inset={false}
    />
  );
}
