import React from 'react';
import { Alert } from 'react-native';
import { render } from '@testing-library/react-native';
import { useDiscardGuard } from '@/presentation/hooks/useDiscardGuard';
import { withLocale } from '../helpers/i18n';

type Removal = { data: { action: { type: string } } };
const mockDispatch = jest.fn();
const mockPrevent: { dirty: boolean; callback: (e: Removal) => void } = {
  dirty: false,
  callback: () => undefined,
};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: mockDispatch }),
  usePreventRemove: (dirty: boolean, callback: (e: Removal) => void) => {
    mockPrevent.dirty = dirty;
    mockPrevent.callback = callback;
  },
}));

const removal: Removal = { data: { action: { type: 'GO_BACK' } } };
let guard: ReturnType<typeof useDiscardGuard>;
let alert: jest.SpyInstance;

function Probe({ dirty }: { dirty: boolean }) {
  guard = useDiscardGuard(dirty, 'task');
  return null;
}

async function mount(dirty = true) {
  const { Wrapper, ready } = withLocale('en');
  await ready;
  render(
    <Wrapper>
      <Probe dirty={dirty} />
    </Wrapper>,
  );
}
const buttons = () =>
  alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];

beforeEach(() => {
  mockDispatch.mockReset();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('useDiscardGuard', () => {
  it('guards only while there are unsaved edits', async () => {
    await mount(false);
    expect(mockPrevent.dirty).toBe(false);
  });

  it('asks on a dirty back: Keep editing leaves nothing dispatched', async () => {
    await mount();
    mockPrevent.callback(removal);
    expect(alert).toHaveBeenCalledWith(
      'Discard changes?',
      'Your edits to this task are not saved.',
      expect.any(Array),
    );
    expect(buttons().map(b => b.text)).toEqual(['Keep editing', 'Discard']);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('Discard lets the removal go through', async () => {
    await mount();
    mockPrevent.callback(removal);
    buttons()[1]!.onPress!();
    expect(mockDispatch).toHaveBeenCalledWith(removal.data.action);
  });

  it('leaving after a save goes through without asking', async () => {
    await mount();
    guard.leaveWith(() => mockPrevent.callback(removal));
    expect(alert).not.toHaveBeenCalled();
    expect(mockDispatch).toHaveBeenCalledWith(removal.data.action);
  });

  it('the permission lasts for that one navigation: the next back asks again', async () => {
    await mount();
    guard.leaveWith(() => mockPrevent.callback(removal));
    mockPrevent.callback(removal);
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('is withdrawn when the navigation throws, so later backs still ask', async () => {
    await mount();
    expect(() =>
      guard.leaveWith(() => {
        throw new Error('cannot go back');
      }),
    ).toThrow('cannot go back');
    mockPrevent.callback(removal);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('is withdrawn when the navigation never reached the guard (nothing was dirty)', async () => {
    await mount();
    guard.leaveWith(() => undefined);
    mockPrevent.callback(removal);
    expect(alert).toHaveBeenCalledTimes(1);
  });
});
