import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  TaskRow,
  type TaskRowModel,
} from '@/presentation/components/molecules/TaskRow';
import { ListRow } from '@/presentation/components/molecules/ListRow';
import { PriorityIndicator } from '@/presentation/components/atoms/PriorityIndicator';
import { darkTheme, lightTheme } from '@/presentation/theme';

const model = (patch: Partial<TaskRowModel> = {}): TaskRowModel => ({
  id: 'tsk_1',
  title: 'Water the plants',
  completed: false,
  due: null,
  priority: 0,
  ...patch,
});

const handlers = () => ({
  onToggle: jest.fn(),
  onUndo: jest.fn(),
  onOpen: jest.fn(),
});

describe('TaskRow', () => {
  it('has a checkbox, an openable body and nothing else for a plain task', () => {
    const h = handlers();
    render(
      <TaskRow task={model()} completing={false} position="only" {...h} />,
    );
    fireEvent.press(
      screen.getByRole('checkbox', { name: 'Mark Water the plants as done' }),
    );
    expect(h.onToggle).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByRole('button', { name: 'Water the plants' }));
    expect(h.onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('puts the overdue word in the text and in the spoken label', () => {
    render(
      <TaskRow
        task={model({ due: { text: 'Overdue, Oct 20', overdue: true } })}
        completing={false}
        position="only"
        {...handlers()}
      />,
    );
    expect(screen.getByText('Overdue, Oct 20')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Water the plants, Overdue, Oct 20' }),
    ).toBeTruthy();
  });

  it('shows Undo while completing and strikes the title', () => {
    const h = handlers();
    render(<TaskRow task={model()} completing position="only" {...h} />);
    expect(
      screen.getByRole('checkbox', { name: 'Mark Water the plants as done' })
        .props.accessibilityState,
    ).toMatchObject({ checked: true });
    fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(h.onUndo).toHaveBeenCalledTimes(1);
    expect(
      StyleSheet.flatten(screen.getByText('Water the plants').props.style),
    ).toMatchObject({ textDecorationLine: 'line-through' });
  });

  it('a completed task has a disabled, checked box that cannot be pressed', () => {
    const h = handlers();
    render(
      <TaskRow
        task={model({ completed: true })}
        completing={false}
        position="only"
        {...h}
      />,
    );
    const box = screen.getByRole('checkbox', {
      name: 'Water the plants, completed',
    });
    expect(box.props.accessibilityState).toMatchObject({
      checked: true,
      disabled: true,
    });
    fireEvent.press(box);
    expect(h.onToggle).not.toHaveBeenCalled();
  });

  it('rounds only the outer corners of a group and separates rows by a hairline', () => {
    const { rerender } = render(
      <TaskRow
        task={model()}
        completing={false}
        position="first"
        {...handlers()}
      />,
    );
    const rowOf = () => screen.getByTestId('task-row-tsk_1');
    expect(StyleSheet.flatten(rowOf().props.style)).toMatchObject({
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
    });
    rerender(
      <TaskRow
        task={model()}
        completing={false}
        position="middle"
        {...handlers()}
      />,
    );
    expect(
      StyleSheet.flatten(rowOf().props.style).borderTopLeftRadius ?? 0,
    ).toBe(0);
  });
});

describe('PriorityIndicator', () => {
  it.each([
    [1, 'Low'],
    [2, 'Medium'],
    [3, 'High'],
  ] as const)('priority %i is a flag with the word %s', (priority, word) => {
    render(<PriorityIndicator priority={priority} />);
    expect(screen.getByText(word)).toBeTruthy();
    expect(
      screen.getByTestId('priority-flag', { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it('shows nothing for no priority', () => {
    render(<PriorityIndicator priority={0} />);
    expect(
      screen.queryByTestId('priority-flag', { includeHiddenElements: true }),
    ).toBeNull();
    expect(screen.queryByText(/low|medium|high/i)).toBeNull();
  });
});

describe('ListRow', () => {
  it('speaks the name and the count, and pairs the color marker with the name', () => {
    const onPress = jest.fn();
    render(
      <ListRow
        name="Home"
        openCount={3}
        color="#FF453A"
        position="only"
        onPress={onPress}
      />,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Home, 3 open tasks' }));
    expect(onPress).toHaveBeenCalled();
    expect(screen.getByText('3 open')).toBeTruthy();
  });

  it('an "All tasks" row has a hollow ring instead of a color', () => {
    render(
      <ListRow
        name="All tasks"
        openCount={1}
        color={null}
        position="only"
        onPress={jest.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'All tasks, 1 open task' }),
    ).toBeTruthy();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('color-marker', { includeHiddenElements: true })
          .props.style,
      ).backgroundColor,
    ).toBeUndefined();
  });
});

it('the theme has the tokens the rows use', () => {
  expect(lightTheme.minTouch).toBe(48);
  expect(darkTheme.radii.card).toBe(12);
});
