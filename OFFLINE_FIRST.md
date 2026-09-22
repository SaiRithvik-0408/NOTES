# Offline-First Guarantee — Nexus Notes

## Zero-Latency Principle

In Nexus Notes, **the UI never waits for network validation**. Typing in the editor immediately executes synchronous transactions against local memory and asynchronous commits to browser IndexedDB through Dexie.js.

### Local-First Search

Full-text search continues working 100% offline. Every note projection maintains:
- `title`
- `tags`
- `plainText` (tokenized projection of document prose)
- `backlinks`

Searches evaluate directly against local IndexedDB tables with sub-10ms response times across thousands of notes.

### Offline Attachments

When a user attaches an image or document while offline:
1. The binary data is stored as a `Blob` in the IndexedDB `attachments` store.
2. An attachment record is generated with `uploadStatus: 'pending'`.
3. An upload mutation is enqueued.
4. When connectivity resumes, attachments stream to object storage without interrupting work.
