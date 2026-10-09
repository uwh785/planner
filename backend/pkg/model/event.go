package model

import (
	"errors"
	"fmt"
	"strings"
)

const (
	eventTitleMaxLength       = taskTitleMaxLength
	eventDescriptionMaxLength = taskDescriptionMaxLength
	eventLocationMaxLength    = 200
	defaultEventColor         = "#0A84FF"
)

// Event is a one-off dated occurrence, such as a presentation or an exam. It
// is distinct from a Task: it happens at a time and is never started, paused
// or completed.
type Event struct {
	UserID      string `json:"user_id"`
	EventID     string `json:"event_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Location    string `json:"location"`
	StartAt     int64  `json:"start_at"`
	EndAt       *int64 `json:"end_at"`
	AllDay      bool   `json:"all_day"`
	Color       string `json:"color"`
	UpdatedAt   int64  `json:"updated_at"`
}

// ValidateEvent trims and validates e in place, returning an error describing
// the first violation found. On success it also fills in the default color
// when none was provided. It is used on both create and update.
func ValidateEvent(e *Event) error {
	e.Title = strings.TrimSpace(e.Title)
	if e.Title == "" {
		return errors.New("title is required")
	}
	if len(e.Title) > eventTitleMaxLength {
		return fmt.Errorf("title must be %d characters or fewer", eventTitleMaxLength)
	}
	e.Description = strings.TrimSpace(e.Description)
	if len(e.Description) > eventDescriptionMaxLength {
		return fmt.Errorf("description must be %d characters or fewer", eventDescriptionMaxLength)
	}
	e.Location = strings.TrimSpace(e.Location)
	if len(e.Location) > eventLocationMaxLength {
		return fmt.Errorf("location must be %d characters or fewer", eventLocationMaxLength)
	}
	if e.StartAt <= 0 {
		return errors.New("start_at is required")
	}
	if e.EndAt != nil && *e.EndAt < e.StartAt {
		return errors.New("end_at must not be before start_at")
	}

	if e.Color == "" {
		e.Color = defaultEventColor
	}

	return nil
}
