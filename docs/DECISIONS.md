# Decisions

- 2026-11-21: Separate project and repo from the family calendar, to keep the two apart.
- 2026-11-21: Google Apps Script + PropertiesService, no spreadsheet (Tom's notes). Free, lives in the parents' Google account, no server.
- 2026-11-21: Edit Meds is PIN-protected (Tom changed this from "no password"), so the PIN can be shared with Gene and Peggy. Ticking doses needs no PIN.
- 2026-11-21: Email Tom on every add/edit/delete; keep change history with undo; confirm before delete (Tom's notes).
- 2026-11-21: Clear logs and history older than 90 days (Tom), because Apps Script storage is small.
- 2026-11-21: Photos from a Google Drive folder, because Google Photos closed album access to apps in 2025.
- 2026-11-21: Medication lists never go in GitHub; they stay in the parents' Google account (health information).
- 2026-11-21: No rooting the tablet; debloat with ADB so updates keep working and changes can be undone.
- 2026-11-21: Deploy with clasp so GitHub holds the real copy of the code.
