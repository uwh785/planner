package model

import (
	"database/sql"
	"encoding/json"
	"testing"
)

func TestTaskFullMarshalJSONIncludesSubtasksAndTags(t *testing.T) {
	full := TaskFull{
		Task: Task{
			TaskID:   "tsk_1",
			Title:    "Task",
			ListID:   sql.NullString{String: "lst_1", Valid: true},
			ListName: sql.NullString{String: "Inbox", Valid: true},
		},
		Subtasks: []Subtask{{SubtaskID: "sub_1", Title: "Sub"}},
		Tags:     []Tag{{TagID: "tag_1", Name: "Work"}},
	}

	raw, err := json.Marshal(full)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got struct {
		TaskID   string    `json:"task_id"`
		ListID   *string   `json:"list_id"`
		ListName *string   `json:"list_name"`
		Subtasks []Subtask `json:"subtasks"`
		Tags     []Tag     `json:"tags"`
	}
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if got.TaskID != "tsk_1" {
		t.Errorf("task_id = %q, want tsk_1", got.TaskID)
	}
	if got.ListID == nil || *got.ListID != "lst_1" {
		t.Errorf("list_id = %v, want lst_1", got.ListID)
	}
	if got.ListName == nil || *got.ListName != "Inbox" {
		t.Errorf("list_name = %v, want Inbox", got.ListName)
	}
	if len(got.Subtasks) != 1 || got.Subtasks[0].SubtaskID != "sub_1" {
		t.Errorf("subtasks = %+v, want one subtask sub_1", got.Subtasks)
	}
	if len(got.Tags) != 1 || got.Tags[0].TagID != "tag_1" {
		t.Errorf("tags = %+v, want one tag tag_1", got.Tags)
	}
}

func TestTaskMarshalJSONIncludesDueAllDay(t *testing.T) {
	tests := []struct {
		name       string
		dueAllDay  bool
		wantEncode string
	}{
		{name: "false", dueAllDay: false, wantEncode: "false"},
		{name: "true", dueAllDay: true, wantEncode: "true"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			raw, err := json.Marshal(Task{TaskID: "tsk_1", DueAllDay: tt.dueAllDay})
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			var got map[string]json.RawMessage
			if err := json.Unmarshal(raw, &got); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if string(got["due_all_day"]) != tt.wantEncode {
				t.Errorf("due_all_day = %s, want %s", got["due_all_day"], tt.wantEncode)
			}
		})
	}
}

func TestTaskFullMarshalJSONIncludesDueAllDay(t *testing.T) {
	full := TaskFull{Task: Task{TaskID: "tsk_1", DueAllDay: true}}

	raw, err := json.Marshal(full)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got map[string]json.RawMessage
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if string(got["due_all_day"]) != "true" {
		t.Errorf("due_all_day = %s, want true", got["due_all_day"])
	}
}

func TestTaskFullMarshalJSONEmptyCollectionsAreArrays(t *testing.T) {
	raw, err := json.Marshal(TaskFull{Task: Task{TaskID: "tsk_1"}})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got map[string]json.RawMessage
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	for _, key := range []string{"subtasks", "tags"} {
		if string(got[key]) != "[]" {
			t.Errorf("%s = %s, want []", key, got[key])
		}
	}
}
