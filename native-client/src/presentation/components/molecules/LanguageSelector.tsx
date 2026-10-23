import React from 'react';
import type { Locale } from '@/application/i18n';
import { useI18n } from '../../i18n/I18nProvider';
import { RadioGroup } from './RadioGroup';

/**
 * Español / English. Each language is written in itself, so it can be found
 * whichever language the app is in now.
 */
export function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();
  return (
    <RadioGroup<Locale>
      value={locale}
      onChange={setLocale}
      options={[
        { value: 'es', label: t('languageSpanish') },
        { value: 'en', label: t('languageEnglish') },
      ]}
    />
  );
}
