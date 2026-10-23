import React from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import {
  TaskCard,
  type TaskCardModel,
} from '@/presentation/components/molecules/TaskCard';
import { darkTheme, lightTheme } from '@/presentation/theme';
import { withLocale } from '../helpers/i18n';
import type { Locale } from '@/application/i18n';

// The scheme is read through React Native's hook; this lets a test pick it.
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
const scheme = useColorScheme as unknown as jest.Mock;
beforeEach(() => scheme.mockReturnValue('light'));

const model = (patch: Partial<TaskCardModel> = {}): TaskCardModel => ({
  id: 'tsk_1',
  title: 'Prepare slides',
  description: '',
  priority: 0,
  status: 'pending',
  due: null,
  timer: null,
  ...patch,
});

async function show(
  task: TaskCardModel,
  props: Partial<React.ComponentProps<typeof TaskCard>> = {},
  locale: Locale = 'en',
) {
  const { Wrapper, ready } = withLocale(locale);
  await ready;
  const onOpen = jest.fn();
  render(
    <Wrapper>
      <TaskCard task={task} onOpen={onOpen} {...props} />
    </Wrapper>,
  );
  return { onOpen };
}
const edge = () =>
  StyleSheet.flatten(screen.getByTestId('task-card-tsk_1').props.style);

afterEach(() => jest.restoreAllMocks());

describe('task card anatomy', () => {
  it('shows the title, a status marker and nothing else for a bare task', async () => {
    await show(model());
    expect(screen.getByText('Prepare slides')).toBeTruthy();
    expect(
      screen.getByTestId('status-dot-pending', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(screen.queryByTestId('timer-box')).toBeNull();
    expect(screen.queryByText('High')).toBeNull();
  });

  it('draws the status marker by shape: hollow, filled, filled and muted', async () => {
    for (const status of ['pending', 'in_progress', 'completed'] as const) {
      await show(model({ status }));
      const dot = StyleSheet.flatten(
        screen.getByTestId(`status-dot-${status}`, {
          includeHiddenElements: true,
        }).props.style,
      );
      if (status === 'pending') {
        expect(dot).toMatchObject({ borderWidth: 2 });
        expect(dot).not.toHaveProperty('backgroundColor');
      } else {
        expect(dot).toHaveProperty('backgroundColor');
      }
      screen.unmount();
    }
  });

  it.each([
    [1, 'Low'],
    [2, 'Medium'],
    [3, 'High'],
  ] as const)(
    'writes priority %d as the word %s in the text color',
    async (priority, word) => {
      await show(model({ priority }));
      const label = screen.getByText(word);
      expect(StyleSheet.flatten(label.props.style).color).toBe(
        lightTheme.colors.text,
      );
      // The flag icon is decorative; the word carries the meaning.
      expect(
        screen.getByText(word).parent?.findAll(() => true).length,
      ).toBeGreaterThan(0);
    },
  );

  it('translates the priority word', async () => {
    await show(model({ priority: 3 }), {}, 'es');
    expect(screen.getByText('Alta')).toBeTruthy();
    expect(screen.queryByText('3')).toBeNull();
  });

  it('shows the due line, overdue in the danger color and bold, with its words', async () => {
    await show(model({ due: { text: 'Overdue, Oct 20', overdue: true } }));
    const due = screen.getByText('Overdue, Oct 20');
    expect(StyleSheet.flatten(due.props.style)).toMatchObject({
      color: lightTheme.colors.danger,
      fontWeight: '600',
    });
  });

  it('keeps long descriptions to two lines and lets the title wrap', async () => {
    await show(model({ description: 'Long '.repeat(80) }));
    expect(screen.getByText(/Long Long/).props.numberOfLines).toBe(2);
    expect(
      screen.getByText('Prepare slides').props.numberOfLines,
    ).toBeUndefined();
  });

  it('strikes a completed title through and mutes it', async () => {
    await show(model({ status: 'completed' }));
    expect(
      StyleSheet.flatten(screen.getByText('Prepare slides').props.style),
    ).toMatchObject({
      textDecorationLine: 'line-through',
      color: lightTheme.colors.textMuted,
    });
  });
});

describe('active-card emphasis', () => {
  it('in progress: a full 1dp accent border all around (no side stripe)', async () => {
    await show(model({ status: 'in_progress' }));
    expect(edge()).toMatchObject({
      borderWidth: 1,
      borderColor: lightTheme.colors.accent,
    });
    for (const side of ['Left', 'Right', 'Top', 'Bottom']) {
      expect(edge()).not.toHaveProperty(`border${side}Width`);
    }
  });

  it('overdue: a full danger border; in progress wins when both apply, as on the web', async () => {
    await show(model({ due: { text: 'x', overdue: true } }));
    expect(edge()).toMatchObject({ borderColor: lightTheme.colors.danger });
    screen.unmount();
    await show(
      model({ status: 'in_progress', due: { text: 'x', overdue: true } }),
    );
    expect(edge()).toMatchObject({ borderColor: lightTheme.colors.accent });
  });

  it('takes the dark palette in dark mode', async () => {
    scheme.mockReturnValue('dark');
    await show(model({ status: 'in_progress' }));
    expect(edge()).toMatchObject({ borderColor: darkTheme.colors.accent });
  });
});

describe('remaining-time box', () => {
  const timer = (progress: number, remainingMs: number) => ({
    progress,
    remainingMs,
  });

  it('shows the label, the time and the ring, as one spoken unit', async () => {
    await show(
      model({ status: 'in_progress', timer: timer(0.01, 118 * 60_000) }),
    );
    const box = screen.getByTestId('timer-box');
    expect(box.props.accessibilityLabel).toBe('1 h 58 min left');
    expect(within(box).getByText('Time left')).toBeTruthy();
    expect(within(box).getByText('1 h 58 min')).toBeTruthy();
  });

  it('says Completed for a completed task and Time over when used up', async () => {
    await show(model({ status: 'completed', timer: timer(1, 0) }));
    expect(screen.getByTestId('timer-box').props.accessibilityLabel).toBe(
      'Completed',
    );
    screen.unmount();
    await show(model({ status: 'in_progress', timer: timer(1, 0) }));
    expect(screen.getByTestId('timer-box').props.accessibilityLabel).toBe(
      'Time over',
    );
  });

  it('puts only primary text on Surface 2 (the box background)', async () => {
    await show(model({ status: 'in_progress', timer: timer(0.5, 3_600_000) }));
    const box = screen.getByTestId('timer-box');
    expect(StyleSheet.flatten(box.props.style).backgroundColor).toBe(
      lightTheme.colors.surface2,
    );
    expect(
      StyleSheet.flatten(within(box).getByText('Time left').props.style).color,
    ).toBe(lightTheme.colors.text);
  });
});

describe('actions', () => {
  it('opens the task when the body is pressed', async () => {
    const { onOpen } = await show(model());
    fireEvent.press(screen.getByRole('button', { name: /^Prepare slides/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('speaks the whole card: title, status, due, priority and time left', async () => {
    await show(
      model({
        status: 'in_progress',
        priority: 3,
        due: { text: 'Today, 14:30', overdue: false },
        timer: { progress: 0.5, remainingMs: 3_600_000 },
      }),
    );
    expect(
      screen.getByRole('button', { name: /^Prepare slides/ }).props
        .accessibilityLabel,
    ).toBe(
      'Prepare slides, In progress, Today, 14:30, high priority, 1 h left',
    );
  });

  it('offers Complete only when asked and the task is open', async () => {
    await show(model());
    expect(screen.queryByRole('button', { name: /Complete/ })).toBeNull();
    screen.unmount();
    const onComplete = jest.fn();
    await show(model(), { onComplete });
    fireEvent.press(
      screen.getByRole('button', { name: 'Complete Prepare slides' }),
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
    screen.unmount();
    await show(model({ status: 'completed' }), { onComplete });
    expect(screen.queryByRole('button', { name: /^Complete / })).toBeNull();
  });

  it('while completing: shows Completed and Undo instead of Complete', async () => {
    const onUndo = jest.fn();
    await show(model(), { completing: true, onComplete: jest.fn(), onUndo });
    expect(screen.queryByRole('button', { name: /^Complete / })).toBeNull();
    expect(screen.getByText('Completed')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('speaks Spanish with the web words', async () => {
    await show(
      model({ status: 'in_progress', priority: 2 }),
      { onComplete: jest.fn() },
      'es',
    );
    expect(screen.getByText('Media')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Completar Prepare slides' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /^Prepare slides/ }).props
        .accessibilityLabel,
    ).toBe('Prepare slides, En progreso, Prioridad media');
  });
});
