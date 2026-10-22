package config

import "testing"

func TestLoadRefreshTTLDays(t *testing.T) {
	for _, tc := range []struct {
		name, env string
		want      int
	}{
		{"default", "", 90},
		{"override", "30", 30},
		{"invalid keeps default", "abc", 90},
		{"non-positive keeps default", "0", 90},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("REFRESH_TTL_DAYS", tc.env)
			cfg, err := Load(false)
			if err != nil {
				t.Fatalf("Load: %v", err)
			}
			if cfg.RefreshTTLDays != tc.want {
				t.Fatalf("RefreshTTLDays = %d, want %d", cfg.RefreshTTLDays, tc.want)
			}
		})
	}
}

func TestLoadJWTTTLHoursUnchanged(t *testing.T) {
	t.Setenv("JWT_TTL_HOURS", "")
	cfg, _ := Load(false)
	if cfg.JWTTLHours != 72 {
		t.Fatalf("JWTTLHours = %d, want 72", cfg.JWTTLHours)
	}
}
