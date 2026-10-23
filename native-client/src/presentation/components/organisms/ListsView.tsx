import React from 'react';
import { FlatList } from 'react-native';
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
  allOpenCount: number;
  lists: readonly ListRowModel[];
  onOpenAll: () => void;
  onOpenList: (id: string) => void;
}

interface Item {
  key: string;
  name: string;
  color: string | null;
  openCount: number;
  onPress: () => void;
}

const makeStyles = (t: Theme) => ({
  content: { paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.lg },
});

/** "All tasks" and one row per list, in one grouped surface. */
export function ListsView({
  allOpenCount,
  lists,
  onOpenAll,
  onOpenList,
}: ListsViewProps) {
  const styles = useStyles(makeStyles);
  const items: Item[] = [
    {
      key: 'all',
      name: 'All tasks',
      color: null,
      openCount: allOpenCount,
      onPress: onOpenAll,
    },
    ...lists.map(list => ({
      key: list.id,
      name: list.name,
      color: list.color,
      openCount: list.openCount,
      onPress: () => onOpenList(list.id),
    })),
  ];
  return (
    <FlatList
      data={items}
      keyExtractor={item => item.key}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
      renderItem={({ item, index }) => (
        <ListRow
          name={item.name}
          color={item.color}
          openCount={item.openCount}
          position={groupPosition(index, items.length)}
          onPress={item.onPress}
        />
      )}
      ListFooterComponent={
        lists.length === 0 ? (
          <EmptyState
            title="No lists yet"
            body="Lists group your tasks. Add one above."
          />
        ) : undefined
      }
    />
  );
}
