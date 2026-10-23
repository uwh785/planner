import React from 'react';
import { ScrollView, View } from 'react-native';
import { LIST_COLORS } from '@/application/planner/listColors';
import { Button } from '../atoms/Button';
import { ColorDot } from '../atoms/ColorDot';
import { InlineMessage } from '../atoms/InlineMessage';
import { TextField } from '../atoms/TextField';
import { FormSection } from '../molecules/FormSection';
import { RadioGroup } from '../molecules/RadioGroup';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

export interface ListEditValues {
  name: string;
  color: string;
}

interface ListEditFormProps {
  values: ListEditValues;
  error: string | null;
  busy: boolean;
  onChange: (patch: Partial<ListEditValues>) => void;
  onSave: () => void;
  onDelete: () => void;
}

const makeStyles = (t: Theme) => ({
  content: { padding: t.spacing.lg, paddingBottom: t.spacing.xxl },
  actions: { gap: t.spacing.sm, marginTop: t.spacing.xs },
});

/** Rename, recolor and delete a list. Every color is shown with its name. */
export function ListEditForm({
  values,
  error,
  busy,
  onChange,
  onSave,
  onDelete,
}: ListEditFormProps) {
  const styles = useStyles(makeStyles);
  const t = useT();
  const known = LIST_COLORS.some(
    c => c.value.toLowerCase() === values.color.toLowerCase(),
  );
  const options = LIST_COLORS.map(c => ({
    value: c.value.toLowerCase(),
    label: t(`color${c.key}`),
    leading: <ColorDot color={c.value} />,
  }));
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <InlineMessage kind="error" message={error} />
      <TextField
        label={t('listName')}
        value={values.name}
        onChangeText={name => onChange({ name })}
        returnKeyType="done"
      />
      <FormSection title={t('listColor')}>
        <RadioGroup<string>
          value={values.color.toLowerCase()}
          onChange={color => {
            const match = LIST_COLORS.find(
              c => c.value.toLowerCase() === color,
            );
            onChange({ color: match?.value ?? color });
          }}
          options={
            known
              ? options
              : [
                  {
                    value: values.color.toLowerCase(),
                    label: t('colorCustom'),
                    leading: <ColorDot color={values.color} />,
                  },
                  ...options,
                ]
          }
        />
      </FormSection>
      <View style={styles.actions}>
        <Button
          label={t('save')}
          busyLabel={t('saving')}
          busy={busy}
          onPress={onSave}
        />
        <Button
          variant="destructive"
          label={t('listDeleteAction')}
          disabled={busy}
          onPress={onDelete}
        />
      </View>
    </ScrollView>
  );
}
