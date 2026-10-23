/**
 * The colors a list can take: the iOS system accents the web app uses. They
 * are non-text markers only; every swatch is shown with its name.
 */
export interface ListColor {
  /** Names the color in the message catalog (`color<Key>`). */
  key:
    | 'Blue'
    | 'Green'
    | 'Orange'
    | 'Red'
    | 'Purple'
    | 'Pink'
    | 'Teal'
    | 'Gray';
  value: string;
}

export const LIST_COLORS: readonly ListColor[] = [
  { key: 'Blue', value: '#0A84FF' },
  { key: 'Green', value: '#30D158' },
  { key: 'Orange', value: '#FF9F0A' },
  { key: 'Red', value: '#FF453A' },
  { key: 'Purple', value: '#BF5AF2' },
  { key: 'Pink', value: '#FF375F' },
  { key: 'Teal', value: '#40C8E0' },
  { key: 'Gray', value: '#8E8E93' },
];
