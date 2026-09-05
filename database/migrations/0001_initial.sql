-- KyvonOPS local store, schema version 1.
--
-- This database holds inventory, history and audit — never a secret. Passwords
-- and key passphrases live in the OS keychain (see `kyvon_ssh::vault`), so a
-- copy of this file yields an inventory of hosts, not access to them.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- inventory

CREATE TABLE servers (
    id                  TEXT PRIMARY KEY NOT NULL,
    alias               TEXT NOT NULL,
    hostname            TEXT NOT NULL,
    port                INTEGER NOT NULL DEFAULT 22,
    username            TEXT NOT NULL,
    -- Serialised `AuthMethod`: the shape of authentication, never the secret.
    auth_json           TEXT NOT NULL,
    -- Serialised `Vec<String>` of workspace tags.
    tags_json           TEXT NOT NULL DEFAULT '[]',
    -- Serialised `HostFacts` from the last successful probe; NULL until then.
    facts_json          TEXT,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_servers_alias ON servers(alias);

-- Host keys the operator has explicitly trusted. Identified by host and port
-- because the same name on a different port may legitimately be a different
-- machine.
CREATE TABLE known_hosts (
    host                TEXT NOT NULL,
    port                INTEGER NOT NULL,
    key_type            TEXT NOT NULL,
    fingerprint         TEXT NOT NULL,
    -- Full OpenSSH public key line, so a re-presented key is compared in full.
    public_key          TEXT NOT NULL,
    trusted_at          INTEGER NOT NULL,
    PRIMARY KEY (host, port)
);

-- ---------------------------------------------------------------- telemetry

-- Raw samples, one row per metric per sample. Pruned to 24 hours by the
-- retention task; older data survives only in the aggregate tables.
CREATE TABLE metric_samples (
    server_id           TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    -- 'cpu.total', 'mem.used_pct', 'net.rx_bps', 'disk./.used_pct', ...
    metric              TEXT NOT NULL,
    ts                  INTEGER NOT NULL,
    value               REAL NOT NULL,
    PRIMARY KEY (server_id, metric, ts)
) WITHOUT ROWID;

CREATE INDEX idx_metric_samples_sweep ON metric_samples(ts);

-- Downsampled buckets. `resolution` is one of '1m', '5m', '1h'.
CREATE TABLE metric_aggregates (
    server_id           TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    metric              TEXT NOT NULL,
    resolution          TEXT NOT NULL,
    bucket_start        INTEGER NOT NULL,
    avg                 REAL NOT NULL,
    min                 REAL NOT NULL,
    max                 REAL NOT NULL,
    p95                 REAL NOT NULL,
    samples             INTEGER NOT NULL,
    PRIMARY KEY (server_id, metric, resolution, bucket_start)
) WITHOUT ROWID;

CREATE INDEX idx_metric_aggregates_sweep ON metric_aggregates(resolution, bucket_start);

-- ------------------------------------------------------------------- audit

-- Every operation KyvonOPS performed against a host. Append-only by
-- convention: nothing in the application updates or deletes a row here.
CREATE TABLE audit_events (
    id                  TEXT PRIMARY KEY NOT NULL,
    server_id           TEXT REFERENCES servers(id) ON DELETE SET NULL,
    -- 'connect', 'exec', 'service', 'file', 'agent', 'security'.
    category            TEXT NOT NULL,
    -- What was attempted, already passed through secret redaction.
    summary             TEXT NOT NULL,
    -- The exact command sent, redacted. NULL for non-command operations.
    command             TEXT,
    risk_tier           TEXT NOT NULL,
    -- 'success', 'failure', 'cancelled'.
    outcome             TEXT NOT NULL,
    exit_status         INTEGER,
    duration_ms         INTEGER,
    -- Short redacted excerpt of the result, for the timeline.
    result_excerpt      TEXT,
    created_at          INTEGER NOT NULL
);

CREATE INDEX idx_audit_server_time ON audit_events(server_id, created_at DESC);
CREATE INDEX idx_audit_time ON audit_events(created_at DESC);

-- ------------------------------------------------------------- operator notes

CREATE TABLE notes (
    id                  TEXT PRIMARY KEY NOT NULL,
    server_id           TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    -- 'architecture', 'deployment', 'backup', 'maintenance', 'known-issues',
    -- 'commands', 'operational', 'incidents'.
    section             TEXT NOT NULL,
    title               TEXT NOT NULL,
    body_md             TEXT NOT NULL,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);

CREATE INDEX idx_notes_server ON notes(server_id, section);

CREATE TABLE saved_commands (
    id                  TEXT PRIMARY KEY NOT NULL,
    -- NULL means the command is available on every server.
    server_id           TEXT REFERENCES servers(id) ON DELETE CASCADE,
    label               TEXT NOT NULL,
    command             TEXT NOT NULL,
    risk_tier           TEXT NOT NULL,
    created_at          INTEGER NOT NULL,
    last_used_at        INTEGER
);

-- --------------------------------------------------------------- snapshots

-- A point-in-time record of a host's configuration: services, ports,
-- packages, containers, users. Not a disk backup (specification §44).
CREATE TABLE snapshots (
    id                  TEXT PRIMARY KEY NOT NULL,
    server_id           TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    label               TEXT NOT NULL,
    -- Serialised snapshot document; compared field-by-field by the diff engine.
    payload_json        TEXT NOT NULL,
    created_at          INTEGER NOT NULL
);

CREATE INDEX idx_snapshots_server ON snapshots(server_id, created_at DESC);

-- ---------------------------------------------------------------- settings

CREATE TABLE settings (
    key                 TEXT PRIMARY KEY NOT NULL,
    value_json          TEXT NOT NULL,
    updated_at          INTEGER NOT NULL
);
