import React from 'react';
import { Frame } from '../components/atoms/Screen';
import { InlineMessage } from '../components/atoms/InlineMessage';
import { ScreenHeader } from '../components/molecules/ScreenHeader';
import { PanelView } from '../components/organisms/PanelView';
import { taskCardModel } from '../format/taskCardModel';
import { useI18n } from '../i18n/I18nProvider';
import type { TabScreenProps } from '../navigation/routes';
import { useFlushCompletionOnLeave } from '../hooks/useFlushCompletionOnLeave';
import {
  useCompleting,
  useLiveQuery,
  useNotice,
  useNow,
  usePlanner,
} from '../plannerContext';
import { SyncStatusLine } from './SyncStatusLine';

/** The overdue counter and the time left age with the clock, not with data. */
const REFRESH_MS = 30_000;

/** Panel: the four counters and the active tasks. Container. */
export function PanelScreen({ navigation }: TabScreenProps<'Panel'>) {
  const i18n = useI18n();
  const { t } = i18n;
  const planner = usePlanner();
  const completing = useCompleting();
  const dashboard = useLiveQuery(p => p.queries.watchDashboard(), [], 60_000);
  const now = useNow(REFRESH_MS);
  const notice = useNotice();
  useFlushCompletionOnLeave();
  const data = dashboard.status === 'loading' ? null : dashboard.data;
  const header = <ScreenHeader title={t('dashboardTitle')} />;

  return (
    <Frame>
      {data ? (
        <PanelView
          header={header}
          counts={data.counts}
          active={data.active.map(task => taskCardModel(task, now, i18n))}
          notice={notice}
          completing={completing}
          onOpenTask={taskId => navigation.navigate('TaskDetail', { taskId })}
          onStartTask={id => {
            planner.taskTimer.start(id);
          }}
          onPauseTask={id => {
            planner.taskTimer.pause(id);
          }}
          onCompleteTask={id => {
            const task = data.active.find(candidate => candidate.id === id);
            if (task) {
              planner.completion.begin(task);
            }
          }}
          onUndo={id => planner.completion.undo(id)}
          footer={<SyncStatusLine />}
        />
      ) : (
        <>
          {header}
          {dashboard.status === 'error' ? (
            <InlineMessage kind="error" message={t('dashboardLoadError')} />
          ) : null}
        </>
      )}
    </Frame>
  );
}
