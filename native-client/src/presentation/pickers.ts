import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

function open(mode: 'date' | 'time', initial: Date): Promise<Date | null> {
  return new Promise(resolve => {
    try {
      DateTimePickerAndroid.open({
        value: initial,
        mode,
        is24Hour: true,
        onChange: (event, date) =>
          resolve(event.type === 'set' && date ? date : null),
        onError: () => resolve(null),
      });
    } catch {
      resolve(null);
    }
  });
}

/** The system date dialog; resolves to null when it is dismissed. */
export const pickDate = (initial: Date): Promise<Date | null> =>
  open('date', initial);

/** The system time dialog (24-hour); resolves to null when dismissed. */
export const pickTime = (initial: Date): Promise<Date | null> =>
  open('time', initial);
