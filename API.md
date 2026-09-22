# API Specification — Nexus Notes

## REST Endpoints (`/api/v1`)

### `GET /api/v1/health`
Health check endpoint reporting service operational status and version.

### `POST /api/v1/sync`
Submits an idempotent mutation operation to the remote synchronization queue.
- **Request Body**:
  ```json
  {
    "operationId": "op-4f1a23-bc92",
    "clientId": "client-9912",
    "entityType": "note",
    "entityId": "note-manifesto",
    "operationType": "update",
    "payload": { "title": "Updated Manifesto" },
    "baseVersion": 1
  }
  ```
- **Response**: `200 OK` `{ "success": true, "operationId": "...", "timestamp": "..." }`

### `GET /api/v1/sync?since=<ISO_TIMESTAMP>`
Pulls all changes committed to the workspace after the specified checkpoint.

### `GET /api/v1/notes` & `POST /api/v1/notes`
Retrieves or publishes note documents.

### `GET /api/v1/comments?noteId=<UUID>`
Retrieves threaded comments and discussions.

---

## WebSocket Protocol (`/ws`)

- **Presence Packet**:
  ```json
  {
    "type": "presence",
    "userId": "user-1",
    "userName": "Alex Rivera",
    "activeNoteId": "note-manifesto",
    "cursor": { "x": 120, "y": 450 }
  }
  ```
- **CRDT Sync Packet**:
  ```json
  {
    "type": "crdt_sync",
    "noteId": "note-manifesto",
    "update": "<base64_encoded_yjs_update>"
  }
  ```
