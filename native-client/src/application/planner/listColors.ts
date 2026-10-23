/**
 * The colors a list can take: the iOS system accents the web app uses. They
 * are non-text markers only; every swatch is shown with its name.
 */
export interface ListColor {
  name: string;
  value: string;
}

export const LIST_COLORS: readonly ListColor[] = [
  { name: 'Blue', value: '#0A84FF' },
  { name: 'Green', value: '#30D158' },
  { name: 'Orange', value: '#FF9F0A' },
  { name: 'Red', value: '#FF453A' },
  { name: 'Purple', value: '#BF5AF2' },
  { name: 'Pink', value: '#FF375F' },
  { name: 'Teal', value: '#40C8E0' },
  { name: 'Gray', value: '#8E8E93' },
];

/** The color name for a stored value, or null for a color from elsewhere. */
export const colorName = (value: string): string | null =>
  LIST_COLORS.find(c => c.value.toLowerCase() === value.toLowerCase())?.name ??
  null;
