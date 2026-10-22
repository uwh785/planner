package app

import (
	"log"
	"net/http"
	"strconv"

	"planner/pkg/auth"
)

// syncPull answers GET /api/sync?since=<ms>: everything the caller changed on
// the server at or after the cursor, tombstones included, plus the cursor to
// send next time. since defaults to 0, a full snapshot.
func (a *App) syncPull(w http.ResponseWriter, r *http.Request) {
	var since int64
	if v := r.URL.Query().Get("since"); v != "" {
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil || n < 0 {
			errResp(w, http.StatusBadRequest, "since must be a non-negative integer")
			return
		}
		since = n
	}
	claims := auth.GetUser(r)
	changes, err := a.store.SyncChanges(claims.UserID, since)
	if err != nil {
		log.Printf("syncPull error: %v", err)
		errResp(w, http.StatusInternalServerError, "failed to load changes")
		return
	}
	dataResp(w, http.StatusOK, changes)
}
