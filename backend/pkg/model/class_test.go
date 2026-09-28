package model

import (
	"strings"
	"testing"
)

func TestValidateClassSession(t *testing.T) {
	valid := func() ClassSession {
		return ClassSession{
			Subject:     "Math",
			DayOfWeek:   1,
			StartMinute: 480,
			EndMinute:   540,
		}
	}

	tests := []struct {
		name    string
		mutate  func(*ClassSession)
		wantErr bool
	}{
		{
			name:    "valid",
			mutate:  func(c *ClassSession) {},
			wantErr: false,
		},
		{
			name:    "empty subject",
			mutate:  func(c *ClassSession) { c.Subject = "" },
			wantErr: true,
		},
		{
			name:    "whitespace subject",
			mutate:  func(c *ClassSession) { c.Subject = "   " },
			wantErr: true,
		},
		{
			name:    "subject too long",
			mutate:  func(c *ClassSession) { c.Subject = string(make([]byte, 101)) },
			wantErr: true,
		},
		{
			name:    "day -1",
			mutate:  func(c *ClassSession) { c.DayOfWeek = -1 },
			wantErr: true,
		},
		{
			name:    "day 7",
			mutate:  func(c *ClassSession) { c.DayOfWeek = 7 },
			wantErr: true,
		},
		{
			name:    "start == end",
			mutate:  func(c *ClassSession) { c.StartMinute = 500; c.EndMinute = 500 },
			wantErr: true,
		},
		{
			name:    "start > end",
			mutate:  func(c *ClassSession) { c.StartMinute = 600; c.EndMinute = 500 },
			wantErr: true,
		},
		{
			name:    "end 1441",
			mutate:  func(c *ClassSession) { c.StartMinute = 1439; c.EndMinute = 1441 },
			wantErr: true,
		},
		{
			name:    "end 1440 is allowed",
			mutate:  func(c *ClassSession) { c.StartMinute = 1439; c.EndMinute = 1440 },
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := valid()
			tt.mutate(&c)
			err := ValidateClassSession(&c)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateClassSession() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateClassSessionDefaultColor(t *testing.T) {
	c := ClassSession{
		Subject:     "Math",
		DayOfWeek:   1,
		StartMinute: 480,
		EndMinute:   540,
	}
	if err := ValidateClassSession(&c); err != nil {
		t.Fatalf("ValidateClassSession() unexpected error: %v", err)
	}
	if c.Color != "#0A84FF" {
		t.Errorf("Color = %q, want default #0A84FF", c.Color)
	}

	c2 := c
	c2.Color = "#FF0000"
	if err := ValidateClassSession(&c2); err != nil {
		t.Fatalf("ValidateClassSession() unexpected error: %v", err)
	}
	if c2.Color != "#FF0000" {
		t.Errorf("Color = %q, want explicit #FF0000 preserved", c2.Color)
	}
}

func TestValidateClassSessionTrimsAndUppercasesSubject(t *testing.T) {
	c := ClassSession{
		Subject:     "  Math  ",
		DayOfWeek:   1,
		StartMinute: 480,
		EndMinute:   540,
	}
	if err := ValidateClassSession(&c); err != nil {
		t.Fatalf("ValidateClassSession() unexpected error: %v", err)
	}
	if c.Subject != "MATH" {
		t.Errorf("Subject = %q, want trimmed and upper-cased MATH", c.Subject)
	}
}

func TestValidateClassSessionPreservesAccents(t *testing.T) {
	c := ClassSession{
		Subject:     "física",
		DayOfWeek:   1,
		StartMinute: 480,
		EndMinute:   540,
	}
	if err := ValidateClassSession(&c); err != nil {
		t.Fatalf("ValidateClassSession() unexpected error: %v", err)
	}
	if c.Subject != "FÍSICA" {
		t.Errorf("Subject = %q, want FÍSICA", c.Subject)
	}
}

// Upper-casing can lengthen a string, so the limit must be enforced on the
// normalized value rather than on what the client sent. 50 "ȿ" encode to
// exactly 100 bytes but 150 once upper-cased, so this only fails when the
// length check runs after normalization.
func TestValidateClassSessionLengthCheckedAfterUppercase(t *testing.T) {
	subject := strings.Repeat("ȿ", 50)
	if len(subject) != classSubjectMaxLength {
		t.Fatalf("test setup: subject is %d bytes, want exactly %d", len(subject), classSubjectMaxLength)
	}

	c := ClassSession{
		Subject:     subject,
		DayOfWeek:   1,
		StartMinute: 480,
		EndMinute:   540,
	}
	if err := ValidateClassSession(&c); err == nil {
		t.Error("ValidateClassSession() err = nil, want a too-long error")
	}
}
