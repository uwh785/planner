// Package plan holds the entitlement rules for the Free and Pro tiers: which
// limits apply to each plan and how a stored subscription resolves to the plan
// a request should actually be evaluated against.
//
// It is deliberately free of database and HTTP concerns so the rules can be
// unit tested on their own. A payment provider is expected to write into the
// subscription table; nothing in this package needs to change when one is added.
package plan

import (
	"fmt"
	"time"
)

// Plan is the tier a user is entitled to.
type Plan string

const (
	Free Plan = "free"
	Pro  Plan = "pro"
)

// Unlimited marks a limit that a plan does not enforce.
const Unlimited = -1

// Limits are the per-plan caps on the resources a user may hold.
type Limits struct {
	MaxTasks int
	MaxLists int
	MaxTags  int
}

var limitsByPlan = map[Plan]Limits{
	Free: {MaxTasks: 50, MaxLists: 3, MaxTags: 10},
	Pro:  {MaxTasks: Unlimited, MaxLists: Unlimited, MaxTags: Unlimited},
}

// LimitsFor returns the caps for a plan. An unknown plan is treated as Free so
// that a bad or missing value can never grant more than the free tier allows.
func LimitsFor(p Plan) Limits {
	if l, ok := limitsByPlan[p]; ok {
		return l
	}
	return limitsByPlan[Free]
}

// Resource is a countable thing a plan can cap.
type Resource string

const (
	ResourceTask Resource = "tasks"
	ResourceList Resource = "lists"
	ResourceTag  Resource = "tags"
)

// LimitError reports that a plan's cap for a resource has been reached.
type LimitError struct {
	Resource Resource
	Limit    int
	Plan     Plan
}

func (e *LimitError) Error() string {
	return fmt.Sprintf("plan %s allows at most %d %s", e.Plan, e.Limit, e.Resource)
}

// cap returns the cap for a single resource, resolving whether the caller is
// asking for tasks, lists or tags.
func (l Limits) cap(r Resource) int {
	switch r {
	case ResourceTask:
		return l.MaxTasks
	case ResourceList:
		return l.MaxLists
	case ResourceTag:
		return l.MaxTags
	default:
		return Unlimited
	}
}

// Check reports whether creating one more of r is allowed given the current
// number the user already holds. The comparison is on the count before the
// insert, so reaching the cap exactly is allowed and the next one is refused.
func (l Limits) Check(p Plan, r Resource, current int) error {
	limit := l.cap(r)
	if limit == Unlimited {
		return nil
	}
	if current >= limit {
		return &LimitError{Resource: r, Limit: limit, Plan: p}
	}
	return nil
}

// Subscription is the stored entitlement row for a user, reduced to the fields
// that decide what the plan resolves to right now.
type Subscription struct {
	Plan      Plan
	Status    string
	ExpiresAt *time.Time
}

// Effective resolves the plan a request should be evaluated against. A pro
// subscription that was cancelled, or whose expiry has passed, is entitled to
// nothing beyond free. A nil ExpiresAt means the subscription does not expire.
func Effective(s Subscription, now time.Time) Plan {
	if s.Plan != Pro || s.Status != "active" {
		return Free
	}
	if s.ExpiresAt != nil && !s.ExpiresAt.After(now) {
		return Free
	}
	return Pro
}
