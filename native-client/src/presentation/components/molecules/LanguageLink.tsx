import React from 'react';
import { View } from 'react-native';
import { useI18n } from '../../i18n/I18nProvider';
import { Button } from '../atoms/Button';

/**
 * A one-tap switch to the other language, for screens without Settings (the
 * sign-in form). It names the language it switches to, in that language.
 */
export function LanguageLink() {
  const { locale, setLocale, t } = useI18n();
  return (
    <View>
      <Button
        variant="link"
        label={locale === 'es' ? t('languageEnglish') : t('languageSpanish')}
        onPress={() => setLocale(locale === 'es' ? 'en' : 'es')}
      />
    </View>
  );
}
