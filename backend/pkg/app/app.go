package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"planner/pkg/auth"
	"planner/pkg/model"
	"planner/pkg/store"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"
)

type App struct {
	store *store.Store
	auth  *auth.Manager
}

func New(s *store.Store, a *auth.Manager) *App {
	return &App{store: s, auth: a}
}

func (a *App) Handler() http.Handler {
	r := chi.NewRouter()

	r.Use(securityHeaders)
	r.Use(CORS())

	r.Route("/api", func(r chi.Router) {
		r.Post("/auth/register", a.register)
		r.Post("/auth/login", a.login)
		r.Group(func(r chi.Router) {
			r.Use(a.auth.Middleware)
			r.Get("/auth/me", a.me)

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

			// Dashboard
			r.Get("/dashboard", a.dashboard)

			// Classes
			r.Get("/classes", a.listClasses)
			r.Post("/classes", a.createClass)
			r.Put("/classes/{id}", a.updateClass)
			r.Delete("/classes/{id}", a.deleteClass)
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
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
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

	dataResp(w, http.StatusCreated, model.AuthResponse{Token: token, User: user})
}

func (a *App) login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
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

	dataResp(w, http.StatusOK, model.AuthResponse{Token: token, User: user})
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
	if err := decodeJSON(r, &l); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(l.Name) == "" {
		errResp(w, http.StatusBadRequest, "name is required")
		return
	}
	created, err := a.store.CreateTaskList(claims.UserID, l)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to create list")
		return
	}
	dataResp(w, http.StatusCreated, created)
}

func (a *App) updateList(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	listID := chi.URLParam(r, "id")
	var l model.TaskList
	if err := decodeJSON(r, &l); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
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
	if err := decodeJSON(r, &t); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(t.Title) == "" {
		errResp(w, http.StatusBadRequest, "title is required")
		return
	}
	created, err := a.store.CreateTask(claims.UserID, t)
	if err != nil {
		log.Printf("createTask error: %v", err)
		errResp(w, http.StatusInternalServerError, "failed to create task")
		return
	}
	dataResp(w, http.StatusCreated, created)
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
	if err := decodeJSON(r, &t); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(t.Title) == "" {
		errResp(w, http.StatusBadRequest, "title is required")
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
	errResp(w, http.StatusInternalServerError, failMsg)
	return true
}

func (a *App) startTask(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	if err := a.store.StartTask(claims.UserID, chi.URLParam(r, "id")); taskTransitionErrResp(w, err, "failed to start task") {
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"status": "in_progress"})
}

func (a *App) pauseTask(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	if err := a.store.PauseTask(claims.UserID, chi.URLParam(r, "id")); taskTransitionErrResp(w, err, "failed to pause task") {
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"status": "pending"})
}

func (a *App) completeTask(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	if err := a.store.CompleteTask(claims.UserID, chi.URLParam(r, "id")); taskTransitionErrResp(w, err, "failed to complete task") {
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
	var st model.Subtask
	if err := decodeJSON(r, &st); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(st.Title) == "" {
		errResp(w, http.StatusBadRequest, "title is required")
		return
	}
	created, err := a.store.CreateSubtask(claims.UserID, chi.URLParam(r, "id"), st)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to create subtask")
		return
	}
	dataResp(w, http.StatusCreated, created)
}

func (a *App) updateSubtask(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	var st model.Subtask
	if err := decodeJSON(r, &st); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
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
	if err := decodeJSON(r, &t); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(t.Name) == "" {
		errResp(w, http.StatusBadRequest, "name is required")
		return
	}
	created, err := a.store.CreateTag(claims.UserID, t)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to create tag")
		return
	}
	dataResp(w, http.StatusCreated, created)
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
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
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
	if err := decodeJSON(r, &c); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := model.ValidateClassSession(&c); err != nil {
		errResp(w, http.StatusBadRequest, err.Error())
		return
	}
	created, err := a.store.CreateClass(claims.UserID, c)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to create class")
		return
	}
	dataResp(w, http.StatusCreated, created)
}

func (a *App) updateClass(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	classID := chi.URLParam(r, "id")
	var c model.ClassSession
	if err := decodeJSON(r, &c); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
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
