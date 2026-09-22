# Security Guidelines — Nexus Notes

## Threat Model & Defenses

1. **Client Data Isolation**:
   - IndexedDB is sandboxed strictly to the origin.
   - Cross-tab synchronization uses named `BroadcastChannel` verified by matching origin and workspace identifiers.
2. **Server-Side Authorization**:
   - Every mutation pushed to `/api/v1/sync` validates the client's role in `workspace_members`.
   - Client-side optimistic permissions are never treated as authoritative.
3. **Content Sanitization & XSS Prevention**:
   - TipTap and ProseMirror schema filters sanitize all incoming markup, disallowing arbitrary `<script>` or unsafe `<iframe>` injection.
4. **Secret Management**:
   - Database credentials and JWT signing keys are strictly injected via `.env` variables and excluded from version control.
