package model

import (
	"database/sql"
	"encoding/json"
)

type User struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Name   string `json:"name"`
	Role   string `json:"role"`
	Status string `json:"status"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type TaskList struct {
	UserID    string `json:"user_id"`
	ListID    string `json:"list_id"`
	Name      string `json:"name"`
	Color     string `json:"color"`
	Icon      string `json:"icon"`
	SortOrder int    `json:"sort_order"`
	UpdatedAt int64  `json:"updated_at"`
	TaskCount *int   `json:"task_count,omitempty"`
}

type Task struct {
	UserID      string         `json:"user_id"`
	ListID      sql.NullString `json:"list_id"`
	TaskID      string         `json:"task_id"`
	Title       string         `json:"title"`
	Description string         `json:"description"`
	Priority    int            `json:"priority"`
	Status      string         `json:"status"`
	DueDate     *int64         `json:"due_date"`
	DueAllDay   bool           `json:"due_all_day"`
	DurationMs  *int64         `json:"duration_ms"`
	StartedAt   *int64         `json:"started_at"`
	ElapsedMs   int64          `json:"elapsed_ms"`
	CompletedAt *int64         `json:"completed_at"`
	SortOrder   int            `json:"sort_order"`
	UpdatedAt   int64          `json:"updated_at"`
	ListName    sql.NullString `json:"-"`
	ListColor   sql.NullString `json:"-"`
}

func (t Task) MarshalJSON() ([]byte, error) {
	type Alias Task
	return json.Marshal(&struct {
		Alias
		ListID    *string `json:"list_id"`
		ListName  *string `json:"list_name,omitempty"`
		ListColor *string `json:"list_color,omitempty"`
	}{
		Alias:     (Alias)(t),
		ListID:    nullStrPtr(t.ListID),
		ListName:  nullStrPtr(t.ListName),
		ListColor: nullStrPtr(t.ListColor),
	})
}

func nullStrPtr(ns sql.NullString) *string {
	if ns.Valid {
		return &ns.String
	}
	return nil
}

type Subtask struct {
	UserID    string `json:"user_id"`
	TaskID    string `json:"task_id"`
	SubtaskID string `json:"subtask_id"`
	Title     string `json:"title"`
	Completed bool   `json:"completed"`
	SortOrder int    `json:"sort_order"`
	UpdatedAt int64  `json:"updated_at"`
}

type Tag struct {
	UserID string `json:"user_id"`
	TagID  string `json:"tag_id"`
	Name   string `json:"name"`
	Color  string `json:"color"`
}

type TaskTag struct {
	UserID string `json:"user_id"`
	TaskID string `json:"task_id"`
	TagID  string `json:"tag_id"`
}

type TaskFull struct {
	Task
	Subtasks []Subtask `json:"subtasks"`
	Tags     []Tag     `json:"tags"`
}

// MarshalJSON is required because the embedded Task's MarshalJSON is promoted
// to TaskFull and would otherwise drop the subtasks and tags fields.
func (f TaskFull) MarshalJSON() ([]byte, error) {
	taskJSON, err := json.Marshal(f.Task)
	if err != nil {
		return nil, err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(taskJSON, &fields); err != nil {
		return nil, err
	}

	subtasks := f.Subtasks
	if subtasks == nil {
		subtasks = []Subtask{}
	}
	tags := f.Tags
	if tags == nil {
		tags = []Tag{}
	}
	if fields["subtasks"], err = json.Marshal(subtasks); err != nil {
		return nil, err
	}
	if fields["tags"], err = json.Marshal(tags); err != nil {
		return nil, err
	}
	return json.Marshal(fields)
}

type DashboardSummary struct {
	Pending    int `json:"pending"`
	InProgress int `json:"in_progress"`
	Completed  int `json:"completed"`
	Overdue    int `json:"overdue"`
}
