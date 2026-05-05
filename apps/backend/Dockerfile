# Stage 1: Build
FROM rust:1-bookworm AS builder

WORKDIR /usr/src/app

# Copy manifests for dependency caching
COPY apps/backend/Cargo.toml apps/backend/Cargo.lock ./

# Create dummy source to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release 2>/dev/null || true

# Copy real source and migrations
COPY apps/backend/src ./src
COPY apps/backend/migrations ./migrations

# Build application binaries
RUN touch src/main.rs && cargo build --release --bin storyclaw-backend --bin create_admin

# Stage 2: Runtime
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /usr/src/app/target/release/storyclaw-backend /app/storyclaw-backend
COPY --from=builder /usr/src/app/target/release/create_admin /app/create_admin

RUN useradd -m -s /bin/bash appuser
USER appuser

EXPOSE 3000

CMD ["/app/storyclaw-backend"]
