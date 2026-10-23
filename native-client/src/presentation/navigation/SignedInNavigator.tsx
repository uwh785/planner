import React, { useEffect, useLayoutEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { ContainerSource } from '@/application/container';
import {
  createPlanner,
  type PlannerRuntime,
} from '@/application/planner/createPlanner';
import { MessageView } from '../components/molecules/MessageView';
import { ContainerProvider, useAcquiredContainer } from '../containerContext';
import { PlannerProvider } from '../plannerContext';
import { AccountScreen } from '../screens/AccountScreen';
import { ListEditScreen } from '../screens/ListEditScreen';
import { ListsScreen } from '../screens/ListsScreen';
import { TaskEditScreen } from '../screens/TaskEditScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { useTheme } from '../theme';
import { navigationTheme } from './navTheme';
import type { RootStackParamList } from './routes';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Screens draw their own header (large text, Back, actions) and change
 * without animation: calm, and nothing to turn off for reduced motion.
 */
export const screenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: 'none',
};

/**
 * The signed-in app: holds the user's database open, builds the planner
 * services over it and shows the navigator. Android's back button pops the
 * stack (and leaves the app from the lists).
 */
export function SignedInNavigator({
  containers,
  runtime,
}: {
  containers: ContainerSource;
  runtime: PlannerRuntime;
}) {
  const container = useAcquiredContainer(containers);
  const planner = useMemo(
    () => (container === null ? null : createPlanner(container, runtime)),
    [container, runtime],
  );
  const design = useTheme();
  const dark = useColorScheme() === 'dark';
  const theme = useMemo(() => navigationTheme(design, dark), [design, dark]);

  // Layout cleanups run before the database handle is released, so a task
  // still in its undo window is written first.
  useLayoutEffect(
    () => () => {
      planner?.completion.flush();
    },
    [planner],
  );
  useEffect(() => () => planner?.dispose(), [planner]);

  if (container === null || planner === null) {
    return <MessageView title="Loading" />;
  }
  return (
    <ContainerProvider value={container}>
      <PlannerProvider value={planner}>
        <NavigationContainer theme={theme}>
          <Stack.Navigator
            initialRouteName="Lists"
            screenOptions={screenOptions}
          >
            <Stack.Screen name="Lists" component={ListsScreen} />
            <Stack.Screen name="Tasks" component={TasksScreen} />
            <Stack.Screen name="TaskEdit" component={TaskEditScreen} />
            <Stack.Screen name="ListEdit" component={ListEditScreen} />
            <Stack.Screen name="Account" component={AccountScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </PlannerProvider>
    </ContainerProvider>
  );
}
