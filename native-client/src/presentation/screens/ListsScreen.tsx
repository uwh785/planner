import React from 'react';
import { Frame } from '../components/atoms/Screen';
import { InlineMessage } from '../components/atoms/InlineMessage';
import { Announcement } from '../components/molecules/Announcement';
import { QuickAddField } from '../components/molecules/QuickAddField';
import { ScreenHeader } from '../components/molecules/ScreenHeader';
import { ListsView } from '../components/organisms/ListsView';
import type { ScreenProps } from '../navigation/routes';
import {
  errorSentence,
  useLiveQuery,
  useNotice,
  usePlanner,
} from '../plannerContext';
import { SyncStatusLine } from './SyncStatusLine';

/** Home: all tasks and the lists with their open counts. Container. */
export function ListsScreen({ navigation }: ScreenProps<'Lists'>) {
  const planner = usePlanner();
  const overview = useLiveQuery(p => p.queries.watchOverview(), []);
  const notice = useNotice();
  const data = overview.status === 'loading' ? null : overview.data;

  async function addList(name: string): Promise<string | null> {
    try {
      await planner.lists.create(name);
      return null;
    } catch (error) {
      return errorSentence(error);
    }
  }

  return (
    <Frame>
      <ScreenHeader
        title="Lists"
        actions={[
          { label: 'Account', onPress: () => navigation.navigate('Account') },
        ]}
      />
      <QuickAddField label="Add a list" onSubmit={addList} />
      <Announcement notice={notice} />
      {overview.status === 'error' && !data ? (
        <InlineMessage kind="error" message="Couldn't read your lists." />
      ) : null}
      {data ? (
        <ListsView
          allOpenCount={data.allOpenCount}
          lists={data.lists.map(({ list, openCount }) => ({
            id: list.id,
            name: list.name,
            color: list.color,
            openCount,
          }))}
          onOpenAll={() => navigation.navigate('Tasks')}
          onOpenList={listId => navigation.navigate('Tasks', { listId })}
        />
      ) : null}
      <SyncStatusLine />
    </Frame>
  );
}
