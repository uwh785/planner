package store

import (
	"regexp"
	"testing"
)

// genID does not touch the database, so it is tested directly without a
// store instance or connection.

var genIDShape = regexp.MustCompile(`^usr_[0-9a-f]{16}$`)

func TestGenIDShape(t *testing.T) {
	id := genID("usr")
	if !genIDShape.MatchString(id) {
		t.Fatalf("genID(%q) = %q, want match of %s", "usr", id, genIDShape.String())
	}
}

func TestGenIDUniqueAcrossCalls(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 20; i++ {
		id := genID("tsk")
		if seen[id] {
			t.Fatalf("genID produced duplicate id %q across %d calls", id, i+1)
		}
		seen[id] = true
	}
}
