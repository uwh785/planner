import { StyleSheet } from 'react-native';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import { flushAsync } from '../helpers/plannerWorld';
import { renderSignedIn } from '../helpers/renderApp';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const settle = () => act(async () => flushAsync());

async function openLists() {
  fireEvent.press(await screen.findByRole('tab', { name: 'Settings' }));
  fireEvent.press(await screen.findByRole('button', { name: /^Lists/ }));
  await screen.findByRole('header', { name: 'Lists' });
}

describe('list management (opened from Settings)', () => {
  it('shows the empty state on a fresh account, without an "All tasks" row', async () => {
    await renderSignedIn();
    await openLists();
    expect(screen.getByText('No lists yet')).toBeTruthy();
    expect(
      screen.getByText('Lists group your tasks. Add one above.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Add a list')).toBeTruthy();
    expect(screen.queryByText(/All tasks/)).toBeNull();
  });

  it('quick adds a list with the keyboard action and shows it with its count', async () => {
    const { world } = await renderSignedIn();
    await openLists();
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
    await openLists();
    fireEvent.changeText(screen.getByLabelText('Add a list'), 'Work');
    fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(
      await screen.findByRole('button', { name: 'Work, no open tasks' }),
    ).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Add a list'), '   ');
    fireEvent(screen.getByLabelText('Add a list'), 'submitEditing');
    expect(await screen.findByText('Name is required')).toBeTruthy();
  });

  it('counts open tasks per list and follows changes', async () => {
    const { world } = await renderSignedIn();
    const list = await world.taskLists.create({ name: 'Home' });
    await openLists();
    await world.tasks.create({ title: 'a', listId: list.id });
    expect(
      await screen.findByRole('button', { name: 'Home, 1 open task' }),
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
    await openLists();
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

  it('goes back to Settings', async () => {
    await renderSignedIn();
    await openLists();
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(
      await screen.findByRole('header', { name: 'Settings' }),
    ).toBeTruthy();
  });

  it('marks the title as a header and lets the rows wrap at large text', async () => {
    const { world } = await renderSignedIn();
    await world.taskLists.create({
      name: 'A very long list name that must wrap instead of clipping at large font sizes',
    });
    await openLists();
    await waitFor(() =>
      expect(
        screen.getByText(/A very long list name/).props.numberOfLines,
      ).toBeUndefined(),
    );
    expect(screen.getByRole('header', { name: 'Lists' })).toBeTruthy();
  });

  it('words everything in Spanish', async () => {
    await renderSignedIn({ locale: 'es' });
    fireEvent.press(await screen.findByRole('tab', { name: 'Config' }));
    fireEvent.press(await screen.findByRole('button', { name: /^Listas/ }));
    expect(await screen.findByRole('header', { name: 'Listas' })).toBeTruthy();
    expect(screen.getByText('Aún no hay listas')).toBeTruthy();
    expect(screen.getByLabelText('Agregar una lista')).toBeTruthy();
  });
});

describe('editing a list', () => {
  it('renames, recolors and deletes the list from its edit screen', async () => {
    const env = await renderSignedIn();
    const list = await env.world.taskLists.create({ name: 'Old' });
    const task = await env.world.tasks.create({
      title: 'inside',
      listId: list.id,
    });
    await openLists();
    fireEvent.press(await screen.findByRole('button', { name: /^Old/ }));
    expect(
      await screen.findByRole('header', { name: 'Edit list' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Name').props.value).toBe('Old');
    fireEvent.changeText(screen.getByLabelText('Name'), 'New name');
    fireEvent.press(screen.getByRole('radio', { name: 'Green' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('header', { name: 'Lists' });
    expect(await env.world.taskLists.get(list.id)).toMatchObject({
      name: 'New name',
      color: '#30D158',
    });

    fireEvent.press(await screen.findByRole('button', { name: /^New name/ }));
    await screen.findByRole('header', { name: 'Edit list' });
    const alert = jest.spyOn(require('react-native').Alert, 'alert');
    fireEvent.press(screen.getByRole('button', { name: 'Delete list' }));
    expect(alert).toHaveBeenCalledWith(
      'Delete this list?',
      'Its tasks stay and move out of any list.',
      expect.any(Array),
    );
    const buttons = alert.mock.calls[0]![2] as {
      text: string;
      onPress?: () => void;
    }[];
    expect(buttons.map(b => b.text)).toEqual(['Cancel', 'Delete']);
    expect(await env.world.taskLists.get(list.id)).not.toBeNull();
    await act(async () => buttons[1]!.onPress!());
    await screen.findByRole('header', { name: 'Lists' });
    await settle();
    expect(await env.world.taskLists.get(list.id)).toBeNull();
    expect((await env.world.tasks.get(task.id))?.listId).toBeNull();
    expect(screen.getByText('Deleted list New name')).toBeTruthy();
  });

  it('names the colors and the confirm dialog in Spanish', async () => {
    const env = await renderSignedIn({ locale: 'es' });
    const list = await env.world.taskLists.create({ name: 'Casa' });
    fireEvent.press(await screen.findByRole('tab', { name: 'Config' }));
    fireEvent.press(await screen.findByRole('button', { name: /^Listas/ }));
    fireEvent.press(await screen.findByRole('button', { name: /^Casa/ }));
    await screen.findByRole('header', { name: 'Editar lista' });
    expect(screen.getByRole('radio', { name: 'Verde' })).toBeTruthy();
    const alert = jest.spyOn(require('react-native').Alert, 'alert');
    fireEvent.press(screen.getByRole('button', { name: 'Eliminar lista' }));
    expect(alert).toHaveBeenCalledWith(
      '¿Eliminar esta lista?',
      'Sus tareas se quedan y salen de cualquier lista.',
      expect.any(Array),
    );
    expect(list.id).toBeTruthy();
  });
});
