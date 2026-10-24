import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CalendarDays,
  LayoutDashboard,
  ListTodo,
  Settings,
} from '../atoms/icons';
import { useT } from '../../i18n/I18nProvider';
import type { TabParamList } from '../../navigation/routes';
import { useStyles, useTheme } from '../../theme';
import type { Theme } from '../../theme';

const ICONS = {
  Panel: LayoutDashboard,
  Tasks: ListTodo,
  Schedule: CalendarDays,
  Config: Settings,
} as const;

const LABEL = {
  Panel: 'navDashboard',
  Tasks: 'navTasks',
  Schedule: 'navSchedule',
  Config: 'navConfig',
} as const;

const makeStyles = (t: Theme) => ({
  bar: {
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
    backgroundColor: t.colors.surface,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  tab: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  pressed: { opacity: 0.8 },
  label: {
    ...t.typography.caption,
    color: t.colors.textMuted,
    textAlign: 'center' as const,
  },
  // The selected tab is told apart by weight and stroke, not by color alone.
  labelOn: { color: t.colors.accentText, fontWeight: '700' as const },
});

/**
 * The web's mobile bottom bar: an icon over a label for Panel, Tasks,
 * Schedule and Config, the accent on the selected one, clear of the system gesture area.
 * Every tab is at least 56dp tall and grows with the system font.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t('tabsLabel')}
      style={[styles.bar, { paddingBottom: insets.bottom }]}
    >
      {state.routes.map((route, index) => {
        const name = route.name as keyof TabParamList;
        const Icon = ICONS[name];
        const selected = state.index === index;
        const label = t(LABEL[name]);
        const color = selected ? colors.accentText : colors.textMuted;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            testID={`tab-${name}`}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!selected && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            }}
            onLongPress={() =>
              navigation.emit({ type: 'tabLongPress', target: route.key })
            }
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <Icon size={22} color={color} strokeWidth={selected ? 2.5 : 2} />
            <Text style={[styles.label, selected ? styles.labelOn : null]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
