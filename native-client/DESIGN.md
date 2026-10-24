---
name: Planner
description: A calm, flat, iOS-system-colored task planner for Android that works offline.
colors:
  dark-background: "#000000"
  dark-surface: "#1c1c1e"
  dark-surface-2: "#2c2c2e"
  dark-hairline: "#38383a"
  dark-border-strong: "#6e6e73"
  dark-text: "#ffffff"
  dark-text-muted: "#8e8e93"
  dark-accent: "#0a84ff"
  dark-on-accent: "#000000"
  dark-danger: "#ff453a"
  dark-orange: "#ff9f0a"
  dark-green: "#30d158"
  dark-yellow: "#ffd60a"
  dark-success: "#30d158"
  dark-ring-track: "#7a7a80"
  light-background: "#f2f2f7"
  light-surface: "#ffffff"
  light-surface-2: "#e5e5ea"
  light-hairline: "#d1d1d6"
  light-border-strong: "#85858a"
  light-text: "#000000"
  light-text-muted: "#636366"
  light-accent: "#007aff"
  light-accent-text: "#0062cc"
  light-on-accent: "#ffffff"
  light-danger: "#c4271c"
  light-orange: "#a85400"
  light-green: "#34c759"
  light-yellow: "#ffcc00"
  light-success: "#1d7a36"
  light-ring-track: "#7c7c80"
  light-ring-caution: "#7a5c00"
typography:
  title:
    fontFamily: "System"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: "36px"
  headline:
    fontFamily: "System"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "28px"
  body:
    fontFamily: "System"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "24px"
  callout:
    fontFamily: "System"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: "21px"
  caption:
    fontFamily: "System"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
rounded:
  control: "10px"
  card: "12px"
  sheet: "20px"
  pill: "999px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.light-accent-text}"
    textColor: "{colors.light-on-accent}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "8px 16px"
  button-destructive:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-danger}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "8px 16px"
  text-field:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 16px"
  inline-message-notice:
    backgroundColor: "{colors.light-surface-2}"
    textColor: "{colors.light-text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  status-line:
    textColor: "{colors.light-text-muted}"
    typography: "{typography.caption}"
  list-group:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    rounded: "{rounded.card}"
    padding: "16px"
  tag-chip:
    backgroundColor: "{colors.light-surface-2}"
    textColor: "{colors.light-text}"
    typography: "{typography.callout}"
    rounded: "{rounded.pill}"
    height: "48px"
    padding: "0 12px"
  tab-bar:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text-muted}"
    typography: "{typography.caption}"
    height: "56px"
    padding: "6px 4px"
  tab-bar-selected:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-accent-text}"
    typography: "{typography.caption}"
    height: "56px"
  stat-tile:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    typography: "{typography.caption}"
    rounded: "{rounded.card}"
    padding: "16px"
  task-card:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "16px"
  task-card-timer:
    backgroundColor: "{colors.light-surface-2}"
    textColor: "{colors.light-text}"
    typography: "{typography.caption}"
    rounded: "8px"
    padding: "12px"
  filter-chip:
    backgroundColor: "{colors.light-background}"
    textColor: "{colors.light-text-muted}"
    typography: "{typography.callout}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 16px"
  filter-chip-selected:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-accent-text}"
    typography: "{typography.callout}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 16px"
  class-card:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "16px"
  day-tab:
    backgroundColor: "{colors.light-background}"
    textColor: "{colors.light-text-muted}"
    typography: "{typography.callout}"
    rounded: "{rounded.control}"
    height: "48px"
  day-tab-selected:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-accent-text}"
    typography: "{typography.callout}"
    rounded: "{rounded.control}"
    height: "48px"
  today-class-card:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "16px"
  priority-badge:
    backgroundColor: "{colors.light-surface-2}"
    textColor: "{colors.light-text}"
    typography: "{typography.caption}"
    rounded: "6px"
    padding: "2px 8px"
  timer-action-start:
    backgroundColor: "{colors.light-accent-text}"
    textColor: "{colors.light-on-accent}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "8px 16px"
  timer-action-pause:
    backgroundColor: "{colors.light-orange}"
    textColor: "{colors.light-on-accent}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "8px 16px"
  timer-action-complete:
    backgroundColor: "{colors.light-success}"
    textColor: "{colors.light-on-accent}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "8px 16px"
  timer-action-outlined:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-orange}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "8px 16px"
  timer-card:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    typography: "{typography.headline}"
    rounded: "{rounded.card}"
    padding: "16px"
  icon-button:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    rounded: "{rounded.control}"
    height: "48px"
    width: "48px"
  subtask-row:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 4px 0 4px"
  info-pair:
    textColor: "{colors.light-text}"
    typography: "{typography.callout}"
  language-selector:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    height: "48px"
  radio-row:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    height: "48px"
    padding: "8px 16px"
---

# Design System: Planner

## 1. Overview

**Creative North Star: "The Quiet Notebook"**

Planner is a notebook you can open in a basement classroom or on a plane: flat paper-like surfaces, one blue accent, plain words. It reuses the web app's palette on purpose, the iOS system colors, so a person who uses both sees one product. PRODUCT.md asks for "calm, minimal, light" and for a screen that "lowers the user's stress, not adds to it". Every rule below serves that line: show one main thing per screen, let empty space do work, and keep color for the few things that need to be found.

The system is restrained. Surfaces are separated by tone and a hairline, never by shadow. There is one accent, and it appears on the primary action, links and the focus ring only. Type is the platform font at a short, named scale; hierarchy comes from size and weight, not from color or decoration. Lists are grouped rows on a rounded surface, like iOS settings, with generous 16dp padding and 48dp touch height.

It explicitly rejects the anti-reference in PRODUCT.md: "Dense, data-heavy apps in the style of Binance: crowded screens, many numbers and charts, heavy chrome, constant visual noise. Nothing should feel like a dashboard to monitor."

The app is the web app's mobile version, not a separate product (PRODUCT.md principle 2): the same bottom tab bar (Panel, Tasks, Config), the same four counters, the same task card with its countdown ring, the same words in Spanish first and English second. Where a web value fails WCAG AA it keeps its look and takes an AA-safe value from `theme.ts`, a translated word or an icon.

The web palette is the brand, but a few of its light-mode values fail WCAG AA for text (the app promises AA). Those few values are darkened in the app only; the web values stay canonical for surfaces, borders and non-text accents. The measured table in section 2 is the evidence.

**Key Characteristics:**
- Flat: tone and hairline, zero shadows.
- One accent (iOS blue), used on at most one control per screen plus links and focus.
- Platform system font only, five named roles, scales with the system font setting.
- Grouped rows, 16dp padding, 48dp minimum touch target.
- Dark by system preference or light, both fully specified and both AA.
- Color is never the only signal: priority, error and sync always carry text or an icon.

## 2. Colors

An iOS system palette: pure black or soft grey grounds, white or near-black surfaces, a single blue, and warm semantic colors held in reserve. Role names below match `src/presentation/theme.ts`.

### Primary
- **System Blue** (dark `#0a84ff`, light `#007aff`): the accent. Focus ring, primary button fill in dark, non-text emphasis. In dark it is also the link color (5.76:1 on black, 4.66:1 on surface).
- **Deep System Blue** (light `#0062cc`): the AA-safe light variant. Primary button fill, links and accent text on light grounds. `#007aff` is 3.60:1 on the light background and 4.02:1 on white, too weak for small text and for a white button label.

### Secondary
- **Alert Red** (dark `#ff453a`, light `#c4271c`): error text, the error outline of a field, the destructive button label. The web red `#ff3b30` is 3.18:1 on the light background, so light mode uses the darker `#c4271c` (5.15:1).

### Tertiary
- **Amber** (dark `#ff9f0a`, light `#a85400`): the medium priority icon. The web orange `#ff9500` is 1.97:1 on light grounds; as a priority icon it needs 3:1, so light uses `#a85400`.
- **Green and Yellow** (dark `#30d158` / `#ffd60a`, light `#34c759` / `#ffcc00`): decorative status dots only, canonical web values. They are never text and never the only signal; they always sit next to a word.
- **Success Green** (dark `#30d158`, light `#1d7a36`): the Completed counter's number. The web green `#34c759` is 2.2:1 on white, so light mode darkens it to 5.40:1; dark keeps the web value.
- **Ring colors** (dark: track `#7a7a80`, green `#30d158`, yellow `#ffd60a`, orange `#ff9f0a`, red `#ff453a`; light: track `#7c7c80`, green `#1d7a36`, yellow `#7a5c00`, orange `#a85400`, red `#c4271c`): the countdown ring on Surface 2. The web green, yellow and orange are under 3:1 on the light Surface 2, so light mode uses the darker values (still green, ochre, amber, red). The time left is always written next to the ring.

### Neutral
- **Ground** (dark `#000000`, light `#f2f2f7`): screen background.
- **Surface** (dark `#1c1c1e`, light `#ffffff`): grouped lists, fields, secondary buttons.
- **Surface 2** (dark `#2c2c2e`, light `#e5e5ea`): notices, chips, pressed rows. Text on it is always the primary text color.
- **Hairline** (dark `#38383a`, light `#d1d1d6`): separators and group outlines. Decorative, never the sole edge of a control.
- **Strong Border** (dark `#6e6e73`, light `#85858a`): outline of inputs and secondary buttons, at least 3:1.
- **Text** (dark `#ffffff`, light `#000000`): all primary text.
- **Muted Text** (dark `#8e8e93`, light `#636366`): secondary text, captions, placeholders. Use on ground and surface, never on Surface 2 (dark `#8e8e93` is 4.27:1 there). The web light value `#8e8e93` is 2.92:1 on the ground.

### Measured contrast (WCAG 2.1 relative luminance, ratios)
Text pairings need 4.5:1; borders, focus ring and icons need 3:1. Asserted in `__tests__/presentation/theme.test.ts`.

| Pairing | Dark | Light |
| --- | --- | --- |
| Text on ground / surface / surface 2 | 21.00 / 17.01 / 13.94 | 18.82 / 21.00 / 16.73 |
| Muted text on ground / surface | 6.44 / 5.22 | 5.37 / 5.99 |
| Link text on ground / surface | 5.76 / 4.66 | 5.20 / 5.80 |
| Error text on ground / surface | 6.16 / 4.99 | 5.15 / 5.75 |
| Button label on primary fill | 5.76 (black on `#0a84ff`) | 5.80 (white on `#0062cc`) |
| Strong border on ground / surface | 4.14 / 3.36 | 3.29 / 3.67 |
| Focus ring (accent) on ground / surface | 5.76 / 4.66 | 3.60 / 4.02 |
| Priority icons on surface (none / low / medium / high) | 5.22 / 4.66 / 8.28 / 4.99 | 5.99 / 5.80 / 5.34 / 5.75 |
| Priority icons on Surface 2, the badge (none / low / medium / high) | 4.27 / 3.82 / 6.78 / 4.09 | 4.77 / 4.62 / 4.25 / 4.58 |
| Success text on ground / surface | 10.39 / 8.42 | 4.84 / 5.40 |
| Ring on Surface 2 (track / green / yellow / orange / red) | 3.27 / 6.89 / 9.87 / 6.78 / 4.09 | 3.31 / 4.30 / 4.98 / 4.25 / 4.58 |
| Selected chip border (accent) on ground | 5.76 | 3.60 |
| Pause label on its fill (black on `#ff9f0a` / white on `#a85400`) | 10.22 | 5.34 |
| Complete label on its fill (black on `#30d158` / white on `#1d7a36`) | 10.39 | 5.40 |
| Outlined Pause / Complete text on Surface | 8.28 / 8.42 | 5.34 / 5.40 |
| Pause / Complete fill on ground (not text, at least 3:1) | 10.22 / 10.39 | 4.78 / 4.84 |
| Ring on Surface, the detail card (track / green / yellow / orange / red) | 3.99 / 8.42 / 12.05 / 8.28 / 4.99 | 4.16 / 5.40 / 6.25 / 5.34 / 5.75 |

Adjusted from the web values: light `text2` `#8e8e93` to `#636366`; light accent as text and button fill `#007aff` to `#0062cc`; light red as text `#ff3b30` to `#c4271c`; light orange as icon `#ff9500` to `#a85400`; dark button label white to black (white on `#0a84ff` is 3.65:1); light green as text `#34c759` to `#1d7a36`; the light ring green, yellow and orange (see Success Green and Ring colors); the white label of the web's orange Pause and green Complete buttons (2.20 and 2.22 on the light fills, 2.06 and 2.02 on the dark ones) becomes a fill of `#a85400` / `#1d7a36` in light and a black label on the web fills in dark. The web priority label (red 11px text on Surface 2, 4.09:1 in dark) is replaced by a flag icon plus the word in the text color. Everything else is the web value unchanged.

### Named Rules
**The One Voice Rule.** The accent is used on the primary action, links and the focus ring. If two filled accent buttons share a screen, one is wrong.

**The Never Alone Rule.** Overdue, priority, error and sync state always carry a word or an icon next to the color. A color dot with no label is prohibited.

**The Surface 2 Rule.** Only primary text sits on Surface 2. Muted text there fails AA in dark. This holds for the priority badge and the remaining-time box too: their words use the text color, the color lives in icons and the ring.

**The Active Card Rule.** The web marks an in-progress card with an accent border plus a 3dp left stripe (`border-left: 3px solid`), and an overdue card the same in red; the reference screenshot shows the stripe. The app reproduces the emphasis with the same colors on a full 1dp border all around (accent for in progress, danger for overdue, in progress wins when both apply, as in the web's CSS order), plus the status dot's shape and the words in the card. A thick one-sided stripe stays prohibited (section 6): it is the one place the app deliberately differs from the web's look, and it can be revisited if parity matters more than the rule.

## 3. Typography

**Font:** the platform system font (Roboto on Android), no custom family. One family keeps the app fast, native and consistent with the web's system stack.

**Character:** plain and legible. Size and weight carry the hierarchy; color only mutes secondary text. Sizes are dp and follow the system font scale, so layouts must wrap and grow rather than clip (verified at 1.5x).

### Hierarchy
- **Title** (700, 30/36): one per screen, the screen name or form heading.
- **Headline** (600, 22/28): section or message titles, a person's name.
- **Body** (400, 17/24): reading text, field values, button labels (button labels use weight 600). Keep paragraphs to 65 to 75 characters per line, which one narrow phone column already does.
- **Callout** (500, 15/21): field labels, secondary lines such as an email under a name, chip labels.
- **Caption** (400, 13/18): the sync status line, field error text, small metadata.

Adjacent roles differ by at least 1.25 in size (30/22, 22/17, 17/13); callout sits between body and caption and is told apart by weight.

### Named Rules
**The Scale Is Closed Rule.** Only these five roles exist. A new size is a new role in `theme.ts` and here first, never a one-off number in a component.

**The No Truncation Rule.** Text wraps at large font sizes. Fixed heights on text containers are prohibited; use `minHeight`.

## 4. Elevation

Flat by default, no shadows anywhere. Depth is tone: the ground is the lowest layer, Surface sits one step above it, Surface 2 one step above that. A hairline (1 device pixel) outlines grouped surfaces where the tones are close, mainly in light mode. Pressed state is a slight opacity change, not a lift. Bottom sheets and dialogs, when they arrive, are Surface on a dimmed ground with the 20dp sheet radius and no shadow.

### Named Rules
**The Flat-By-Default Rule.** If a surface needs a shadow to be seen, change its tone or add the hairline instead. If it looks like a 2014 card, the shadow is too dark.

## 5. Components

Every control is calm and obvious: rounded 10dp, 48dp tall at least, label in the body size.

### Buttons
- **Shape:** gently curved (10dp), minimum 48dp by 48dp.
- **Primary:** filled with the primary fill (dark `#0a84ff` with black label, light `#0062cc` with white label), label body 600. One per screen.
- **Secondary:** Surface with a 1px strong border and Text label.
- **Destructive:** Surface with a 1px danger outline and a danger label. Used for deleting data and other irreversible actions; never a filled red block.
- **Link:** no fill, accent-text color, underlined so it is not color-only (inside the password field it is the show/hide toggle).
- **States:** pressed 0.8 opacity, disabled or busy 0.6 opacity with the busy label ("Signing in…"); no motion.

### Text field
- **Style:** Surface fill, 1px strong border, 10dp radius, 48dp minimum height, 16dp inner padding. Label sits above in callout, muted. The label is always visible; a placeholder never replaces it.
- **Focus:** the border becomes 2px System Blue (the accent).
- **Error:** the border becomes 2px danger and a caption error line appears below the field, announced politely. The text carries the message, the color only reinforces it.
- **Password field:** the same field with a trailing link-style Show or Hide control.

### Inline message
- **Notice:** Surface 2 fill, 10dp radius, body text. Calm information such as "Your session expired".
- **Error:** Surface fill, 1px danger outline, prefixed "Error:" so it never relies on color. Always a live region.
- Side-stripe borders are prohibited.

### Status line
One caption line in muted text under the main content, for example "Synced 5 min ago". Discreet, never a banner or a blocking alert.

### List row and grouped list
Rows sit inside one Surface group with 12dp radius, a hairline outline and 16dp padding; rows are separated by a hairline inset 16dp. Row height at least 48dp. Title in body, detail in callout muted. No chevron decoration unless the row navigates.

### Task card
The web's card on a phone: Surface fill, 1dp hairline border, 12dp radius, 16dp padding, 12dp between its parts and between cards. The body (title row, due line, description, remaining-time box) is one 48dp-plus target that opens the task; the Complete action below it is a separate control so a screen reader reaches both.

- **Title row:** the status dot, the title (body, weight 600, wraps; never truncated), the priority badge on the right.
- **Status dot:** 10dp. Pending is a hollow ring, in progress a filled accent dot, completed a filled muted dot, so the status is told by shape as well as color. It is decorative; the card's spoken label says the status ("Prepare slides, In progress, Today, 14:30, high priority, 1 h 58 min left").
- **Due line:** callout muted ("Today, 14:30", "Dec 3"). Overdue reads "Overdue, Oct 20" in the danger color and weight 600; the words carry the meaning.
- **Description:** callout muted, two lines at most.
- **Edge:** a full 1dp accent border for in progress and danger for overdue (The Active Card Rule), otherwise the hairline. A completed card is not dimmed (the web's 0.6 opacity would drop its text below AA): the title is struck through and muted, and the due line says "Completed Oct 21".
- **Actions (Panel and Tasks):** the web's outlined timer actions (see Timer actions): Start for a pending task, Pause for one in progress, Complete for both, spoken "Start <title>", "Pause <title>", "Complete <title>". After Complete the card shows "Completed" and a link-style "Undo" for about five seconds (completion cannot be reopened once saved). A completed card has no actions.

### Remaining-time box and countdown ring
(The detail screen's larger version of this box is the timer card below.) Inside the card when the task has a duration: a Surface 2 box (8dp radius, 12dp padding) with the ring on the left and, on the right, "Time left" (caption) over the time in headline weight 700 ("1 h 58 min"). Both texts use the text color (The Surface 2 Rule). A finished task says "Completed", a task past its duration says "Time over".

The ring is a 40dp SVG: a 3dp track, an arc for the time used (round caps), the percent in the middle (a check when completed). The arc color follows the web thresholds (green up to 25%, yellow to 50%, orange to 75%, red above) with the ring colors of section 2. It is drawn once per tick (every 30 seconds), never animated, so reduced motion needs no special case. It is hidden from screen readers; the box is one spoken unit ("1 h 58 min left"). At large system font sizes the ring grows with the font (up to 1.6 times) so the percent never spills out.

### Timer actions
The web's three buttons in their AA-safe values: Start (primary blue), Pause (orange) and Complete (green). Two variants share one set of tokens (`colors.action` in `theme.ts`).
- **Filled** (task detail): equal-width 48dp buttons that wrap to a second line at large font sizes. Start uses the primary pair; Pause is `#a85400` with a white label in light and the web `#ff9f0a` with a black label in dark; Complete is `#1d7a36` with white in light and the web `#30d158` with black in dark. The web's white label fails on its own fills (2.0 to 2.2), which is why the pairs differ.
- **Outlined** (task cards, as on the web dashboard): 1dp border and label in the same color on Surface, 48dp tall.
- The word is always shown ("Start", "Pause", "Complete"), the spoken name adds the title, and a busy write disables the buttons. A pending task offers Start and Complete, one in progress Pause and Complete, a completed one nothing. While the undo window is open the actions give way to the **Undo bar**: "Completed" (polite live region) and a link-style "Undo".

### Task detail
The web's detail screen on a phone, one column: the **detail header** (Back as a link, then the Edit pencil and the Delete trash as 48dp **icon buttons** on the right, the title below it, wrapping), the description in muted body text, a row of **info pairs** (a caption label over its value: Priority with its flag, Due date, Status with its status dot; always a translated word, never `in_progress`), the **timer card**, the timer actions and the Subtasks section.
- **Icon button:** 48dp square, Surface, 1px strong border, 10dp radius, a 20dp Lucide icon in the text color; Delete keeps the icon and a 1px outline in the danger color. Always named for screen readers ("Edit task", "Delete task"), never icon alone.
- **Timer card:** Surface, 1px hairline, 12dp radius, 16dp padding, the large countdown ring (80dp, 6dp stroke, up to 1.5 times at large font sizes; same arc rules and colors as the card ring, on Surface where the track is 3.99 / 4.16:1) beside "Time left" in muted caption and the time in headline weight 700. The last minute counts in seconds. It is one spoken unit: "Time left: 1 h 12 min. 40% of the time used", the text equivalent of the ring. Done says "Completed" with a check, past the duration "Time over". The text refreshes every second while the task runs, every 30 seconds with reduced motion and not at all otherwise; the ring never animates.
- **Subtask row:** Surface, 1px hairline, 10dp radius. A checkbox (22dp Lucide square or checked square, announced as a checkbox with its state) and the title (wraps; done is struck through and muted, so it is not color alone) form one 48dp target; a 48dp X icon button deletes it, spoken "Delete subtask <title>". Rows are 8dp apart.
- **Subtask add field:** the quick add text field with the label "New subtask", the keyboard's done key and a link-style Add; a refusal shows as the field error.
- **Estimated duration:** the task edit form gets two number fields, Hours and Minutes (minutes held at 59), as the web's form has.

### Stat tile
One Panel counter: Surface fill, hairline, 12dp radius, 16dp padding, centered. The number is 28dp, weight 700; below it the label in caption muted. Four tiles in a 2 by 2 grid with 12dp gaps. The number's color follows the web (text for pending, accent text for in progress, success for completed, danger for overdue) in AA-safe values, and the tile is read as one "Pending: 3", so color is never the only signal. The Panel stays a glance: the four counters and the active tasks, nothing more.

### Tab bar
The web's mobile bottom bar: Surface fill, a 1dp hairline on top, four equal tabs (Panel, Tasks, Schedule, Config) with a 22dp Lucide icon over a caption label (LayoutDashboard, ListTodo, CalendarDays, Settings; Calendar joins later). Each tab is at least 56dp tall and grows with the system font; the bar's bottom padding is the system safe-area inset. The selected tab uses accent text, a heavier label and a heavier icon stroke (so it is not color alone) and is announced as selected. No animation between tabs.

### Filter chip
The web's filter buttons as a horizontally scrolling row of 48dp-tall chips (10dp radius, 16dp padding, 8dp gaps), one choice at a time, announced as radios in a labelled group ("Filter by status", "Filter by list"). Unselected: 1dp strong border, muted label on the ground. Selected: a 2dp accent border, a Surface fill, an accent-text label in weight 700. The list row has a color dot before each list name and "All" first. The two rows sit under the quick add field.

### Day tabs and class card
The web's Schedule on a phone, one day at a time. **Day tabs** are seven equal 48dp-tall tabs in one row, Monday first, each a single letter (L M M J V S D / M T W T F S S). They share the filter chip's rules: unselected has a 1dp strong border and a muted letter, selected a 2dp accent border, a Surface fill and an accent-text letter in weight 700; each is announced as a radio named by the full day ("Jueves", "Thursday") in a labelled group, so the letter is never the only name. The screen opens on today. The same row picks the day in the class form.
- **Class card:** Surface, 1dp hairline, 12dp radius, 16dp padding, 4dp between lines; one 48dp-plus target that opens the class. The class color is a 16dp dot before the subject, not the web's side bar (no colored side stripe, see the Don'ts); a class with no color uses the accent. Subject in body weight 600 (wraps), then the time range ("08:00 – 09:00") and "room, teacher" in callout muted. Spoken as one label: "FÍSICA, 09:00 – 10:30, A1, Ruiz". A free day shows one muted line, "No classes this day"; Add class is the header's link action.
- **Class form:** a subject field that suggests the subjects already used (accent-folded match, so "fis" finds "FÍSICA") as 48dp rows under the field, with a link that shows every subject; picking or typing a known subject lends its teacher and color while the user has not chosen them, and a caption says so. Start and End are two 48dp time buttons with a clock icon that open the system time dialog; an end that is not after the start shows the error under End. Color is the eight web swatches as named rows with a dot (as the list colors). Delete appears only when editing, behind a confirmation.

### Today's classes (Panel)
Shown on the Panel under the counters only when today has a class, with the heading "Today's classes" and a link-style "View schedule" on the right. The class in progress is a card with a 1dp accent edge (the active-card rule): the compact ring (progress of the class so far, decorative) beside the subject with its color dot and "Ends in 30 min" in callout muted. The next class is the same card without the ring and with "Starts in 1 h". The rest are 48dp mini rows: dot, subject, time range. Each card is one spoken unit ("FÍSICA, Ends in 30 min"); the countdown is always written, so the ring and the dot only repeat it. The text refreshes with the Panel's 30-second clock.

### Priority badge
A pill on Surface 2 (6dp radius, 8dp by 2dp padding): a 12dp Lucide flag in the priority color (muted, accent, amber, red) and the translated word ("Low", "Medium", "High") in the text color, caption weight 600. None shows nothing. It replaces both the web's red-on-dark label and the earlier priority indicator.

### Language selector
Two radio rows in a grouped list, "Español" and "English", each written in its own language so it can be found from either. Selecting one re-words the app at once and saves the choice on the device. The sign-in screen has a one-tap link to the other language instead of the selector.

### Completed header
A 48dp row above the completed cards: "Completed (3)" in callout muted and the word "Show" or "Hide" in link style, so the state of the section is a word, not a chevron. The section is collapsed by default and, past 200 tasks, says "Showing the latest 200 of 340."

### Radio row
A single-choice row in a grouped list: a 22dp ring (filled dot when chosen, weight 600 label), an optional decorative marker (color dot, flag) and the label in body. 48dp tall, announced as a radio with its selected state. Used for priority, list and list color. A list color is always chosen by name ("Green"), never by swatch alone.

### Quick add field
The text field component with the label always visible ("Add a task", "Add a list"; "Agregar una tarea" in Spanish), the keyboard's done key as the primary way to add, and a link-style "Add" inside the field for people who do not use the key. It clears itself on success and keeps the keyboard open for the next entry; a refusal ("Name is required") appears as the field error line.

### Screen header
Back (link) on the left and the screen's actions (link) on the right in one wrapping row, then the Title below it. The title wraps; nothing is truncated at large text sizes. Screens change without animation.

### Announcement line
One caption in muted text under the quick add field, a polite live region: "Added Buy milk", "Deleted Buy milk", "Saved Buy milk" (in the current language). It clears itself after five seconds.

### Tag chip
Surface 2 fill, pill radius, callout label in Text color, 12dp horizontal padding, 48dp touch height when interactive (visual height 32dp inside it). No border.

### Empty state
Centered column: a headline, one muted body line saying what belongs here, and at most one primary button. Generous 48dp spacing above. No illustrations, no jokes.

## 6. Do's and Don'ts

### Do:
- **Do** keep the web's iOS system colors as the brand and use the AA variants where text sits on the light theme (`#636366`, `#0062cc`, `#c4271c`).
- **Do** use the spacing scale 4, 8, 12, 16, 24, 32, 48 and 16dp as the default padding. Prefer more space over more lines.
- **Do** give every touch target at least 48dp and every field a visible label.
- **Do** separate surfaces with tone and a hairline; keep one accent per screen.
- **Do** pair every status color with a word or an icon (overdue, priority, error, sync).
- **Do** let text wrap and grow with the system font size; test at 1.5x.
- **Do** keep copy short and plain with no exclamation marks. Keys the web already has keep the web's wording (Spanish first, then English); app-only copy is neutral Latin American Spanish ("tú") and plain English in sentence case.
- **Do** put every word the user reads through the message catalog, so the language switch reaches it; format dates and times with `Intl` and the chosen language.

### Don't:
- **Don't** make dense, data-heavy screens in the style of Binance: crowded screens, many numbers and charts, heavy chrome, constant visual noise. Nothing should feel like a dashboard to monitor.
- **Don't** use shadows, glassmorphism, gradients or gradient text.
- **Don't** use a colored side stripe (`border-left` greater than 1px) on cards, notices or rows, even though the web's active card has one (The Active Card Rule).
- **Don't** dim a card with opacity to say it is done; text contrast would drop below AA.
- **Don't** put green, yellow or the web orange `#ff9500` into text on light grounds; they fail AA.
- **Don't** use muted text on Surface 2.
- **Don't** add a second font family, decorative motion, or identical card grids.
- **Don't** convey state with color alone, or use em dashes in UI copy.
