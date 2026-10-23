/**
 * A catalog value: a string, or `{ one, other }` for messages that count.
 * The form is chosen from `{count}` (see translate.ts).
 */
export type Message = string | { readonly one: string; readonly other: string };
