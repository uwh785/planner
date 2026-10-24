import { CLASS_COLORS } from '../schedule/classColors';

/**
 * The web's event form offers the same eight swatches as its class form, so
 * the two share one list (and the `color<Key>` names in the catalog).
 */
export const EVENT_COLORS = CLASS_COLORS;
export const DEFAULT_EVENT_COLOR = EVENT_COLORS[0]!.value;
