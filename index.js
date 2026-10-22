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
import { bootstrapApp } from '@/infrastructure/composition/bootstrapApp';
import { runAuthSmoke } from '@/infrastructure/composition/devAuthSmoke';
import { runRepoSmoke } from '@/infrastructure/composition/devSmoke';
import App from '@/presentation/App';
import { StartupErrorScreen } from '@/presentation/screens/StartupErrorScreen';
import { name as appName } from './app.json';

// Restores the stored session (no network) and opens that user's database.
// A misconfigured build does not throw here: it registers and shows why.
const boot = bootstrapApp();
if (boot.kind === 'ready') {
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
}

AppRegistry.registerComponent(
  appName,
  () => () =>
    boot.kind === 'ready' ? (
      <App
        session={boot.services.session}
        containers={boot.services.containers}
      />
    ) : (
      <StartupErrorScreen message={boot.message} />
    ),
);
