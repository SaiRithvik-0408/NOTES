# Database Design & Schemas — Nexus Notes

## Relational Architecture

The system uses a strictly normalized relational model targeting PostgreSQL 14+:

| Table | Description | Primary Key |
|---|---|---|
| `users` | User accounts and profile settings | UUID |
| `workspaces` | Multi-tenant organizational units | UUID |
| `workspace_members` | Role-based memberships (`owner`, `admin`, `editor`, etc.) | UUID |
| `folders` | Hierarchical note organization | UUID |
| `notes` | Document entity with version and metadata | UUID |
| `note_blocks` | Granular block content definitions | UUID |
| `note_revisions` | Historical snapshots for rollback | UUID |
| `note_comments` | Threaded discussions and anchored notes | UUID |
| `note_comment_replies` | Sub-replies in comment threads | UUID |
| `tags` & `note_tags` | Tag definitions and M:N note associations | UUID |
| `note_attachments` | Uploaded assets and blobs | UUID |
| `sync_operations` | Journal of all idempotent client mutations | UUID |
| `sync_checkpoints` | Client synchronization high-water marks | Compound |
| `conflicts` | Captured diverging states awaiting resolution | UUID |
| `activities` | Audit trail of edits, comments, and restores | UUID |

See full SQL schema in [`database/migrations/001_initial_schema.sql`](file:///d:/PROJECTS/P2/database/migrations/001_initial_schema.sql).
