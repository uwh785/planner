/**
 * Composition entry: the only place that knows both the presentation layer
 * and the infrastructure that backs it.
 *
 * @format
 */

// Installs crypto.getRandomValues, which Hermes lacks; entity ids need it.
import 'react-native-get-random-values';
import React from 'react';
import { AppRegistry } from 'react-native';
import { LocaleService } from '@/application/i18n';
import { bootstrapApp } from '@/infrastructure/composition/bootstrapApp';
import { runAuthSmoke } from '@/infrastructure/composition/devAuthSmoke';
import { runRepoSmoke } from '@/infrastructure/composition/devSmoke';
import { runSyncSmoke } from '@/infrastructure/composition/devSyncSmoke';
import { AsyncStorageLocaleStore } from '@/infrastructure/storage/AsyncStorageLocaleStore';
import App from '@/presentation/App';
import { StartupErrorScreen } from '@/presentation/screens/StartupErrorScreen';
import { name as appName } from './app.json';

// The device's language choice, read before the first frame is drawn.
const locale = new LocaleService(new AsyncStorageLocaleStore());
locale.restore();

// Restores the stored session (no network) and opens that user's database.
// A misconfigured build does not throw here: it registers and shows why.
const boot = bootstrapApp();
if (boot.kind === 'ready') {
  // Syncs whoever is signed in, now and after every later sign-in.
  boot.services.sync.start();
  boot.services.ready.then(() => {
    if (__DEV__) {
      const { status } = boot.services.session.state();
      console.log(`session restored (${status})`);
    }
  });
}

if (__DEV__ && boot.kind === 'ready') {
  runRepoSmoke().catch(error => console.error('repo smoke failed', error));
  runAuthSmoke().catch(error => console.error('auth smoke failed', error));
  runSyncSmoke().catch(error => console.error('sync smoke failed', error));
}

AppRegistry.registerComponent(
  appName,
  () => () =>
    boot.kind === 'ready' ? (
      <App
        session={boot.services.session}
        containers={boot.services.containers}
        sync={boot.services.sync}
        locale={locale}
      />
    ) : (
      <StartupErrorScreen locale={locale} />
    ),
);
