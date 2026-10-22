package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"planner/pkg/auth"
	"planner/pkg/config"
	"planner/pkg/model"
	"planner/pkg/plan"
	"planner/pkg/store"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"
)

type App struct {
	store *store.Store
	auth  *auth.Manager

	// refreshTTL is the lifetime of newly issued refresh tokens.
	refreshTTL time.Duration
}

func New(s *store.Store, a *auth.Manager) *App {
	// Load(false) never fails; it only reads REFRESH_TTL_DAYS (default 90).
	cfg, _ := config.Load(false)
	return &App{store: s, auth: a, refreshTTL: time.Duration(cfg.RefreshTTLDays) * 24 * time.Hour}
}

func (a *App) Handler() http.Handler {
	r := chi.NewRouter()

	r.Use(securityHeaders)
	r.Use(CORS())

	r.Route("/api", func(r chi.Router) {
		r.Use(maxBodySize)
		r.Post("/auth/register", a.register)
		r.Post("/auth/login", a.login)
		r.Post("/auth/refresh", a.refresh)
		r.Post("/auth/logout", a.logout)
		r.Group(func(r chi.Router) {
			r.Use(a.auth.Middleware)
			r.Get("/auth/me", a.me)
			r.Get("/subscription", a.subscription)

			// Lists
			r.Get("/lists", a.listLists)
			r.Post("/lists", a.createList)
			r.Put("/lists/{id}", a.updateList)
			r.Delete("/lists/{id}", a.deleteList)

			// Tasks
			r.Get("/tasks", a.listTasks)
			r.Post("/tasks", a.createTask)
			r.Get("/tasks/{id}", a.getTask)
			r.Put("/tasks/{id}", a.updateTask)
			r.Delete("/tasks/{id}", a.deleteTask)
			r.Put("/tasks/{id}/start", a.startTask)
			r.Put("/tasks/{id}/pause", a.pauseTask)
			r.Put("/tasks/{id}/complete", a.completeTask)

			// Subtasks
			r.Get("/tasks/{id}/subtasks", a.listSubtasks)
			r.Post("/tasks/{id}/subtasks", a.createSubtask)
			r.Put("/tasks/{id}/subtasks/{sid}", a.updateSubtask)
			r.Delete("/tasks/{id}/subtasks/{sid}", a.deleteSubtask)

			// Tags
			r.Get("/tags", a.listTags)
			r.Post("/tags", a.createTag)
			r.Delete("/tags/{id}", a.deleteTag)
			r.Post("/tasks/{id}/tags", a.addTaskTag)
			r.Delete("/tasks/{id}/tags/{tagId}", a.removeTaskTag)

			// Sync
			r.Get("/sync", a.syncPull)

			// Dashboard
			r.Get("/dashboard", a.dashboard)

			// Classes
			r.Get("/classes", a.listClasses)
			r.Post("/classes", a.createClass)
			r.Put("/classes/{id}", a.updateClass)
			r.Delete("/classes/{id}", a.deleteClass)

			// Events
			r.Get("/events", a.listEvents)
			r.Post("/events", a.createEvent)
			r.Get("/events/{id}", a.getEvent)
			r.Put("/events/{id}", a.updateEvent)
			r.Delete("/events/{id}", a.deleteEvent)
		})
	})

	return r
}

// --- helpers ---

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func dataResp(w http.ResponseWriter, status int, v any) {
	writeJSON(w, status, map[string]any{"data": v})
}

func paginatedResp(w http.ResponseWriter, status int, data any, total, limit, offset int) {
	writeJSON(w, status, map[string]any{
		"data":   data,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func errResp(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func decodeJSON(r *http.Request, v any) error {
	return json.NewDecoder(r.Body).Decode(v)
}

// decodeJSONOrRespond decodes the request body as JSON into v. On failure it
// writes the response itself and returns false, so callers should `return`
// immediately: a body over maxRequestBodyBytes (capped by the maxBodySize
// middleware) answers 413, since that is the client sending too much data
// rather than sending a malformed request; any other decode failure answers
// 400 as before.
func decodeJSONOrRespond(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := decodeJSON(r, v); err != nil {
		var mbErr *http.MaxBytesError
		if errors.As(err, &mbErr) {
			errResp(w, http.StatusRequestEntityTooLarge, "request body too large")
			return false
		}
		errResp(w, http.StatusBadRequest, "invalid request body")
		return false
	}
	return true
}

// parseDateRange reads the optional `from` and `to` query params as epoch-ms
// integers. Either may be absent (nil). It rejects a non-integer value, a
// negative value, and a `from` that is not strictly less than `to` when both
// are present.
func parseDateRange(q url.Values) (from, to *int64, err error) {
	if v := q.Get("from"); v != "" {
		n, parseErr := strconv.ParseInt(v, 10, 64)
		if parseErr != nil || n < 0 {
			return nil, nil, fmt.Errorf("from must be a non-negative integer")
		}
		from = &n
	}
	if v := q.Get("to"); v != "" {
		n, parseErr := strconv.ParseInt(v, 10, 64)
		if parseErr != nil || n < 0 {
			return nil, nil, fmt.Errorf("to must be a non-negative integer")
		}
		to = &n
	}
	if from != nil && to != nil && *from >= *to {
		return nil, nil, fmt.Errorf("from must be less than to")
	}
	return from, to, nil
}

func parsePagination(r *http.Request) (limit, offset int) {
	limit = 50
	offset = 0
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}
	return
}

// --- middleware ---

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		next.ServeHTTP(w, r)
	})
}

// maxRequestBodyBytes bounds how much of a request body the server will
// read. Without it, a client could make the database (and, via decodeJSON,
// server memory) do unbounded work from a single oversized request, no
// matter how small the per-field length limits are.
const maxRequestBodyBytes = 64 * 1024 // 64 KiB

// maxBodySize wraps the request body so reading past maxRequestBodyBytes
// fails with a *http.MaxBytesError, which decodeJSONOrRespond recognizes and
// answers with 413 instead of a generic 400.
func maxBodySize(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)
		next.ServeHTTP(w, r)
	})
}

func CORS() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// --- auth handlers ---

func (a *App) register(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Name     string `json:"name"`
		Password string `json:"password"`
	}
	if !decodeJSONOrRespond(w, r, &req) {
		return
	}
	if req.Email == "" || req.Password == "" {
		errResp(w, http.StatusBadRequest, "email and password are required")
		return
	}

	if req.Name == "" {
		req.Name = req.Email
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	user, err := a.store.Register(req.Email, req.Name, string(hash))
	if err != nil {
		log.Printf("register error: %v", err)
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}

	token, err := a.auth.Generate(user.UserID, user.Email, user.Role)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	refreshToken, err := a.store.IssueRefreshToken(user.UserID, a.refreshTTL)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to issue refresh token")
		return
	}

	dataResp(w, http.StatusCreated, model.AuthResponse{Token: token, User: user, RefreshToken: refreshToken})
}

func (a *App) login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decodeJSONOrRespond(w, r, &req) {
		return
	}

	user, hash, err := a.store.GetUserByEmailWithHash(req.Email)
	if err != nil {
		errResp(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
		errResp(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	token, err := a.auth.Generate(user.UserID, user.Email, user.Role)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	refreshToken, err := a.store.IssueRefreshToken(user.UserID, a.refreshTTL)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to issue refresh token")
		return
	}

	dataResp(w, http.StatusOK, model.AuthResponse{Token: token, User: user, RefreshToken: refreshToken})
}

func (a *App) me(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	user, err := a.store.GetUserByID(claims.UserID)
	if err != nil {
		errResp(w, http.StatusNotFound, "user not found")
		return
	}
	dataResp(w, http.StatusOK, user)
}

// enforceLimit resolves the caller's effective plan, refuses the create with
// 402 if that plan's own cap for the resource is already reached, and then
// refuses it with 409 if the resource's hard storage ceiling -- which
// applies to every plan alike and is never lifted by upgrading -- is already
// reached. It returns false after having written the error response, so
// callers should `return` immediately.
//
// For tasks, lists and tags, the Free-plan cap and the ceiling compare against
// two different counts (active vs. every row the user owns), so both are read
// in one round trip via CountTasksUsage/CountListsUsage/CountTagsUsage rather
// than querying the same table twice.
func (a *App) enforceLimit(w http.ResponseWriter, r *http.Request, resource plan.Resource) bool {
	claims := auth.GetUser(r)

	sub, err := a.store.GetSubscription(claims.UserID)
	if err != nil {
		log.Printf("get subscription for %s: %v", claims.UserID, err)
		errResp(w, http.StatusInternalServerError, "failed to resolve plan")
		return false
	}

	effective := plan.Effective(plan.Subscription{
		Plan:      plan.Plan(sub.Plan),
		Status:    sub.Status,
		ExpiresAt: sub.ExpiresAt,
	}, time.Now())

	var active, total int
	switch resource {
	case plan.ResourceTask:
		var usage store.TaskUsage
		usage, err = a.store.CountTasksUsage(claims.UserID)
		active, total = usage.Active, usage.Total
	case plan.ResourceList:
		var usage store.ListUsage
		usage, err = a.store.CountListsUsage(claims.UserID)
		active, total = usage.Active, usage.Total
	case plan.ResourceTag:
		var usage store.TagUsage
		usage, err = a.store.CountTagsUsage(claims.UserID)
		active, total = usage.Active, usage.Total
	}
	if err != nil {
		log.Printf("count %s for %s: %v", resource, claims.UserID, err)
		errResp(w, http.StatusInternalServerError, "failed to resolve usage")
		return false
	}

	if err := plan.LimitsFor(effective).Check(effective, resource, active); err != nil {
		var le *plan.LimitError
		if errors.As(err, &le) {
			errResp(w, http.StatusPaymentRequired, le.Error())
			return false
		}
		log.Printf("check %s limit for %s: %v", resource, claims.UserID, err)
		errResp(w, http.StatusInternalServerError, "failed to check plan limits")
		return false
	}

	return a.enforceCeiling(w, resource, total)
}

// enforceCeiling refuses the create with 409 Conflict if resource's hard
// storage ceiling is already reached, given the total count of rows the
// user (or, for a per-parent ceiling such as subtasks, the parent) already
// owns -- callers must count every row, including completed and
// soft-deleted ones, since the ceiling exists specifically to bound those
// too. It returns false after writing the error response, so callers should
// `return` immediately.
//
// 409 rather than 402: the account is valid and the plan may even be Pro,
// but the ceiling is not something upgrading lifts, so it must not be
// confused with a plan-limit refusal.
func (a *App) enforceCeiling(w http.ResponseWriter, resource plan.Resource, total int) bool {
	if err := plan.CheckCeiling(resource, total); err != nil {
		var ce *plan.CeilingError
		if errors.As(err, &ce) {
			errResp(w, http.StatusConflict, ce.Error())
			return false
		}
		errResp(w, http.StatusInternalServerError, "failed to check storage limits")
		return false
	}
	return true
}

// guardSubtask, guardClass and guardEvent are the create guards for the
// resources that only have a storage ceiling (no plan cap): they count what
// the user (or parent task) owns and refuse with 409 at the ceiling. Like
// enforceCeiling they write the error response and return false. Shared by the
// create handlers and sync push.
func (a *App) guardSubtask(w http.ResponseWriter, userID, taskID string) bool {
	total, err := a.store.CountSubtasks(userID, taskID)
	if err != nil {
		log.Printf("count subtasks for %s/%s: %v", userID, taskID, err)
		errResp(w, http.StatusInternalServerError, "failed to resolve usage")
		return false
	}
	return a.enforceCeiling(w, plan.ResourceSubtask, total)
}

func (a *App) guardClass(w http.ResponseWriter, userID string) bool {
	total, err := a.store.CountClasses(userID)
	if err != nil {
		log.Printf("count classes for %s: %v", userID, err)
		errResp(w, http.StatusInternalServerError, "failed to resolve usage")
		return false
	}
	return a.enforceCeiling(w, plan.ResourceClass, total)
}

func (a *App) guardEvent(w http.ResponseWriter, userID string) bool {
	total, err := a.store.CountEvents(userID)
	if err != nil {
		log.Printf("count events for %s: %v", userID, err)
		errResp(w, http.StatusInternalServerError, "failed to resolve usage")
		return false
	}
	return a.enforceCeiling(w, plan.ResourceEvent, total)
}

// createIdempotent runs a create so an offline client can replay it safely.
// With a client-supplied id it first looks the row up: the caller's own live
// row is returned as 200 without touching the stored data, and an id owned by
// another user or already soft-deleted is a 409 that reveals nothing about the
// row. Only a genuinely new create reaches guard (the plan-limit and
// storage-ceiling checks, which write their own response and return false),
// so replaying an already-applied create is never refused by a cap. If the
// insert itself loses a race for the id, the winner is looked up again.
func createIdempotent[T any](w http.ResponseWriter, id string, find func() (T, error), guard func() bool, create func() (T, error), failMsg string) {
	if id != "" {
		if replayed(w, find) {
			return
		}
	}
	if !guard() {
		return
	}
	created, err := create()
	if errors.Is(err, store.ErrConflict) && id != "" {
		if replayed(w, find) {
			return
		}
	}
	if err != nil {
		log.Printf("%s: %v", failMsg, err)
		errResp(w, http.StatusInternalServerError, failMsg)
		return
	}
	dataResp(w, http.StatusCreated, created)
}

// replayed answers a create whose id may already exist. It returns true after
// writing the response (200 existing row, 409 conflict, or 500), and false
// when the id is free and the create should proceed.
func replayed[T any](w http.ResponseWriter, find func() (T, error)) bool {
	existing, err := find()
	switch {
	case err == nil:
		dataResp(w, http.StatusOK, existing)
	case errors.Is(err, store.ErrConflict):
		errResp(w, http.StatusConflict, "id already in use")
	case errors.Is(err, store.ErrNotFound):
		return false
	default:
		log.Printf("look up existing row: %v", err)
		errResp(w, http.StatusInternalServerError, "failed to create")
	}
	return true
}

// planView builds the entitlement payload the client uses to render the plan
// badge, the caps and the remaining headroom for each resource.
func (a *App) planView(userID string) (model.PlanView, error) {
	sub, err := a.store.GetSubscription(userID)
	if err != nil {
		return model.PlanView{}, err
	}
	effective := plan.Effective(plan.Subscription{
		Plan:      plan.Plan(sub.Plan),
		Status:    sub.Status,
		ExpiresAt: sub.ExpiresAt,
	}, time.Now())
	limits := plan.LimitsFor(effective)

	tasks, err := a.store.CountActiveTasks(userID)
	if err != nil {
		return model.PlanView{}, err
	}
	lists, err := a.store.CountLists(userID)
	if err != nil {
		return model.PlanView{}, err
	}
	tags, err := a.store.CountTags(userID)
	if err != nil {
		return model.PlanView{}, err
	}

	remaining := map[string]int{
		string(plan.ResourceTask): headroom(limits.MaxTasks, tasks),
		string(plan.ResourceList): headroom(limits.MaxLists, lists),
		string(plan.ResourceTag):  headroom(limits.MaxTags, tags),
	}
	return model.PlanView{
		Plan: string(effective),
		Limits: model.PlanLimits{
			MaxTasks: limits.MaxTasks,
			MaxLists: limits.MaxLists,
			MaxTags:  limits.MaxTags,
		},
		Usage: model.PlanUsage{
			ActiveTasks: tasks,
			Lists:       lists,
			Tags:        tags,
		},
		Upgrades: remaining,
	}, nil
}

// headroom reports how much room is left before a cap, or -1 when uncapped.
func headroom(limit, used int) int {
	if limit == plan.Unlimited {
		return plan.Unlimited
	}
	if remaining := limit - used; remaining > 0 {
		return remaining
	}
	return 0
}

func (a *App) subscription(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	view, err := a.planView(claims.UserID)
	if err != nil {
		log.Printf("subscription error: %v", err)
		errResp(w, http.StatusInternalServerError, "failed to resolve plan")
		return
	}
	dataResp(w, http.StatusOK, view)
}

// --- lists ---

func (a *App) listLists(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	items, err := a.store.ListTaskLists(claims.UserID)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list lists")
		return
	}
	if items == nil {
		items = []model.TaskList{}
	}
	dataResp(w, http.StatusOK, items)
}

func (a *App) createList(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	var l model.TaskList
	if !decodeJSONOrRespond(w, r, &l) {
		return
	}
	if err := model.ValidateTaskList(&l); err != nil {
		errResp(w, http.StatusBadRequest, err.Error())
		return
	}
	createIdempotent(w, l.ListID,
		func() (model.TaskList, error) { return a.store.ReplayTaskList(claims.UserID, l.ListID) },
		func() bool { return a.enforceLimit(w, r, plan.ResourceList) },
		func() (model.TaskList, error) { return a.store.CreateTaskList(claims.UserID, l) },
		"failed to create list")
}

func (a *App) updateList(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	listID := chi.URLParam(r, "id")
	var l model.TaskList
	if !decodeJSONOrRespond(w, r, &l) {
		return
	}
	if err := model.ValidateTaskList(&l); err != nil {
		errResp(w, http.StatusBadRequest, err.Error())
		return
	}
	l.ListID = listID
	if err := a.store.UpdateTaskList(claims.UserID, l); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to update list")
		return
	}
	dataResp(w, http.StatusOK, l)
}

func (a *App) deleteList(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	if err := a.store.DeleteTaskList(claims.UserID, chi.URLParam(r, "id")); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to delete list")
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// --- tasks ---

func (a *App) listTasks(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)
	from, to, err := parseDateRange(r.URL.Query())
	if err != nil {
		errResp(w, http.StatusBadRequest, err.Error())
		return
	}
	claims := auth.GetUser(r)
	filters := store.TaskFilters{
		Status: r.URL.Query().Get("status"),
		ListID: r.URL.Query().Get("list_id"),
		Search: r.URL.Query().Get("search"),
		From:   from,
		To:     to,
	}
	tasks, total, err := a.store.ListTasks(claims.UserID, filters, limit, offset)
	if err != nil {
		log.Printf("listTasks error: %v", err)
		errResp(w, http.StatusInternalServerError, "failed to list tasks")
		return
	}
	if tasks == nil {
		tasks = []model.Task{}
	}
	paginatedResp(w, http.StatusOK, tasks, total, limit, offset)
}

func (a *App) createTask(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	var t model.Task
	if !decodeJSONOrRespond(w, r, &t) {
		return
	}
	if err := model.ValidateTask(&t); err != nil {
		errResp(w, http.StatusBadRequest, err.Error())
		return
	}
	createIdempotent(w, t.TaskID,
		func() (model.Task, error) { return a.store.ReplayTask(claims.UserID, t.TaskID) },
		func() bool { return a.enforceLimit(w, r, plan.ResourceTask) },
		func() (model.Task, error) { return a.store.CreateTask(claims.UserID, t) },
		"failed to create task")
}

func (a *App) getTask(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	task, err := a.store.GetTaskFull(claims.UserID, chi.URLParam(r, "id"))
	if err != nil {
		errResp(w, http.StatusNotFound, "task not found")
		return
	}
	dataResp(w, http.StatusOK, task)
}

func (a *App) updateTask(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	taskID := chi.URLParam(r, "id")
	var t model.Task
	if !decodeJSONOrRespond(w, r, &t) {
		return
	}
	if err := model.ValidateTask(&t); err != nil {
		errResp(w, http.StatusBadRequest, err.Error())
		return
	}
	t.TaskID = taskID
	if err := a.store.UpdateTask(claims.UserID, t); taskTransitionErrResp(w, err, "failed to update task") {
		return
	}
	// The update just confirmed the row exists, so a read-back failure is a
	// server error, never a missing task.
	updated, err := a.store.GetTaskFull(claims.UserID, taskID)
	if err != nil {
		log.Printf("updateTask read-back error: %v", err)
		errResp(w, http.StatusInternalServerError, "failed to load updated task")
		return
	}
	dataResp(w, http.StatusOK, updated)
}

func (a *App) deleteTask(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	if err := a.store.DeleteTask(claims.UserID, chi.URLParam(r, "id")); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to delete task")
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// taskTransitionErrResp maps a task state-transition error to the matching
// HTTP response: 404 for a missing task, 409 for a valid task in the wrong
// state to transition, 500 otherwise. It returns true if it wrote a
// response (i.e. err was non-nil).
func taskTransitionErrResp(w http.ResponseWriter, err error, failMsg string) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, store.ErrNotFound) {
		errResp(w, http.StatusNotFound, "task not found")
		return true
	}
	if errors.Is(err, store.ErrInvalidTransition) {
		errResp(w, http.StatusConflict, "task cannot transition from its current status")
		return true
	}
	if errors.Is(err, store.ErrInvalidTime) {
		errResp(w, http.StatusBadRequest, "at is too far in the future")
		return true
	}
	errResp(w, http.StatusInternalServerError, failMsg)
	return true
}

// transitionAt reads the optional {"at": unix ms} body of a task transition,
// the moment the action really happened (an offline replay). No body, or no
// "at", yields 0, which the store reads as the server's current time. On a bad
// body it writes the response itself and returns false.
func transitionAt(w http.ResponseWriter, r *http.Request) (int64, bool) {
	var body struct {
		At *int64 `json:"at"`
	}
	if err := decodeJSON(r, &body); err != nil && !errors.Is(err, io.EOF) {
		var mbErr *http.MaxBytesError
		if errors.As(err, &mbErr) {
			errResp(w, http.StatusRequestEntityTooLarge, "request body too large")
		} else {
			errResp(w, http.StatusBadRequest, "invalid request body")
		}
		return 0, false
	}
	if body.At == nil {
		return 0, true
	}
	if *body.At <= 0 {
		errResp(w, http.StatusBadRequest, "at must be a positive unix timestamp in milliseconds")
		return 0, false
	}
	return *body.At, true
}

func (a *App) startTask(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	at, ok := transitionAt(w, r)
	if !ok {
		return
	}
	if err := a.store.StartTask(claims.UserID, chi.URLParam(r, "id"), at); taskTransitionErrResp(w, err, "failed to start task") {
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"status": "in_progress"})
}

func (a *App) pauseTask(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	at, ok := transitionAt(w, r)
	if !ok {
		return
	}
	if err := a.store.PauseTask(claims.UserID, chi.URLParam(r, "id"), at); taskTransitionErrResp(w, err, "failed to pause task") {
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"status": "pending"})
}

func (a *App) completeTask(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	at, ok := transitionAt(w, r)
	if !ok {
		return
	}
	if err := a.store.CompleteTask(claims.UserID, chi.URLParam(r, "id"), at); taskTransitionErrResp(w, err, "failed to complete task") {
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"status": "completed"})
}

// --- subtasks ---

func (a *App) listSubtasks(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	limit, offset := parsePagination(r)
	items, total, err := a.store.ListSubtasks(claims.UserID, chi.URLParam(r, "id"), limit, offset)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list subtasks")
		return
	}
	if items == nil {
		items = []model.Subtask{}
	}
	paginatedResp(w, http.StatusOK, items, total, limit, offset)
}

func (a *App) createSubtask(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	taskID := chi.URLParam(r, "id")
	var st model.Subtask
	if !decodeJSONOrRespond(w, r, &st) {
		return
	}
	if err := model.ValidateSubtask(&st); err != nil {
		errResp(w, http.StatusBadRequest, err.Error())
		return
	}
	createIdempotent(w, st.SubtaskID,
		func() (model.Subtask, error) { return a.store.ReplaySubtask(claims.UserID, taskID, st.SubtaskID) },
		func() bool {
			total, err := a.store.CountSubtasks(claims.UserID, taskID)
			if err != nil {
				log.Printf("count subtasks for %s/%s: %v", claims.UserID, taskID, err)
				errResp(w, http.StatusInternalServerError, "failed to resolve usage")
				return false
			}
			return a.enforceCeiling(w, plan.ResourceSubtask, total)
		},
		func() (model.Subtask, error) { return a.store.CreateSubtask(claims.UserID, taskID, st) },
		"failed to create subtask")
}

func (a *App) updateSubtask(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	var st model.Subtask
	if !decodeJSONOrRespond(w, r, &st) {
		return
	}
	if err := model.ValidateSubtask(&st); err != nil {
		errResp(w, http.StatusBadRequest, err.Error())
		return
	}
	st.SubtaskID = chi.URLParam(r, "sid")
	if err := a.store.UpdateSubtask(claims.UserID, chi.URLParam(r, "id"), st); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to update subtask")
		return
	}
	dataResp(w, http.StatusOK, st)
}

func (a *App) deleteSubtask(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	if err := a.store.DeleteSubtask(claims.UserID, chi.URLParam(r, "id"), chi.URLParam(r, "sid")); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to delete subtask")
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// --- tags ---

func (a *App) listTags(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	items, err := a.store.ListTags(claims.UserID)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list tags")
		return
	}
	if items == nil {
		items = []model.Tag{}
	}
	dataResp(w, http.StatusOK, items)
}

func (a *App) createTag(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	var t model.Tag
	if !decodeJSONOrRespond(w, r, &t) {
		return
	}
	if err := model.ValidateTag(&t); err != nil {
		errResp(w, http.StatusBadRequest, err.Error())
		return
	}
	createIdempotent(w, t.TagID,
		func() (model.Tag, error) { return a.store.ReplayTag(claims.UserID, t.TagID) },
		func() bool { return a.enforceLimit(w, r, plan.ResourceTag) },
		func() (model.Tag, error) { return a.store.CreateTag(claims.UserID, t) },
		"failed to create tag")
}

func (a *App) deleteTag(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	if err := a.store.DeleteTag(claims.UserID, chi.URLParam(r, "id")); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to delete tag")
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}

func (a *App) addTaskTag(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	var req struct {
		TagID string `json:"tag_id"`
	}
	if !decodeJSONOrRespond(w, r, &req) {
		return
	}
	if err := a.store.AddTaskTag(claims.UserID, chi.URLParam(r, "id"), req.TagID); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to add tag")
		return
	}
	dataResp(w, http.StatusCreated, map[string]string{"message": "tag added"})
}

func (a *App) removeTaskTag(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	if err := a.store.RemoveTaskTag(claims.UserID, chi.URLParam(r, "id"), chi.URLParam(r, "tagId")); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to remove tag")
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"message": "tag removed"})
}

// --- dashboard ---

func (a *App) dashboard(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)

	summary, err := a.store.GetDashboardSummary(claims.UserID)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to get dashboard")
		return
	}

	// Get in-progress tasks (with active timers)
	inProgress, _, err := a.store.ListTasks(claims.UserID, store.TaskFilters{Status: "in_progress"}, 10, 0)
	if err != nil {
		log.Printf("dashboard: list in-progress tasks: %v", err)
		errResp(w, http.StatusInternalServerError, "failed to get dashboard")
		return
	}
	if inProgress == nil {
		inProgress = []model.Task{}
	}

	// Get overdue tasks
	overdue, _, err := a.store.ListTasks(claims.UserID, store.TaskFilters{Status: "overdue"}, 10, 0)
	if err != nil {
		log.Printf("dashboard: list overdue tasks: %v", err)
		errResp(w, http.StatusInternalServerError, "failed to get dashboard")
		return
	}
	if overdue == nil {
		overdue = []model.Task{}
	}

	// Get upcoming tasks (due in next 24h)
	upcoming := []model.Task{}
	allPending, _, err := a.store.ListTasks(claims.UserID, store.TaskFilters{Status: "pending"}, 100, 0)
	if err != nil {
		log.Printf("dashboard: list pending tasks: %v", err)
		errResp(w, http.StatusInternalServerError, "failed to get dashboard")
		return
	}
	now := time.Now().UnixMilli()
	dayMs := store.DayMs
	for _, t := range allPending {
		if t.DueDate != nil && *t.DueDate > now && *t.DueDate < now+dayMs {
			upcoming = append(upcoming, t)
		}
	}

	dataResp(w, http.StatusOK, map[string]any{
		"summary":  summary,
		"active":   inProgress,
		"overdue":  overdue,
		"upcoming": upcoming,
	})
}

// --- classes ---

func (a *App) listClasses(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)

	var dayPtr *int
	if v := r.URL.Query().Get("day"); v != "" {
		d, err := strconv.Atoi(v)
		if err != nil || d < 0 || d > 6 {
			errResp(w, http.StatusBadRequest, "day must be between 0 and 6")
			return
		}
		dayPtr = &d
	}

	items, err := a.store.ListClasses(claims.UserID, dayPtr)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list classes")
		return
	}
	if items == nil {
		items = []model.ClassSession{}
	}
	dataResp(w, http.StatusOK, items)
}

func (a *App) createClass(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	var c model.ClassSession
	if !decodeJSONOrRespond(w, r, &c) {
		return
	}
	if err := model.ValidateClassSession(&c); err != nil {
		errResp(w, http.StatusBadRequest, err.Error())
		return
	}
	createIdempotent(w, c.ClassID,
		func() (model.ClassSession, error) { return a.store.ReplayClass(claims.UserID, c.ClassID) },
		func() bool {
			total, err := a.store.CountClasses(claims.UserID)
			if err != nil {
				log.Printf("count classes for %s: %v", claims.UserID, err)
				errResp(w, http.StatusInternalServerError, "failed to resolve usage")
				return false
			}
			return a.enforceCeiling(w, plan.ResourceClass, total)
		},
		func() (model.ClassSession, error) { return a.store.CreateClass(claims.UserID, c) },
		"failed to create class")
}

func (a *App) updateClass(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	classID := chi.URLParam(r, "id")
	var c model.ClassSession
	if !decodeJSONOrRespond(w, r, &c) {
		return
	}
	c.ClassID = classID
	if err := model.ValidateClassSession(&c); err != nil {
		errResp(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := a.store.UpdateClass(claims.UserID, c); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			errResp(w, http.StatusNotFound, "class not found")
			return
		}
		errResp(w, http.StatusInternalServerError, "failed to update class")
		return
	}
	dataResp(w, http.StatusOK, c)
}

func (a *App) deleteClass(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	if err := a.store.DeleteClass(claims.UserID, chi.URLParam(r, "id")); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			errResp(w, http.StatusNotFound, "class not found")
			return
		}
		errResp(w, http.StatusInternalServerError, "failed to delete class")
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// --- events ---

func (a *App) listEvents(w http.ResponseWriter, r *http.Request) {
	from, to, err := parseDateRange(r.URL.Query())
	if err != nil {
		errResp(w, http.StatusBadRequest, err.Error())
		return
	}
	claims := auth.GetUser(r)
	items, err := a.store.ListEvents(claims.UserID, from, to)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list events")
		return
	}
	if items == nil {
		items = []model.Event{}
	}
	dataResp(w, http.StatusOK, items)
}

func (a *App) getEvent(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	e, err := a.store.GetEvent(claims.UserID, chi.URLParam(r, "id"))
	if err != nil {
		errResp(w, http.StatusNotFound, "event not found")
		return
	}
	dataResp(w, http.StatusOK, e)
}

func (a *App) createEvent(w http.ResponseWriter, r *http.Request) {
	var e model.Event
	if !decodeJSONOrRespond(w, r, &e) {
		return
	}
	if err := model.ValidateEvent(&e); err != nil {
		errResp(w, http.StatusBadRequest, err.Error())
		return
	}
	claims := auth.GetUser(r)
	createIdempotent(w, e.EventID,
		func() (model.Event, error) { return a.store.ReplayEvent(claims.UserID, e.EventID) },
		func() bool {
			total, err := a.store.CountEvents(claims.UserID)
			if err != nil {
				log.Printf("count events for %s: %v", claims.UserID, err)
				errResp(w, http.StatusInternalServerError, "failed to resolve usage")
				return false
			}
			return a.enforceCeiling(w, plan.ResourceEvent, total)
		},
		func() (model.Event, error) { return a.store.CreateEvent(claims.UserID, e) },
		"failed to create event")
}

func (a *App) updateEvent(w http.ResponseWriter, r *http.Request) {
	var e model.Event
	if !decodeJSONOrRespond(w, r, &e) {
		return
	}
	e.EventID = chi.URLParam(r, "id")
	if err := model.ValidateEvent(&e); err != nil {
		errResp(w, http.StatusBadRequest, err.Error())
		return
	}
	claims := auth.GetUser(r)
	if err := a.store.UpdateEvent(claims.UserID, e); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			errResp(w, http.StatusNotFound, "event not found")
			return
		}
		errResp(w, http.StatusInternalServerError, "failed to update event")
		return
	}
	updated, err := a.store.GetEvent(claims.UserID, e.EventID)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to load updated event")
		return
	}
	dataResp(w, http.StatusOK, updated)
}

func (a *App) deleteEvent(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	if err := a.store.DeleteEvent(claims.UserID, chi.URLParam(r, "id")); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			errResp(w, http.StatusNotFound, "event not found")
			return
		}
		errResp(w, http.StatusInternalServerError, "failed to delete event")
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}
