import { PlanService } from '@/application/plan/PlanService';
import { isAtLimit, parsePlan, UNLIMITED } from '@/domain';

const free = {
  data: {
    plan: 'free',
    limits: { max_tasks: 50, max_lists: 5, max_tags: 10 },
    usage: { active_tasks: 50, lists: 2, tags: 0 },
    remaining: { tasks: 0, lists: 3, tags: 10 },
  },
};

describe('parsePlan', () => {
  it('reads the plan, its caps and the usage', () => {
    const plan = parsePlan(free);
    expect(plan?.plan).toBe('free');
    expect(plan?.lines).toEqual([
      { resource: 'tasks', used: 50, limit: 50 },
      { resource: 'lists', used: 2, limit: 5 },
      { resource: 'tags', used: 0, limit: 10 },
    ]);
    expect(isAtLimit(plan!.lines[0]!)).toBe(true);
    expect(isAtLimit(plan!.lines[1]!)).toBe(false);
  });

  it('treats -1 as unlimited and never as full', () => {
    const plan = parsePlan({
      data: {
        plan: 'pro',
        limits: { max_tasks: -1, max_lists: -1, max_tags: -1 },
        usage: { active_tasks: 900, lists: 9, tags: 3 },
      },
    });
    expect(plan?.lines.every(l => l.limit === UNLIMITED)).toBe(true);
    expect(plan?.lines.some(isAtLimit)).toBe(false);
  });

  it('is null for anything that is not a plan answer', () => {
    expect(parsePlan(null)).toBeNull();
    expect(parsePlan({ data: { plan: 'gold' } })).toBeNull();
    expect(parsePlan({ plan: 'free' })).toBeNull();
  });
});

describe('PlanService', () => {
  it('stores the plan for the user it was read for and tells subscribers', async () => {
    const request = jest.fn(async () => ({ status: 200, json: free }));
    const service = new PlanService({ request }, 'https://x/#pricing');
    const listener = jest.fn();
    service.subscribe(listener);
    await service.refresh('u1');
    expect(request).toHaveBeenCalledWith('GET', '/api/subscription');
    expect(service.getSnapshot().userId).toBe('u1');
    expect(service.getSnapshot().summary?.plan).toBe('free');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps the last plan when the request fails', async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce({ status: 200, json: free })
      .mockRejectedValueOnce(new Error('offline'));
    const service = new PlanService({ request }, 'u');
    await service.refresh('u1');
    await expect(service.refresh('u1')).resolves.toBeUndefined();
    expect(service.getSnapshot().summary?.plan).toBe('free');
  });
});
