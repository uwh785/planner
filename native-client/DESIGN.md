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
  task-row:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    height: "48px"
    padding: "0 16px 0 0"
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

The web palette is the brand, but two of its light-mode values fail WCAG AA for text (the app promises AA). Those few values are darkened in the app only; the web values stay canonical for surfaces, borders and non-text accents. The measured table in section 2 is the evidence.

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

Adjusted from the web values: light `text2` `#8e8e93` to `#636366`; light accent as text and button fill `#007aff` to `#0062cc`; light red as text `#ff3b30` to `#c4271c`; light orange as icon `#ff9500` to `#a85400`; dark button label white to black (white on `#0a84ff` is 3.65:1). Everything else is the web value unchanged.

### Named Rules
**The One Voice Rule.** The accent is used on the primary action, links and the focus ring. If two filled accent buttons share a screen, one is wrong.

**The Never Alone Rule.** Overdue, priority, error and sync state always carry a word or an icon next to the color. A color dot with no label is prohibited.

**The Surface 2 Rule.** Only primary text sits on Surface 2. Muted text there fails AA in dark.

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

### Task row
A list row with a leading complete toggle (48dp touch area around a 24dp circle, filled with the accent and a check mark when done). Title in body; due date in callout. Completed titles use a strikethrough in muted text, so state is never color alone. The body of the row is a second target that opens the task; the toggle and the body are separate controls so a screen reader reaches both.

- **Overdue:** the due line reads "Overdue, Oct 20" in the danger color. The word carries the meaning, the color only reinforces it. Due text otherwise says "Today", "Tomorrow" or a short date, with 24-hour time when the task has one.
- **Completing (undo window):** completing a task cannot be reversed once saved, because the backend has no way to reopen a task. Ticking a task only starts a window of about five seconds in which the row shows as done with a plain "Undo" link under the title; nothing is saved until the window ends, and leaving the screen or the app saves it at once. The announcement line says "Completed Call Ann. Undo is available."
- **Completed:** a checked, disabled toggle (its label ends in "completed"), a struck-through muted title and "Completed Oct 21" instead of the due line. Completed rows live in their own collapsed section.

### Completed header
A 48dp row above the completed tasks: "Completed (3)" in callout muted and the word "Show" or "Hide" in link style, so the state of the section is a word, not a chevron. The section is collapsed by default and, past 200 tasks, says "Showing the latest 200 of 340."

### Radio row
A single-choice row in a grouped list: a 22dp ring (filled dot when chosen, weight 600 label), an optional decorative marker (color dot, flag) and the label in body. 48dp tall, announced as a radio with its selected state. Used for priority, list and list color. A list color is always chosen by name ("Green"), never by swatch alone.

### Quick add field
The text field component with the label always visible ("Add a task", "Add a list"), the keyboard's done key as the primary way to add, and a link-style "Add" inside the field for people who do not use the key. It clears itself on success and keeps the keyboard open for the next entry; a refusal ("Name is required") appears as the field error line.

### Screen header
Back (link) on the left and the screen's actions (link) on the right in one wrapping row, then the Title below it. The title wraps; nothing is truncated at large text sizes. Screens change without animation.

### Announcement line
One caption in muted text under the quick add field, a polite live region: "Added Buy milk", "Deleted Buy milk", "Saved Buy milk". It clears itself after five seconds.

### Tag chip
Surface 2 fill, pill radius, callout label in Text color, 12dp horizontal padding, 48dp touch height when interactive (visual height 32dp inside it). No border.

### Priority indicator
An icon plus a word: none shows nothing, low, medium and high show a flag icon in the matching priority color (muted, accent, amber, red) next to the label "Low", "Medium" or "High" in Text color. Color is reinforcement only.

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
- **Do** keep copy short and plain, in sentence case, with no exclamation marks.

### Don't:
- **Don't** make dense, data-heavy screens in the style of Binance: crowded screens, many numbers and charts, heavy chrome, constant visual noise. Nothing should feel like a dashboard to monitor.
- **Don't** use shadows, glassmorphism, gradients or gradient text.
- **Don't** use a colored side stripe (`border-left` greater than 1px) on cards, notices or rows.
- **Don't** put green, yellow or the web orange `#ff9500` into text on light grounds; they fail AA.
- **Don't** use muted text on Surface 2.
- **Don't** add a second font family, decorative motion, or identical card grids.
- **Don't** convey state with color alone, or use em dashes in UI copy.
