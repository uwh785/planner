/** What a plan caps. Ids match the keys of the backend's `remaining`. */
export type PlanResource = 'tasks' | 'lists' | 'tags';

export const PLAN_RESOURCES: readonly PlanResource[] = [
  'tasks',
  'lists',
  'tags',
];

/** A cap or headroom of -1 means the plan does not limit that resource. */
export const UNLIMITED = -1;

export interface PlanUsageLine {
  resource: PlanResource;
  used: number;
  /** The cap, or UNLIMITED. */
  limit: number;
}

export interface PlanSummary {
  plan: 'free' | 'pro';
  lines: PlanUsageLine[];
}

type Wire = Record<string, unknown>;

const isObject = (v: unknown): v is Wire =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const count = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isInteger(v) ? v : fallback;

/**
 * Reads `GET /api/subscription` (`{data: {plan, limits, usage}}`). Anything
 * that is not a plan answer is null, so the screen shows nothing rather than
 * wrong numbers.
 */
export function parsePlan(body: unknown): PlanSummary | null {
  const data = isObject(body) ? body.data : undefined;
  if (!isObject(data) || (data.plan !== 'free' && data.plan !== 'pro')) {
    return null;
  }
  const limits = isObject(data.limits) ? data.limits : {};
  const usage = isObject(data.usage) ? data.usage : {};
  return {
    plan: data.plan,
    lines: [
      {
        resource: 'tasks',
        used: count(usage.active_tasks, 0),
        limit: count(limits.max_tasks, UNLIMITED),
      },
      {
        resource: 'lists',
        used: count(usage.lists, 0),
        limit: count(limits.max_lists, UNLIMITED),
      },
      {
        resource: 'tags',
        used: count(usage.tags, 0),
        limit: count(limits.max_tags, UNLIMITED),
      },
    ],
  };
}

export const isAtLimit = (line: PlanUsageLine): boolean =>
  line.limit !== UNLIMITED && line.used >= line.limit;
