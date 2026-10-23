import React from 'react';
import type { LocaleService } from '@/application/i18n';
import { MessageView } from '../components/molecules/MessageView';
import { I18nProvider, useT } from '../i18n/I18nProvider';

function StartupError() {
  const t = useT();
  return (
    <MessageView title={t('startupErrorTitle')} body={t('startupErrorBody')} />
  );
}

/**
 * Shown instead of the app when the build is misconfigured. It speaks the
 * saved language like the rest of the app (the boot message is for logs).
 */
export function StartupErrorScreen({ locale }: { locale: LocaleService }) {
  return (
    <I18nProvider service={locale}>
      <StartupError />
    </I18nProvider>
  );
}
