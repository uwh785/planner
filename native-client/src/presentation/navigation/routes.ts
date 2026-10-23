import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * Every screen of the signed-in app and what it needs to open. Signed-out
 * screens (sign in, create account) are not routes: SessionGate shows them.
 */
export type RootStackParamList = {
  Lists: undefined;
  /** `listId` omitted means "All tasks". */
  Tasks: { listId?: string } | undefined;
  TaskEdit: { taskId: string };
  ListEdit: { listId: string };
  Account: undefined;
};

export type ScreenProps<Name extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, Name>;
