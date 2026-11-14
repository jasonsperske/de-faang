# Go toolchain with the standard library pre-compiled into a seed build cache, so a candidate's
# program compiles in ~1s instead of ~15s. The runner copies the seed into a tmpfs cache per run
# (the container filesystem is read-only and the cache must be writable).
FROM golang:1.25-bookworm
ENV CGO_ENABLED=0 GOFLAGS=-trimpath GOCACHE=/gocache-seed
COPY warm.go /warm/warm.go
RUN cd /warm && go build -o /dev/null warm.go && chmod -R a+rX /gocache-seed && rm -rf /warm
