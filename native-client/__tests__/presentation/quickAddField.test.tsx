import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QuickAddField } from '@/presentation/components/molecules/QuickAddField';
import { withLocale } from '../helpers/i18n';

async function show(onSubmit: (text: string) => Promise<string | null>) {
  const { Wrapper, ready } = withLocale('en');
  await ready;
  render(
    <Wrapper>
      <QuickAddField label="Add a task" onSubmit={onSubmit} />
    </Wrapper>,
  );
}
const field = () => screen.getByLabelText('Add a task');

describe('QuickAddField', () => {
  it('clears itself when the add worked', async () => {
    await show(jest.fn().mockResolvedValue(null));
    fireEvent.changeText(field(), 'Milk');
    fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    await screen.findByDisplayValue('');
  });

  it('shows the refusal and keeps the text', async () => {
    await show(jest.fn().mockResolvedValue('Title is required'));
    fireEvent.changeText(field(), 'Milk');
    fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Title is required')).toBeTruthy();
    expect(field().props.value).toBe('Milk');
  });

  it('shows an error and keeps the text when the add rejects, and can be retried', async () => {
    const onSubmit = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(null);
    await show(onSubmit);
    fireEvent.changeText(field(), 'Milk');
    fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText("Couldn't save. Try again.")).toBeTruthy();
    expect(field().props.value).toBe('Milk');
    fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    await screen.findByDisplayValue('');
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Couldn't save. Try again.")).toBeNull();
  });
});
