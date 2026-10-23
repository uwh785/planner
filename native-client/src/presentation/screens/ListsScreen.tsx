import React from 'react';
import { Frame } from '../components/atoms/Screen';
import { InlineMessage } from '../components/atoms/InlineMessage';
import { Announcement } from '../components/molecules/Announcement';
import { QuickAddField } from '../components/molecules/QuickAddField';
import { ScreenHeader } from '../components/molecules/ScreenHeader';
import { ListsView } from '../components/organisms/ListsView';
import { errorSentence } from '../errorMessages';
import { useI18n } from '../i18n/I18nProvider';
import type { ScreenProps } from '../navigation/routes';
import { useLiveQuery, useNotice, usePlanner } from '../plannerContext';

/** List management (opened from Config): add a list, open one to edit it. Container. */
export function ListsScreen({ navigation }: ScreenProps<'Lists'>) {
  const { t } = useI18n();
  const planner = usePlanner();
  const overview = useLiveQuery(p => p.queries.watchOverview(), []);
  const notice = useNotice();
  const data = overview.status === 'loading' ? null : overview.data;

  async function addList(name: string): Promise<string | null> {
    try {
      await planner.lists.create(name);
      return null;
    } catch (error) {
      return errorSentence(error, t);
    }
  }

  return (
    <Frame>
      <ScreenHeader
        title={t('listsTitle')}
        onBack={() => navigation.goBack()}
      />
      <QuickAddField label={t('listQuickAdd')} onSubmit={addList} />
      <Announcement notice={notice} />
      {overview.status === 'error' && !data ? (
        <InlineMessage kind="error" message={t('listsLoadError')} />
      ) : null}
      {data ? (
        <ListsView
          lists={data.lists.map(({ list, openCount }) => ({
            id: list.id,
            name: list.name,
            color: list.color,
            openCount,
          }))}
          onOpenList={listId => navigation.navigate('ListEdit', { listId })}
        />
      ) : null}
    </Frame>
  );
}
