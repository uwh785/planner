package plan

import (
	"testing"
	"time"
)

func TestLimitsFor(t *testing.T) {
	tests := []struct {
		name string
		plan Plan
		want Limits
	}{
		{name: "free", plan: Free, want: Limits{MaxTasks: 50, MaxLists: 3, MaxTags: 10}},
		{name: "pro", plan: Pro, want: Limits{MaxTasks: Unlimited, MaxLists: Unlimited, MaxTags: Unlimited}},
		{name: "unknown falls back to free", plan: Plan("enterprise"), want: Limits{MaxTasks: 50, MaxLists: 3, MaxTags: 10}},
		{name: "empty falls back to free", plan: Plan(""), want: Limits{MaxTasks: 50, MaxLists: 3, MaxTags: 10}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := LimitsFor(tt.plan); got != tt.want {
				t.Errorf("LimitsFor(%q) = %+v, want %+v", tt.plan, got, tt.want)
			}
		})
	}
}

func TestLimitsCheck(t *testing.T) {
	tests := []struct {
		name    string
		limits  Limits
		plan    Plan
		res     Resource
		current int
		wantErr bool
	}{
		{name: "free allows the last free task", limits: LimitsFor(Free), plan: Free, res: ResourceTask, current: 49},
		{name: "free refuses task 51", limits: LimitsFor(Free), plan: Free, res: ResourceTask, current: 50, wantErr: true},
		{name: "free refuses well past the cap", limits: LimitsFor(Free), plan: Free, res: ResourceTask, current: 500, wantErr: true},
		{name: "free allows the third list", limits: LimitsFor(Free), plan: Free, res: ResourceList, current: 2},
		{name: "free refuses the fourth list", limits: LimitsFor(Free), plan: Free, res: ResourceList, current: 3, wantErr: true},
		{name: "free allows the tenth tag", limits: LimitsFor(Free), plan: Free, res: ResourceTag, current: 9},
		{name: "free refuses the eleventh tag", limits: LimitsFor(Free), plan: Free, res: ResourceTag, current: 10, wantErr: true},
		{name: "pro allows any number of tasks", limits: LimitsFor(Pro), plan: Pro, res: ResourceTask, current: 100000},
		{name: "pro allows any number of lists", limits: LimitsFor(Pro), plan: Pro, res: ResourceList, current: 100000},
		{name: "pro allows any number of tags", limits: LimitsFor(Pro), plan: Pro, res: ResourceTag, current: 100000},
		{name: "unknown resource is uncapped", limits: Limits{MaxTasks: 1, MaxLists: 1, MaxTags: 1}, plan: Free, res: Resource("widgets"), current: 99},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.limits.Check(tt.plan, tt.res, tt.current)
			if (err != nil) != tt.wantErr {
				t.Fatalf("Check(%s, %d) error = %v, wantErr %v", tt.res, tt.current, err, tt.wantErr)
			}
			if tt.wantErr {
				var le *LimitError
				if !asLimitError(err, &le) {
					t.Fatalf("Check returned %T, want *LimitError", err)
				}
				if le.Resource != tt.res {
					t.Errorf("LimitError.Resource = %q, want %q", le.Resource, tt.res)
				}
				if le.Plan != tt.plan {
					t.Errorf("LimitError.Plan = %q, want %q", le.Plan, tt.plan)
				}
			}
		})
	}
}

// asLimitError is errors.As specialised to *LimitError, kept local so the test
// file does not need the errors import for a single call.
func asLimitError(err error, target **LimitError) bool {
	le, ok := err.(*LimitError)
	if ok {
		*target = le
	}
	return ok
}

func TestEffective(t *testing.T) {
	now := time.Date(2026, 9, 26, 12, 0, 0, 0, time.UTC)
	past := now.Add(-24 * time.Hour)
	future := now.Add(24 * time.Hour)

	tests := []struct {
		name string
		sub  Subscription
		want Plan
	}{
		{name: "free stays free", sub: Subscription{Plan: Free, Status: "active"}, want: Free},
		{name: "pro active without expiry is pro", sub: Subscription{Plan: Pro, Status: "active"}, want: Pro},
		{
			name: "pro active with future expiry is pro",
			sub:  Subscription{Plan: Pro, Status: "active", ExpiresAt: &future},
			want: Pro,
		},
		{
			name: "pro active with past expiry falls back to free",
			sub:  Subscription{Plan: Pro, Status: "active", ExpiresAt: &past},
			want: Free,
		},
		{
			name: "expiry exactly now falls back to free",
			sub:  Subscription{Plan: Pro, Status: "active", ExpiresAt: &now},
			want: Free,
		},
		{
			name: "cancelled pro falls back to free",
			sub:  Subscription{Plan: Pro, Status: "cancelled"},
			want: Free,
		},
		{
			name: "expired pro falls back to free",
			sub:  Subscription{Plan: Pro, Status: "expired", ExpiresAt: &future},
			want: Free,
		},
		{
			name: "unknown status falls back to free",
			sub:  Subscription{Plan: Pro, Status: "trialing"},
			want: Free,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Effective(tt.sub, now); got != tt.want {
				t.Errorf("Effective() = %q, want %q", got, tt.want)
			}
		})
	}
}

// TestEffectiveNeverGrantsProFromBadData guards the security direction of the
// fallback: no combination of a non-pro plan may ever resolve to pro.
func TestEffectiveNeverGrantsProFromBadData(t *testing.T) {
	now := time.Date(2026, 9, 26, 12, 0, 0, 0, time.UTC)
	future := now.Add(24 * time.Hour)
	for _, p := range []Plan{Free, Plan(""), Plan("PRO"), Plan("pro "), Plan("unknown")} {
		for _, status := range []string{"active", "cancelled", "expired", "", "weird"} {
			got := Effective(Subscription{Plan: p, Status: status, ExpiresAt: &future}, now)
			if got == Pro {
				t.Errorf("Effective(plan=%q, status=%q) = pro, want free", p, status)
			}
		}
	}
}
