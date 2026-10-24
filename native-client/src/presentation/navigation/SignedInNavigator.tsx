import React, { useEffect, useLayoutEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { ContainerSource } from '@/application/container';
import {
  createPlanner,
  type PlannerRuntime,
} from '@/application/planner/createPlanner';
import { MessageView } from '../components/molecules/MessageView';
import { TabBar } from '../components/organisms/TabBar';
import { ContainerProvider, useAcquiredContainer } from '../containerContext';
import { PlannerProvider } from '../plannerContext';
import { useT } from '../i18n/I18nProvider';
import { ClassEditScreen } from '../screens/ClassEditScreen';
import { ConfigScreen } from '../screens/ConfigScreen';
import { ListEditScreen } from '../screens/ListEditScreen';
import { ListsScreen } from '../screens/ListsScreen';
import { PanelScreen } from '../screens/PanelScreen';
import { ScheduleScreen } from '../screens/ScheduleScreen';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';
import { TaskEditScreen } from '../screens/TaskEditScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { useTheme } from '../theme';
import { navigationTheme } from './navTheme';
import type { RootStackParamList, TabParamList } from './routes';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

const renderTabBar = (props: BottomTabBarProps) => <TabBar {...props} />;

/** Panel, Tasks, Schedule and Config behind the web's mobile bottom bar. */
function TabsNavigator() {
  return (
    <Tabs.Navigator
      initialRouteName="Panel"
      tabBar={renderTabBar}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="Panel" component={PanelScreen} />
      <Tabs.Screen name="Tasks" component={TasksScreen} />
      <Tabs.Screen name="Schedule" component={ScheduleScreen} />
      <Tabs.Screen name="Config" component={ConfigScreen} />
    </Tabs.Navigator>
  );
}

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
 * services over it and shows the navigator: the tabs, with the task detail,
 * the edit screens and list management above them. Android's back button pops the stack, then
 * returns to Panel from another tab, then leaves the app.
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
  const t = useT();
  const design = useTheme();
  const dark = useColorScheme() === 'dark';
  const theme = useMemo(() => navigationTheme(design, dark), [design, dark]);

  // Layout cleanups run before the database handle is released, so a task
  // still in its undo window is written first.
  useLayoutEffect(
    () => () => {
      // Never rejects; the catch only keeps a surprise from going unhandled.
      planner?.completion.flush().catch(() => undefined);
    },
    [planner],
  );
  useEffect(() => () => planner?.dispose(), [planner]);

  if (container === null || planner === null) {
    return <MessageView title={t('loading')} />;
  }
  return (
    <ContainerProvider value={container}>
      <PlannerProvider value={planner}>
        <NavigationContainer theme={theme}>
          <Stack.Navigator
            initialRouteName="Tabs"
            screenOptions={screenOptions}
          >
            <Stack.Screen name="Tabs" component={TabsNavigator} />
            <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
            <Stack.Screen name="TaskEdit" component={TaskEditScreen} />
            <Stack.Screen name="Lists" component={ListsScreen} />
            <Stack.Screen name="ListEdit" component={ListEditScreen} />
            <Stack.Screen name="ClassEdit" component={ClassEditScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </PlannerProvider>
    </ContainerProvider>
  );
}
