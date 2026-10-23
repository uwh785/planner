import { StyleSheet } from 'react-native';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import { SyncStatus } from '@/application/sync/SyncStatus';
import { flushAsync } from '../helpers/plannerWorld';
import { renderSignedIn } from '../helpers/renderApp';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const settle = () => act(async () => flushAsync());

describe('lists home', () => {
  it('shows the empty state and the all-tasks row on a fresh account', async () => {
    await renderSignedIn();
    expect(
      screen.getByRole('button', { name: 'All tasks, no open tasks' }),
    ).toBeTruthy();
    expect(screen.getByText('No lists yet')).toBeTruthy();
    expect(
      screen.getByText('Lists group your tasks. Add one above.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Add a list')).toBeTruthy();
    expect(screen.queryByText('Planner')).toBeNull();
    expect(screen.queryByRole('button', { name: /sample task/i })).toBeNull();
  });

  it('quick adds a list with the keyboard action and shows it with its count', async () => {
    const { world } = await renderSignedIn();
    const field = screen.getByLabelText('Add a list');
    expect(field.props.returnKeyType).toBe('done');
    fireEvent.changeText(field, '  Home ');
    fireEvent(field, 'submitEditing');
    expect(
      await screen.findByRole('button', { name: 'Home, no open tasks' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Add a list').props.value).toBe('');
    expect(screen.queryByText('No lists yet')).toBeNull();
    expect((await world.taskLists.list()).map(l => l.name)).toEqual(['Home']);
    expect(await world.outbox.pendingCount()).toBe(1);
    expect(screen.getByText('Added list Home')).toBeTruthy();
  });

  it('adds with the Add button too, and refuses a blank name with a message', async () => {
    await renderSignedIn();
    const field = screen.getByLabelText('Add a list');
    fireEvent.changeText(field, 'Work');
    fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(
      await screen.findByRole('button', { name: 'Work, no open tasks' }),
    ).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Add a list'), '   ');
    fireEvent(screen.getByLabelText('Add a list'), 'submitEditing');
    expect(await screen.findByText('Name is required')).toBeTruthy();
  });

  it('counts open tasks per list and for all tasks, and follows changes', async () => {
    const { world } = await renderSignedIn();
    const list = await world.taskLists.create({ name: 'Home' });
    await world.tasks.create({ title: 'a', listId: list.id });
    await world.tasks.create({ title: 'b' });
    expect(
      await screen.findByRole('button', { name: 'Home, 1 open task' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'All tasks, 2 open tasks' }),
    ).toBeTruthy();
    expect(
      within(
        screen.getByRole('button', { name: 'Home, 1 open task' }),
      ).getByText('1 open'),
    ).toBeTruthy();
  });

  it('shows the list color as a marker next to its name, never alone', async () => {
    const { world } = await renderSignedIn();
    await world.taskLists.create({ name: 'Home', color: '#30D158' });
    const row = await screen.findByRole('button', {
      name: 'Home, no open tasks',
    });
    expect(within(row).getByText('Home')).toBeTruthy();
    expect(
      StyleSheet.flatten(
        within(row).getByTestId('color-marker', { includeHiddenElements: true })
          .props.style,
      ),
    ).toMatchObject({ backgroundColor: '#30D158' });
  });

  it('shows the discreet sync status line', async () => {
    const sync = new SyncStatus();
    sync.update({ phase: 'offline', pendingCount: 2 });
    await renderSignedIn({ sync });
    const line = screen.getByText('Offline. 2 changes waiting.');
    expect(line.props.accessibilityLiveRegion).toBe('polite');
  });

  it('opens the all-tasks screen, a list, and the account', async () => {
    const { world } = await renderSignedIn();
    await world.taskLists.create({ name: 'Home' });
    fireEvent.press(
      await screen.findByRole('button', { name: 'Home, no open tasks' }),
    );
    expect(await screen.findByRole('header', { name: 'Home' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    fireEvent.press(
      await screen.findByRole('button', { name: 'All tasks, no open tasks' }),
    );
    expect(
      await screen.findByRole('header', { name: 'All tasks' }),
    ).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Account' }));
    expect(await screen.findByRole('header', { name: 'Account' })).toBeTruthy();
  });

  it('marks the title as a header and lets the rows wrap at large text', async () => {
    const { world } = await renderSignedIn();
    await world.taskLists.create({
      name: 'A very long list name that must wrap instead of clipping at large font sizes',
    });
    await settle();
    await waitFor(() =>
      expect(
        screen.getByText(/A very long list name/).props.numberOfLines,
      ).toBeUndefined(),
    );
    expect(screen.getByRole('header', { name: 'Lists' })).toBeTruthy();
  });
});
