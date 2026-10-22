The presentation layer holds screens and components (atoms, molecules, organisms). It talks to the application layer only.

Components here are presentational: props in, callbacks out, no use cases and no infrastructure. All colors, spacing and type come from `../theme.ts` (light and dark through `useColorScheme`), which the M5 design replaces.

- `atoms`: `Screen`, `Button`, `TextField`, `InlineMessage`.
- `molecules`: `PasswordField` (show/hide toggle), `MessageView` (title, text, one action), `StatusLine` (one polite live-region line).
- `organisms`: `AuthForm` (sign in / create account).
