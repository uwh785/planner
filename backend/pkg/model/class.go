package model

import (
	"errors"
	"fmt"
	"strings"
)

const (
	classSubjectMaxLength = 100
	defaultClassColor     = "#0A84FF"
)

// ClassSession is a fixed weekly time slot in the user's class timetable.
type ClassSession struct {
	UserID      string `json:"user_id"`
	ClassID     string `json:"class_id"`
	Subject     string `json:"subject"`
	DayOfWeek   int    `json:"day_of_week"`
	StartMinute int    `json:"start_minute"`
	EndMinute   int    `json:"end_minute"`
	Room        string `json:"room"`
	Teacher     string `json:"teacher"`
	Color       string `json:"color"`
	UpdatedAt   int64  `json:"updated_at"`
}

// ValidateClassSession normalizes and validates c in place, returning an error
// describing the first violation found. On success it also fills in the
// default color when none was provided.
//
// The subject is upper-cased so the same course always lands on one canonical
// spelling, no matter how it was typed. Upper-casing happens before the length
// check because it can grow the encoded string (e.g. "ȿ" becomes the 3-byte
// "Ȿ"), so a value that fits the limit when sent could overflow it once
// normalized.
func ValidateClassSession(c *ClassSession) error {
	c.Subject = strings.ToUpper(strings.TrimSpace(c.Subject))
	if c.Subject == "" {
		return errors.New("subject is required")
	}
	if len(c.Subject) > classSubjectMaxLength {
		return fmt.Errorf("subject must be %d characters or fewer", classSubjectMaxLength)
	}
	if c.DayOfWeek < 0 || c.DayOfWeek > 6 {
		return errors.New("day_of_week must be between 0 and 6")
	}
	if c.StartMinute < 0 || c.StartMinute >= c.EndMinute || c.EndMinute > 1440 {
		return errors.New("start_minute and end_minute must satisfy 0 <= start_minute < end_minute <= 1440")
	}

	if c.Color == "" {
		c.Color = defaultClassColor
	}

	return nil
}
