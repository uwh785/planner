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

func TestTaskUnmarshalJSONListID(t *testing.T) {
	cases := []struct {
		name string
		body string
		want sql.NullString
	}{
		{"string", `{"title":"t","list_id":"lst_x"}`, sql.NullString{String: "lst_x", Valid: true}},
		{"null", `{"title":"t","list_id":null}`, sql.NullString{}},
		{"absent", `{"title":"t"}`, sql.NullString{}},
		{"empty string", `{"title":"t","list_id":""}`, sql.NullString{}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var got Task
			if err := json.Unmarshal([]byte(tc.body), &got); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if got.ListID != tc.want {
				t.Errorf("ListID = %+v, want %+v", got.ListID, tc.want)
			}
			if got.Title != "t" {
				t.Errorf("Title = %q, want t", got.Title)
			}
		})
	}

	var bad Task
	if err := json.Unmarshal([]byte(`{"list_id":5}`), &bad); err == nil {
		t.Error("a numeric list_id decoded without error")
	}
}

func TestTaskJSONRoundTrip(t *testing.T) {
	due := int64(99)
	in := Task{
		TaskID: "tsk_1", Title: "T", Description: "d", Priority: 2, Status: "pending",
		ListID: sql.NullString{String: "lst_1", Valid: true}, DueDate: &due, ElapsedMs: 7, SortOrder: 3,
	}
	raw, err := json.Marshal(in)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var out Task
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if out.ListID != in.ListID || out.TaskID != "tsk_1" || out.Priority != 2 || out.ElapsedMs != 7 ||
		out.DueDate == nil || *out.DueDate != 99 || out.SortOrder != 3 {
		t.Errorf("round trip = %+v, want %+v", out, in)
	}
}

// TestTaskFullUnmarshalJSON guards against the embedded Task's UnmarshalJSON
// being promoted and dropping subtasks and tags.
func TestTaskFullUnmarshalJSON(t *testing.T) {
	in := TaskFull{
		Task:     Task{TaskID: "tsk_1", Title: "T", ListID: sql.NullString{String: "lst_1", Valid: true}},
		Subtasks: []Subtask{{SubtaskID: "sub_1", Title: "Sub"}},
		Tags:     []Tag{{TagID: "tag_1", Name: "Work"}},
	}
	raw, err := json.Marshal(in)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var out TaskFull
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if out.TaskID != "tsk_1" || out.ListID != in.ListID {
		t.Errorf("task = %+v, want id tsk_1 and list lst_1", out.Task)
	}
	if len(out.Subtasks) != 1 || out.Subtasks[0].SubtaskID != "sub_1" {
		t.Errorf("subtasks = %+v, want sub_1", out.Subtasks)
	}
	if len(out.Tags) != 1 || out.Tags[0].TagID != "tag_1" {
		t.Errorf("tags = %+v, want tag_1", out.Tags)
	}
}
