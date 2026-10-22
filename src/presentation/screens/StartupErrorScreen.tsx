import React from 'react';
import { MessageView } from '../components/molecules/MessageView';

/** Shown instead of the app when the build is misconfigured. */
export function StartupErrorScreen({ message }: { message: string }) {
  return <MessageView title="Planner can't start" body={message} />;
}
