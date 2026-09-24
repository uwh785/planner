package main

import (
	"net/http"
	"os"
	"sync"

	"planner/pkg/server"
)

var (
	handlerOnce sync.Once
	handler     http.Handler
)

func Handler(w http.ResponseWriter, r *http.Request) {
	handlerOnce.Do(func() {
		handler = server.HandlerOrFatal()
	})
	handler.ServeHTTP(w, r)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	h := server.HandlerOrFatal()
	http.ListenAndServe(":"+port, h)
}
