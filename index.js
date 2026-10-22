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
import { createAppServices } from '@/infrastructure/composition/createAppServices';
import { runAuthSmoke } from '@/infrastructure/composition/devAuthSmoke';
import { runRepoSmoke } from '@/infrastructure/composition/devSmoke';
import App from '@/presentation/App';
import { name as appName } from './app.json';

// Restores the stored session (no network) and opens that user's database.
const services = createAppServices();
services.ready.then(() => {
  if (__DEV__) {
    const session = services.session.current();
    console.log(
      session
        ? `session restored (${session.refreshToken ? 'active' : 'expired'})`
        : 'session restored (none)',
    );
  }
});

if (__DEV__) {
  runRepoSmoke().catch(error => console.error('repo smoke failed', error));
  runAuthSmoke().catch(error => console.error('auth smoke failed', error));
}

AppRegistry.registerComponent(appName, () => () => (
  <App containers={services.containers} />
));
