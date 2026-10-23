import React, { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { Frame } from '../components/atoms/Screen';
import { MessageView } from '../components/molecules/MessageView';
import { ScreenHeader } from '../components/molecules/ScreenHeader';
import {
  ListEditForm,
  type ListEditValues,
} from '../components/organisms/ListEditForm';
import { useDiscardGuard } from '../hooks/useDiscardGuard';
import type { ScreenProps } from '../navigation/routes';
import { errorSentence, useLiveQuery, usePlanner } from '../plannerContext';

/** Rename, recolor or delete one list. Explicit Save, confirmed Delete. */
export function ListEditScreen({ navigation, route }: ScreenProps<'ListEdit'>) {
  const { listId } = route.params;
  const planner = usePlanner();
  const loaded = useLiveQuery(p => p.queries.watchList(listId), [listId]);
  const [values, setValues] = useState<ListEditValues | null>(null);
  const initial = useRef<ListEditValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initial.current === null && loaded.status === 'ready' && loaded.data) {
      const seed = { name: loaded.data.name, color: loaded.data.color };
      initial.current = seed;
      setValues(seed);
    }
  }, [loaded]);

  const dirty =
    values !== null &&
    initial.current !== null &&
    (values.name !== initial.current.name ||
      values.color !== initial.current.color);
  const { allowLeaving } = useDiscardGuard(dirty, 'list');
  const goBack = () => navigation.goBack();

  if (loaded.status === 'ready' && loaded.data === null && !busy) {
    return (
      <MessageView
        title="This list no longer exists"
        body="It was deleted. Nothing is left to edit."
        action={{ label: 'Back', onPress: () => navigation.popToTop() }}
      />
    );
  }
  if (values === null) {
    return null;
  }

  async function save() {
    if (!dirty) {
      goBack();
      return;
    }
    setBusy(true);
    try {
      if (values!.name !== initial.current!.name) {
        await planner.lists.rename(listId, values!.name);
      }
      if (values!.color !== initial.current!.color) {
        await planner.lists.recolor(listId, values!.color);
      }
      allowLeaving();
      goBack();
    } catch (problem) {
      setError(errorSentence(problem));
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete this list?',
      'Its tasks stay and move out of any list.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await planner.lists.remove(listId);
              allowLeaving();
              navigation.popToTop();
            } catch (problem) {
              setError(errorSentence(problem));
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  return (
    <Frame>
      <ScreenHeader title="Edit list" onBack={goBack} />
      <ListEditForm
        values={values}
        error={error}
        busy={busy}
        onChange={patch => {
          setError(null);
          setValues(current => (current ? { ...current, ...patch } : current));
        }}
        onSave={save}
        onDelete={confirmDelete}
      />
    </Frame>
  );
}
