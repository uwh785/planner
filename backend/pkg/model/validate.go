package model

import (
	"errors"
	"fmt"
	"strings"
)

// Length limits on user-supplied text fields. Bounding these keeps a single
// row from growing without limit even when it stays under the request body
// size cap (see app.decodeJSONOrRespond): without a per-field limit, one
// oversized value could still fit in one otherwise-small request.
const (
	taskTitleMaxLength       = 200
	taskDescriptionMaxLength = 5000
	listNameMaxLength        = 100
	tagNameMaxLength         = 50
	subtaskTitleMaxLength    = 200
)

// ValidateTask trims and validates a task's user-editable text fields in
// place, returning an error describing the first violation. It is used on
// both create and update, since both accept the same fields from the
// client.
func ValidateTask(t *Task) error {
	t.Title = strings.TrimSpace(t.Title)
	if t.Title == "" {
		return errors.New("title is required")
	}
	if len(t.Title) > taskTitleMaxLength {
		return fmt.Errorf("title must be %d characters or fewer", taskTitleMaxLength)
	}
	if len(t.Description) > taskDescriptionMaxLength {
		return fmt.Errorf("description must be %d characters or fewer", taskDescriptionMaxLength)
	}
	return nil
}

// ValidateTaskList trims and validates a list's name in place.
func ValidateTaskList(l *TaskList) error {
	l.Name = strings.TrimSpace(l.Name)
	if l.Name == "" {
		return errors.New("name is required")
	}
	if len(l.Name) > listNameMaxLength {
		return fmt.Errorf("name must be %d characters or fewer", listNameMaxLength)
	}
	return nil
}

// ValidateTag trims and validates a tag's name in place.
func ValidateTag(t *Tag) error {
	t.Name = strings.TrimSpace(t.Name)
	if t.Name == "" {
		return errors.New("name is required")
	}
	if len(t.Name) > tagNameMaxLength {
		return fmt.Errorf("name must be %d characters or fewer", tagNameMaxLength)
	}
	return nil
}

// ValidateSubtask trims and validates a subtask's title in place.
func ValidateSubtask(st *Subtask) error {
	st.Title = strings.TrimSpace(st.Title)
	if st.Title == "" {
		return errors.New("title is required")
	}
	if len(st.Title) > subtaskTitleMaxLength {
		return fmt.Errorf("title must be %d characters or fewer", subtaskTitleMaxLength)
	}
	return nil
}
