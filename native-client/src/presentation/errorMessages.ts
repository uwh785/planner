import type { MessageKey } from '@/application/i18n';
import { NotFoundError, ValidationError } from '@/domain';
import type { Translate } from './i18n/I18nProvider';

const REQUIRED: Record<string, MessageKey> = {
  title: 'errorTitleRequired',
  name: 'errorNameRequired',
};

const TOO_LONG: Record<string, MessageKey> = {
  title: 'errorTitleTooLong',
  name: 'errorNameTooLong',
  description: 'errorDescriptionTooLong',
};

/**
 * Maps an error from a use case to one short sentence in the user's
 * language. A rule the app knows is worded precisely; anything else is the
 * plain "Couldn't save" line.
 */
export function errorSentence(error: unknown, t: Translate): string {
  if (error instanceof ValidationError && error.detail) {
    const { code, field, max } = error.detail;
    const key = code === 'required' ? REQUIRED[field] : TOO_LONG[field];
    if (key !== undefined) {
      return t(key, { max: max ?? 0 });
    }
  }
  if (error instanceof NotFoundError && error.entity !== undefined) {
    return t(
      error.entity === 'task' ? 'errorTaskNotFound' : 'errorListNotFound',
    );
  }
  return t('errorSave');
}
