import React from 'react';
import { View } from 'react-native';
import { GroupedRow, groupPosition } from '../atoms/GroupedRow';
import { RadioRow } from '../atoms/RadioRow';

export interface RadioOption<T> {
  value: T;
  label: string;
  /** A decorative marker before the label. */
  leading?: React.ReactNode;
}

interface RadioGroupProps<T> {
  options: readonly RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** A single-choice group of rows on one rounded surface. */
export function RadioGroup<T>({
  options,
  value,
  onChange,
}: RadioGroupProps<T>) {
  return (
    <View accessibilityRole="radiogroup">
      {options.map((option, index) => (
        <GroupedRow
          key={String(option.value)}
          position={groupPosition(index, options.length)}
        >
          <RadioRow
            label={option.label}
            leading={option.leading}
            selected={option.value === value}
            onPress={() => onChange(option.value)}
          />
        </GroupedRow>
      ))}
    </View>
  );
}
