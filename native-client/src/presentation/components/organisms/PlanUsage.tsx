import React from 'react';
import { Linking, Text, View } from 'react-native';
import type { MessageKey } from '@/application/i18n';
import { isAtLimit, UNLIMITED } from '@/domain';
import type { PlanResource, PlanSummary } from '@/domain';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';
import { Button } from '../atoms/Button';
import { GroupedRow, groupPosition } from '../atoms/GroupedRow';
import { FormSection } from '../molecules/FormSection';

const LABELS: Record<PlanResource, MessageKey> = {
  tasks: 'planResourceTasks',
  lists: 'planResourceLists',
  tags: 'planResourceTags',
};

const makeStyles = (t: Theme) => ({
  badge: { ...t.typography.callout, color: t.colors.text },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
  },
  label: { ...t.typography.body, color: t.colors.text, flexShrink: 1 },
  value: { ...t.typography.callout, color: t.colors.textMuted },
  full: { color: t.colors.danger },
  hint: {
    ...t.typography.caption,
    color: t.colors.textMuted,
    paddingHorizontal: t.spacing.md,
    paddingBottom: t.spacing.sm,
  },
  upgrade: { marginTop: t.spacing.sm },
});

/** The web's "Your plan": badge, usage of each capped resource, link to Pro. */
export function PlanUsage({
  summary,
  upgradeUrl,
}: {
  summary: PlanSummary;
  upgradeUrl: string;
}) {
  const t = useT();
  const styles = useStyles(makeStyles);
  return (
    <FormSection title={t('planUsageTitle')}>
      <Text style={styles.badge}>
        {summary.plan === 'pro' ? t('planBadgePro') : t('planBadgeFree')}
      </Text>
      <View>
        {summary.lines.map((line, index) => {
          const unlimited = line.limit === UNLIMITED;
          const value = unlimited
            ? `${line.used} · ${t('planUnlimited')}`
            : `${line.used} / ${line.limit}`;
          const full = isAtLimit(line);
          return (
            <GroupedRow
              key={line.resource}
              position={groupPosition(index, summary.lines.length)}
            >
              <View
                accessible
                accessibilityLabel={`${t(LABELS[line.resource])}: ${value}`}
                style={styles.row}
              >
                <Text style={styles.label}>{t(LABELS[line.resource])}</Text>
                <Text style={[styles.value, full ? styles.full : null]}>
                  {value}
                </Text>
              </View>
              {full ? (
                <Text style={styles.hint}>
                  {t('planAtLimitHint', { n: line.limit })}
                </Text>
              ) : null}
            </GroupedRow>
          );
        })}
      </View>
      {summary.plan === 'pro' ? null : (
        <View style={styles.upgrade}>
          <Button
            variant="secondary"
            label={t('planUpgradeCta')}
            onPress={() => {
              Linking.openURL(upgradeUrl).catch(() => undefined);
            }}
          />
        </View>
      )}
    </FormSection>
  );
}
