The presentation layer holds screens and components (atoms, molecules, organisms). It talks to the application layer only.

Components here are presentational: props in, callbacks out, no use cases and no infrastructure. All colors, spacing and type come from `../theme.ts` (light and dark through `useColorScheme`). The design is in `native-client/DESIGN.md`.

- `atoms`: `Screen` and `Frame`, `Button` (primary, secondary, destructive, link), `TextField`, `InlineMessage`, `RadioRow`, `GroupedRow`, `ColorDot`, `StatusDot`, `CountdownRing` (SVG, compact and large), `IconButton`, `TimerButton`, `icons` (the Lucide icons in use).
- `molecules`: `PasswordField` (show/hide toggle), `MessageView` (title, text, one action), `StatusLine` (one polite live-region line), `ScreenHeader`, `QuickAddField`, `EmptyState`, `Announcement`, `ListRow`, `NavRow`, `RadioGroup`, `DueDateField`, `FormSection`, `StatTile`, `FilterChips`, `PriorityBadge`, `TimerBox` (inline and card), `TimerActions`, `UndoBar`, `DetailHeader`, `InfoPair`, `SubtaskRow`, `SubtaskAddField`, `TaskCard`, `DayTabs`, `ClassCard`, `TimeField`, `LanguageSelector`, `LanguageLink`.
- `organisms`: `TabBar`, `PanelView`, `TodayClasses`, `TasksView`, `ScheduleView`, `ConfigView`, `ListsView`, `AuthForm`, `TaskEditForm`, `ListEditForm`, `ClassEditForm`, `TaskDetailView`, `SubtaskSection`.

No component holds a string of its own: words come from `useT()` (`../i18n/I18nProvider`), dates and times from `../format`.
