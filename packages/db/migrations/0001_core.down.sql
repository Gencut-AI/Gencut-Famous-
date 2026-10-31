DROP TABLE IF EXISTS model_runs, consents, audit_events, invitations, memberships, users, workspaces CASCADE;
DROP FUNCTION IF EXISTS audit_events_append_only();
