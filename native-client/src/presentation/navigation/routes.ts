import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/** The bottom tabs, as on the web app's mobile bar (Schedule and Calendar come later). */
export type TabParamList = {
  Panel: undefined;
  Tasks: undefined;
  Config: undefined;
};

/**
 * Every screen of the signed-in app and what it needs to open. The tabs are
 * one screen of the stack; the others sit above them. Signed-out screens
 * (sign in, create account) are not routes: SessionGate shows them.
 */
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  TaskEdit: { taskId: string };
  /** List management: create, then open one to rename, recolor or delete. */
  Lists: undefined;
  ListEdit: { listId: string };
};

export type ScreenProps<Name extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, Name>;

export type TabScreenProps<Name extends keyof TabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<TabParamList, Name>,
    NativeStackScreenProps<RootStackParamList>
  >;
