import React from 'react';
import { FlatList } from 'react-native';
import { useT } from '../../i18n/I18nProvider';
import { groupPosition } from '../atoms/GroupedRow';
import { EmptyState } from '../molecules/EmptyState';
import { ListRow } from '../molecules/ListRow';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

export interface ListRowModel {
  id: string;
  name: string;
  color: string;
  openCount: number;
}

interface ListsViewProps {
  lists: readonly ListRowModel[];
  onOpenList: (id: string) => void;
}

const makeStyles = (t: Theme) => ({
  content: { paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.lg },
});

/** One row per list, in one grouped surface; a row opens its edit screen. */
export function ListsView({ lists, onOpenList }: ListsViewProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  return (
    <FlatList
      data={lists}
      keyExtractor={list => list.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
      renderItem={({ item, index }) => (
        <ListRow
          name={item.name}
          color={item.color}
          openCount={item.openCount}
          position={groupPosition(index, lists.length)}
          onPress={() => onOpenList(item.id)}
        />
      )}
      ListFooterComponent={
        lists.length === 0 ? (
          <EmptyState title={t('listsEmptyTitle')} body={t('listsEmptyBody')} />
        ) : undefined
      }
    />
  );
}
