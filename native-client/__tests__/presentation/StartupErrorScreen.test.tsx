import React from 'react';
import { render, screen } from '@testing-library/react-native';
import {
  InMemoryLocaleStore,
  LocaleService,
  type Locale,
} from '@/application/i18n';
import { StartupErrorScreen } from '@/presentation/screens/StartupErrorScreen';

async function show(locale: Locale) {
  const service = new LocaleService(new InMemoryLocaleStore(locale));
  await service.restore();
  render(<StartupErrorScreen locale={service} />);
}

it('explains a startup failure in plain words', async () => {
  await show('en');
  expect(screen.getByRole('header')).toHaveTextContent("Planner can't start");
  expect(screen.getByText(/not set up correctly/)).toBeTruthy();
});

it('says it in the saved language', async () => {
  await show('es');
  expect(screen.getByRole('header')).toHaveTextContent(
    'Planner no puede iniciar',
  );
});
