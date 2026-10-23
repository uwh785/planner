import React from 'react';
import {
  processColor,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CountdownRing } from '@/presentation/components/atoms/CountdownRing';
import { IconButton } from '@/presentation/components/atoms/IconButton';
import { Pencil } from '@/presentation/components/atoms/icons';
import { TimerButton } from '@/presentation/components/atoms/TimerButton';
import { DetailHeader } from '@/presentation/components/molecules/DetailHeader';
import { InfoPair } from '@/presentation/components/molecules/InfoPair';
import { SubtaskAddField } from '@/presentation/components/molecules/SubtaskAddField';
import { SubtaskRow } from '@/presentation/components/molecules/SubtaskRow';
import { TimerActions } from '@/presentation/components/molecules/TimerActions';
import { TimerBox } from '@/presentation/components/molecules/TimerBox';
import { UndoBar } from '@/presentation/components/molecules/UndoBar';
import { darkTheme, lightTheme } from '@/presentation/theme';
import type { Locale } from '@/application/i18n';
import { withLocale } from '../helpers/i18n';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));
const scheme = useColorScheme as unknown as jest.Mock;
const dimensions = useWindowDimensions as unknown as jest.Mock;
const withFontScale = (fontScale: number) =>
  dimensions.mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
beforeEach(() => {
  scheme.mockReturnValue('light');
  withFontScale(1);
});
afterEach(() => jest.restoreAllMocks());

async function show(ui: React.ReactElement, locale: Locale = 'en') {
  const { Wrapper, ready } = withLocale(locale);
  await ready;
  return render(<Wrapper>{ui}</Wrapper>);
}
const flat = (node: { props: { style?: unknown } }) =>
  StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
const colorOf = (circle: { props: Record<string, unknown> }) =>
  (circle.props.stroke as { payload: number }).payload;
const ring = () =>
  screen.getByTestId('countdown-ring', { includeHiddenElements: true });
const circles = () =>
  ring().findAll(node => (node.type as unknown) === 'RNSVGCircle', {
    deep: true,
  });

describe('CountdownRing, large variant', () => {
  it('is twice the size of the card ring with a thicker stroke, same arc rules', async () => {
    await show(
      <CountdownRing size="large" progress={0.25} status="in_progress" />,
    );
    expect(flat(ring())).toMatchObject({ width: 80, height: 80 });
    const radius = (80 - 6) / 2;
    expect(circles()[1]!.props.strokeDashoffset).toBeCloseTo(
      2 * Math.PI * radius * 0.75,
      5,
    );
    expect(circles()[1]!.props.strokeWidth).toBe(6);
  });

  it('keeps the compact size by default', async () => {
    await show(<CountdownRing progress={0.5} status="in_progress" />);
    expect(flat(ring())).toMatchObject({ width: 40, height: 40 });
  });

  it('grows with the system font up to 1.5 times, so the percent never spills out', async () => {
    withFontScale(1.5);
    await show(
      <CountdownRing size="large" progress={0.5} status="in_progress" />,
    );
    expect(flat(ring())).toMatchObject({ width: 120, height: 120 });
    screen.unmount();
    withFontScale(2);
    await show(
      <CountdownRing size="large" progress={0.5} status="in_progress" />,
    );
    expect(flat(ring())).toMatchObject({ width: 120, height: 120 });
  });

  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)(
    'uses the %s AA-safe ring colors on the detail card',
    async (name, theme) => {
      scheme.mockReturnValue(name);
      await show(
        <CountdownRing size="large" progress={0.8} status="in_progress" />,
      );
      expect(colorOf(circles()[1]!)).toBe(
        processColor(theme.colors.ring.danger),
      );
      expect(colorOf(circles()[0]!)).toBe(
        processColor(theme.colors.ring.track),
      );
    },
  );

  it('shows a check once completed and stays hidden from screen readers', async () => {
    await show(<CountdownRing size="large" progress={1} status="completed" />);
    expect(
      screen.queryByText('100%', { includeHiddenElements: true }),
    ).toBeNull();
    expect(ring().props.importantForAccessibility).toBe('no-hide-descendants');
  });
});

describe('TimerBox, card variant (the detail screen)', () => {
  const model = { progress: 0.4, remainingMs: 72 * 60_000 };

  it('is one spoken unit with the text equivalent of the ring', async () => {
    await show(<TimerBox variant="card" status="in_progress" timer={model} />);
    const box = screen.getByTestId('timer-box');
    expect(box.props.accessible).toBe(true);
    expect(box.props.accessibilityLabel).toBe(
      'Time left: 1 h 12 min. 40% of the time used',
    );
  });

  it('writes the time left in the text color, big, beside the large ring', async () => {
    await show(<TimerBox variant="card" status="pending" timer={model} />);
    expect(screen.getByText('Time left')).toBeTruthy();
    expect(screen.getByText('1 h 12 min')).toBeTruthy();
    expect(flat(ring())).toMatchObject({ width: 80 });
  });

  it('counts the last minute in seconds', async () => {
    await show(
      <TimerBox
        variant="card"
        status="in_progress"
        timer={{ progress: 0.99, remainingMs: 42_500 }}
      />,
    );
    expect(screen.getByText('42 s')).toBeTruthy();
  });

  it('says Time over past the duration and Completed when done', async () => {
    await show(
      <TimerBox
        variant="card"
        status="in_progress"
        timer={{ progress: 1, remainingMs: 0 }}
      />,
    );
    expect(screen.getByText('Time over')).toBeTruthy();
    screen.unmount();
    await show(
      <TimerBox
        variant="card"
        status="completed"
        timer={{ progress: 1, remainingMs: 0 }}
      />,
    );
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getByTestId('timer-box').props.accessibilityLabel).toBe(
      'Completed',
    );
  });

  it('sits on the card surface with a hairline, not on Surface 2', async () => {
    await show(<TimerBox variant="card" status="pending" timer={model} />);
    expect(flat(screen.getByTestId('timer-box'))).toMatchObject({
      backgroundColor: lightTheme.colors.surface,
      borderColor: lightTheme.colors.border,
    });
  });

  it('keeps the inline variant of the task card unchanged', async () => {
    await show(<TimerBox status="pending" timer={model} />);
    expect(flat(screen.getByTestId('timer-box'))).toMatchObject({
      backgroundColor: lightTheme.colors.surface2,
    });
  });
});

describe('TimerButton', () => {
  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)(
    'filled pause and complete use the %s AA fills and labels',
    async (name, theme) => {
      scheme.mockReturnValue(name);
      await show(
        <>
          <TimerButton tone="pause" label="Pause" onPress={jest.fn()} />
          <TimerButton tone="complete" label="Complete" onPress={jest.fn()} />
          <TimerButton tone="start" label="Start" onPress={jest.fn()} />
        </>,
      );
      const style = (label: string) =>
        flat(screen.getByRole('button', { name: label }));
      expect(style('Pause')).toMatchObject({
        backgroundColor: theme.colors.action.pause,
      });
      expect(style('Complete')).toMatchObject({
        backgroundColor: theme.colors.action.complete,
      });
      expect(style('Start')).toMatchObject({
        backgroundColor: theme.colors.primary,
      });
      const label = (text: string) => flat(screen.getByText(text));
      expect(label('Pause').color).toBe(theme.colors.action.onPause);
      expect(label('Complete').color).toBe(theme.colors.action.onComplete);
      expect(label('Start').color).toBe(theme.colors.onPrimary);
    },
  );

  it('outlined takes the color for the border and the label on the surface', async () => {
    await show(
      <TimerButton
        tone="pause"
        variant="outlined"
        label="Pause"
        onPress={jest.fn()}
      />,
    );
    expect(flat(screen.getByRole('button', { name: 'Pause' }))).toMatchObject({
      borderColor: lightTheme.colors.action.pause,
      borderWidth: 1,
      backgroundColor: lightTheme.colors.surface,
    });
    expect(flat(screen.getByText('Pause')).color).toBe(
      lightTheme.colors.action.pause,
    );
  });

  it('is at least 48dp and ignores presses while disabled', async () => {
    const onPress = jest.fn();
    await show(
      <TimerButton tone="start" label="Start" onPress={onPress} disabled />,
    );
    const button = screen.getByRole('button', { name: 'Start' });
    expect(flat(button).minHeight).toBeGreaterThanOrEqual(48);
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('TimerActions', () => {
  const handlers = () => ({
    onStart: jest.fn(),
    onPause: jest.fn(),
    onComplete: jest.fn(),
  });

  it('offers Start and Complete for a pending task, with the title in the spoken names', async () => {
    const h = handlers();
    await show(<TimerActions status="pending" title="Write report" {...h} />);
    fireEvent.press(screen.getByRole('button', { name: 'Start Write report' }));
    fireEvent.press(
      screen.getByRole('button', { name: 'Complete Write report' }),
    );
    expect(h.onStart).toHaveBeenCalledTimes(1);
    expect(h.onComplete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /^Pause/ })).toBeNull();
    expect(screen.getByText('Start')).toBeTruthy();
    expect(screen.getByText('Complete')).toBeTruthy();
  });

  it('offers Pause and Complete for a task in progress', async () => {
    const h = handlers();
    await show(
      <TimerActions status="in_progress" title="Write report" {...h} />,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Pause Write report' }));
    expect(h.onPause).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /^Start/ })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Complete Write report' }),
    ).toBeTruthy();
  });

  it('shows nothing for a completed task', async () => {
    await show(<TimerActions status="completed" title="x" {...handlers()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('words the buttons in Spanish like the web (Iniciar, Pausar, Completar)', async () => {
    await show(
      <TimerActions status="pending" title="Informe" {...handlers()} />,
      'es',
    );
    expect(screen.getByText('Iniciar')).toBeTruthy();
    expect(screen.getByText('Completar')).toBeTruthy();
    screen.unmount();
    await show(
      <TimerActions status="in_progress" title="Informe" {...handlers()} />,
      'es',
    );
    expect(screen.getByText('Pausar')).toBeTruthy();
  });

  it('disables every action while busy', async () => {
    const h = handlers();
    await show(<TimerActions status="pending" title="x" busy {...h} />);
    fireEvent.press(screen.getByRole('button', { name: 'Start x' }));
    expect(h.onStart).not.toHaveBeenCalled();
  });

  it('lets the buttons wrap at large font sizes instead of clipping', async () => {
    withFontScale(1.5);
    await show(<TimerActions status="pending" title="x" {...handlers()} />);
    expect(flat(screen.getByTestId('timer-actions'))).toMatchObject({
      flexWrap: 'wrap',
    });
  });
});

describe('UndoBar', () => {
  it('says Completed as a polite live region and offers Undo', async () => {
    const onUndo = jest.fn();
    await show(<UndoBar onUndo={onUndo} />);
    expect(screen.getByText('Completed').props.accessibilityLiveRegion).toBe(
      'polite',
    );
    fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});

describe('SubtaskRow', () => {
  const row = (
    patch: Partial<React.ComponentProps<typeof SubtaskRow>> = {},
  ) => ({
    title: 'Buy bread',
    completed: false,
    onToggle: jest.fn(),
    onDelete: jest.fn(),
    ...patch,
  });

  it('is a checkbox named by the title with its checked state, and toggles', async () => {
    const props = row();
    await show(<SubtaskRow {...props} />);
    const box = screen.getByRole('checkbox', { name: 'Buy bread' });
    expect(box.props.accessibilityState).toMatchObject({ checked: false });
    fireEvent.press(box);
    expect(props.onToggle).toHaveBeenCalledTimes(1);
  });

  it('a done subtask is checked, struck through and muted, not only colored', async () => {
    await show(<SubtaskRow {...row({ completed: true })} />);
    expect(
      screen.getByRole('checkbox', { name: 'Buy bread' }).props
        .accessibilityState,
    ).toMatchObject({ checked: true });
    expect(flat(screen.getByText('Buy bread'))).toMatchObject({
      textDecorationLine: 'line-through',
      color: lightTheme.colors.textMuted,
    });
  });

  it('has a delete button that names the subtask', async () => {
    const props = row();
    await show(<SubtaskRow {...props} />);
    fireEvent.press(
      screen.getByRole('button', { name: 'Delete subtask Buy bread' }),
    );
    expect(props.onDelete).toHaveBeenCalledTimes(1);
  });

  it('keeps both targets at 48dp and lets a long title wrap', async () => {
    withFontScale(1.5);
    const long = 'A very long subtask title '.repeat(6).trim();
    await show(<SubtaskRow {...row({ title: long })} />);
    expect(
      flat(screen.getByRole('checkbox', { name: long })).minHeight,
    ).toBeGreaterThanOrEqual(48);
    expect(
      flat(screen.getByRole('button', { name: `Delete subtask ${long}` }))
        .minHeight,
    ).toBeGreaterThanOrEqual(48);
    expect(screen.getByText(long).props.numberOfLines).toBeUndefined();
  });
});

describe('SubtaskAddField', () => {
  it('has a visible label, adds on the keyboard action and clears itself', async () => {
    const onSubmit = jest.fn().mockResolvedValue(null);
    await show(<SubtaskAddField onSubmit={onSubmit} />);
    const field = screen.getByLabelText('New subtask');
    expect(field.props.returnKeyType).toBe('done');
    fireEvent.changeText(field, 'Wash');
    fireEvent(field, 'submitEditing');
    await screen.findByDisplayValue('');
    expect(onSubmit).toHaveBeenCalledWith('Wash');
  });

  it('shows a refusal and keeps the text', async () => {
    await show(
      <SubtaskAddField
        onSubmit={jest.fn().mockResolvedValue('Title is required')}
      />,
    );
    fireEvent.changeText(screen.getByLabelText('New subtask'), ' ');
    fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Title is required')).toBeTruthy();
  });
});

describe('IconButton and DetailHeader', () => {
  it('an icon button is named by its label, 48dp, and presses', async () => {
    const onPress = jest.fn();
    await show(
      <IconButton icon={Pencil} label="Edit task" onPress={onPress} />,
    );
    const button = screen.getByRole('button', { name: 'Edit task' });
    expect(flat(button)).toMatchObject({ minWidth: 48, minHeight: 48 });
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('the header has Back, the title as a heading, and labeled Edit and Delete buttons', async () => {
    const h = { onBack: jest.fn(), onEdit: jest.fn(), onDelete: jest.fn() };
    await show(<DetailHeader title="Prepare slides" {...h} />);
    expect(screen.getByRole('header', { name: 'Prepare slides' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    fireEvent.press(screen.getByRole('button', { name: 'Edit task' }));
    fireEvent.press(screen.getByRole('button', { name: 'Delete task' }));
    expect(h.onBack).toHaveBeenCalledTimes(1);
    expect(h.onEdit).toHaveBeenCalledTimes(1);
    expect(h.onDelete).toHaveBeenCalledTimes(1);
  });

  it('wraps a long title instead of truncating it', async () => {
    withFontScale(1.5);
    const long =
      'Prepare the very long quarterly presentation for Friday '.repeat(3);
    await show(
      <DetailHeader
        title={long}
        onBack={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(screen.getByText(long).props.numberOfLines).toBeUndefined();
  });

  it('the delete icon uses the error color and the edit icon the text color', async () => {
    await show(
      <DetailHeader
        title="x"
        onBack={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    const colors = (name: string) =>
      screen
        .getByRole('button', { name })
        .findAll(node => typeof node.props.stroke === 'string')
        .map(node => node.props.stroke as string);
    expect(colors('Delete task')).toContain(lightTheme.colors.danger);
    expect(colors('Edit task')).toContain(lightTheme.colors.text);
  });
});

describe('InfoPair', () => {
  it('shows a small muted label above its value', async () => {
    await show(<InfoPair label="Priority" value="High" />);
    expect(screen.getByText('Priority')).toBeTruthy();
    expect(screen.getByText('High')).toBeTruthy();
    expect(flat(screen.getByText('Priority')).color).toBe(
      lightTheme.colors.textMuted,
    );
  });

  it('is one spoken unit: label, then value', async () => {
    await show(<InfoPair label="Status" value="In progress" />);
    expect(screen.getByLabelText('Status: In progress')).toBeTruthy();
  });

  it('can lead the value with a marker that is hidden from screen readers', async () => {
    await show(
      <InfoPair label="Status" value="Pending" leading={<React.Fragment />} />,
    );
    expect(screen.getByText('Pending')).toBeTruthy();
  });
});
