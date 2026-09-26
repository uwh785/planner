import { api, A } from './api.svelte.js';
import { t } from './i18n.svelte.js';

// P mirrors GET /api/subscription. `remaining` uses -1 for a resource the plan
// does not cap, which is the same convention the backend uses.
export const P = $state({
  loaded: false,
  plan: 'free',
  limits: { max_tasks: 0, max_lists: 0, max_tags: 0 },
  usage: { active_tasks: 0, lists: 0, tags: 0 },
  remaining: {}
});

const isUnlimited = n => n === -1;

// resource ids must match the keys the backend returns in `remaining`.
const LIMIT_MESSAGE_KEY = {
  tasks: 'planLimitTasks',
  lists: 'planLimitLists',
  tags: 'planLimitTags'
};

const USAGE_KEY = {
  tasks: 'active_tasks',
  lists: 'lists',
  tags: 'tags'
};

const LABEL_KEY = {
  tasks: 'planResourceTasks',
  lists: 'planResourceLists',
  tags: 'planResourceTags'
};

// loadPlan fetches the entitlement once per session. It is safe to call from
// several components: concurrent callers share the in-flight promise, and a
// failure leaves `loaded` false so a later call can retry.
let inflight = null;

export async function loadPlan({ force = false } = {}) {
  if (!A.token) return;
  if (P.loaded && !force) return;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const v = await api('/api/subscription');
      if (v && typeof v.plan === 'string') {
        P.plan = v.plan;
        if (v.limits) P.limits = v.limits;
        if (v.usage) P.usage = v.usage;
        if (v.remaining) P.remaining = v.remaining;
        P.loaded = true;
      }
    } catch {
      // The endpoint is unavailable on an older backend. Leave loaded false so
      // the UI keeps working off the free defaults instead of hard-failing.
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export const isPro = () => P.plan === 'pro';

// limitFor returns the cap for a resource, or -1 when uncapped.
export function limitFor(resource) {
  const key = USAGE_KEY[resource];
  if (!key) return -1;
  switch (resource) {
    case 'tasks': return P.limits.max_tasks;
    case 'lists': return P.limits.max_lists;
    case 'tags': return P.limits.max_tags;
    default: return -1;
  }
}

// usedFor returns how much of a resource the account currently holds.
export function usedFor(resource) {
  const key = USAGE_KEY[resource];
  return key ? (P.usage[key] ?? 0) : 0;
}

// remainingFor returns the headroom left, or -1 when the plan is uncapped.
export function remainingFor(resource) {
  return P.remaining[resource] ?? -1;
}

// isAtLimit reports whether the account has used up a capped resource. It
// drives the proactive warning so the user sees the ceiling before they hit it.
export function isAtLimit(resource) {
  const remaining = remainingFor(resource);
  return !isUnlimited(remaining) && remaining <= 0;
}

// usageLabel renders "12 / 50" for a capped resource and just the count for an
// uncapped one, since "12 / -1" reads like a bug to a user.
export function usageLabel(resource) {
  const used = usedFor(resource);
  const limit = limitFor(resource);
  return isUnlimited(limit) ? `${used}` : `${used} / ${limit}`;
}

// limitNotice builds the localized sentence shown when a create is refused.
// The server's own English message is deliberately not surfaced: the app is
// bilingual, and the client already knows the limits from the subscription
// endpoint, so it can build the sentence in the active language.
export function limitNotice(resource) {
  const key = LIMIT_MESSAGE_KEY[resource];
  if (!key) return '';
  const limit = limitFor(resource);
  const shown = isUnlimited(limit) ? usedFor(resource) : limit;
  return t(key).replace('{n}', String(shown));
}

export function resourceLabel(resource) {
  const key = LABEL_KEY[resource];
  return key ? t(key) : resource;
}
