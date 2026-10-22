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
import { ContainerManager } from '@/application/container';
import { createContainer } from '@/infrastructure/composition/createContainer';
import { runRepoSmoke } from '@/infrastructure/composition/devSmoke';
import App from '@/presentation/App';
import { name as appName } from './app.json';

// The per-user database name arrives with auth (M3); until then a local one.
const containers = new ContainerManager(() =>
  createContainer({ userId: 'local' }),
);

if (__DEV__) {
  runRepoSmoke().catch(error => console.error('repo smoke failed', error));
}

AppRegistry.registerComponent(appName, () => () => (
  <App containers={containers} />
));
