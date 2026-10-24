/**
 * The colors a class can take: the iOS system accents the web's class form
 * offers. Non-text markers only; each swatch is shown with its name.
 */
export interface ClassColor {
  /** Names the color in the message catalog (`color<Key>`). */
  key:
    | 'Blue'
    | 'Green'
    | 'Yellow'
    | 'Red'
    | 'Orange'
    | 'Purple'
    | 'Pink'
    | 'Cyan';
  value: string;
}

export const CLASS_COLORS: readonly ClassColor[] = [
  { key: 'Blue', value: '#0A84FF' },
  { key: 'Green', value: '#30D158' },
  { key: 'Yellow', value: '#FFD60A' },
  { key: 'Red', value: '#FF453A' },
  { key: 'Orange', value: '#FF9F0A' },
  { key: 'Purple', value: '#BF5AF2' },
  { key: 'Pink', value: '#FF375F' },
  { key: 'Cyan', value: '#64D2FF' },
];

export const DEFAULT_CLASS_COLOR = CLASS_COLORS[0]!.value;
