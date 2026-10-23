The presentation layer holds screens and components (atoms, molecules, organisms). It talks to the application layer only.

Components here are presentational: props in, callbacks out, no use cases and no infrastructure. All colors, spacing and type come from `../theme.ts` (light and dark through `useColorScheme`). The design is in `native-client/DESIGN.md`.

- `atoms`: `Screen`, `Button` (primary, secondary, destructive, link), `TextField`, `InlineMessage`.
- `molecules`: `PasswordField` (show/hide toggle), `MessageView` (title, text, one action), `StatusLine` (one polite live-region line).
- `organisms`: `AuthForm` (sign in / create account).
