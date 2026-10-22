package app

import (
	"errors"
	"log"
	"net/http"

	"planner/pkg/model"
	"planner/pkg/store"
)

// Refresh and logout are public routes (the client calls them precisely when
// its access token is gone) and are not rate limited yet; that is out of scope
// here. The 256-bit tokens make guessing infeasible, but throttling should be
// added before exposing them to untrusted traffic. Tokens are never logged.

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// refresh rotates the presented refresh token and returns the same shape as
// login. Every refusal is the same 401 so nothing reveals why.
func (a *App) refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if !decodeJSONOrRespond(w, r, &req) {
		return
	}

	user, next, err := a.store.RotateRefreshToken(req.RefreshToken, a.refreshTTL)
	if errors.Is(err, store.ErrInvalidRefreshToken) {
		errResp(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}
	if err != nil {
		log.Printf("refresh error: %v", err)
		errResp(w, http.StatusInternalServerError, "failed to refresh token")
		return
	}

	token, err := a.auth.Generate(user.UserID, user.Email, user.Role)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	dataResp(w, http.StatusOK, model.AuthResponse{Token: token, User: user, RefreshToken: next})
}

// logout revokes the presented token's whole family. It answers 204 for any
// well-formed request, known token or not, so it is not an existence oracle.
func (a *App) logout(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if !decodeJSONOrRespond(w, r, &req) {
		return
	}

	if err := a.store.RevokeRefreshFamily(req.RefreshToken); err != nil {
		log.Printf("logout error: %v", err)
		errResp(w, http.StatusInternalServerError, "failed to log out")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
