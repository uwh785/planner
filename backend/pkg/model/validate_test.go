package model

import (
	"strings"
	"testing"
)

func TestValidateTask(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(*Task)
		wantErr bool
	}{
		{name: "valid", mutate: func(t *Task) {}},
		{name: "empty title", mutate: func(t *Task) { t.Title = "" }, wantErr: true},
		{name: "whitespace title", mutate: func(t *Task) { t.Title = "   " }, wantErr: true},
		{name: "title too long", mutate: func(t *Task) { t.Title = strings.Repeat("a", 201) }, wantErr: true},
		{name: "title at max is allowed", mutate: func(t *Task) { t.Title = strings.Repeat("a", 200) }},
		{name: "description too long", mutate: func(t *Task) { t.Description = strings.Repeat("a", 5001) }, wantErr: true},
		{name: "description at max is allowed", mutate: func(t *Task) { t.Description = strings.Repeat("a", 5000) }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			task := Task{Title: "Write report"}
			tt.mutate(&task)
			err := ValidateTask(&task)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateTask() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateTaskTrimsTitle(t *testing.T) {
	task := Task{Title: "  Write report  "}
	if err := ValidateTask(&task); err != nil {
		t.Fatalf("ValidateTask() unexpected error: %v", err)
	}
	if task.Title != "Write report" {
		t.Errorf("Title = %q, want trimmed", task.Title)
	}
}

func TestValidateTaskList(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(*TaskList)
		wantErr bool
	}{
		{name: "valid", mutate: func(l *TaskList) {}},
		{name: "empty name", mutate: func(l *TaskList) { l.Name = "" }, wantErr: true},
		{name: "whitespace name", mutate: func(l *TaskList) { l.Name = "  " }, wantErr: true},
		{name: "name too long", mutate: func(l *TaskList) { l.Name = strings.Repeat("a", 101) }, wantErr: true},
		{name: "name at max is allowed", mutate: func(l *TaskList) { l.Name = strings.Repeat("a", 100) }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := TaskList{Name: "Groceries"}
			tt.mutate(&l)
			err := ValidateTaskList(&l)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateTaskList() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateTag(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(*Tag)
		wantErr bool
	}{
		{name: "valid", mutate: func(t *Tag) {}},
		{name: "empty name", mutate: func(t *Tag) { t.Name = "" }, wantErr: true},
		{name: "whitespace name", mutate: func(t *Tag) { t.Name = "  " }, wantErr: true},
		{name: "name too long", mutate: func(t *Tag) { t.Name = strings.Repeat("a", 51) }, wantErr: true},
		{name: "name at max is allowed", mutate: func(t *Tag) { t.Name = strings.Repeat("a", 50) }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tag := Tag{Name: "urgent"}
			tt.mutate(&tag)
			err := ValidateTag(&tag)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateTag() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateSubtask(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(*Subtask)
		wantErr bool
	}{
		{name: "valid", mutate: func(st *Subtask) {}},
		{name: "empty title", mutate: func(st *Subtask) { st.Title = "" }, wantErr: true},
		{name: "whitespace title", mutate: func(st *Subtask) { st.Title = "  " }, wantErr: true},
		{name: "title too long", mutate: func(st *Subtask) { st.Title = strings.Repeat("a", 201) }, wantErr: true},
		{name: "title at max is allowed", mutate: func(st *Subtask) { st.Title = strings.Repeat("a", 200) }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			st := Subtask{Title: "Buy milk"}
			tt.mutate(&st)
			err := ValidateSubtask(&st)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateSubtask() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
