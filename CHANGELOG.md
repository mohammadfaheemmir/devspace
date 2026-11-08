# Changelog

All notable changes to DevSpace. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 2026-11-09

Three new features. Labels and attachments needed database changes, each
reviewed and approved before being applied to the live project.

### Added

- **Calendar view** of task due dates, next to List and Board, using the same
  search and filters. Month grid with previous / next / Today navigation;
  tasks coloured by status, overdue in red, busy days collapse into
  "+N more"; on phones a list of the month's due dates. (`bef2723`)
- **Task labels**: owners and admins create coloured labels (8 colours);
  members add them to tasks in the task form. Labels show on list items and
  board cards, can be used as a filter, and update live. (`3a85a60`,
  `a2a33b8`, `0a0435c`)
- **File attachments** on tasks (images, PDF, text and Office files up to
  10 MB) in the Edit task dialog: upload several at once, download through
  60-second private links, delete for the uploader or owners/admins, live
  updates. (`f20f7f3`, `3d06d75`, `37c6e92`)

### Database

- `project_labels` and `task_labels` tables; composite keys keep a task's
  labels within its own project. Members view and label tasks; owners and
  admins manage labels. (`3a85a60`)
- Private `task-attachments` storage bucket (no HTML or SVG) and
  `task_attachments` table with access rules for files and records.
  (`f20f7f3`)

### Changed

- A task's creator may now delete attachments on their task (previously
  only the uploader or an owner/admin). Supabase cannot delete files when
  database rows cascade, so the app removes a task's files before deleting
  it; this closes the gap where files others attached stayed in storage
  after a member deleted their own task. (migration
  `20261109000200_attachment_task_creator_delete.sql`)

### Fixed (bug hunt)

- Tasks assigned to someone who left or was removed from a project could
  no longer be changed at all (the task rule requires the assignee to be a
  member). Leaving or removal now unassigns their tasks.
- Expired invitations stayed "pending" forever and blocked re-inviting the
  same email; the database's own expiry update was undone by an error it
  raised right after. Expired invitations are now retired automatically,
  shown as "Expired" to admins, and accepting one says it has expired.
- Dismissing a notice closed an open dialog and lost its unsaved edits.
- Saving a task could undo a teammate's label change made while it was open.
- Supabase's 1,000-row limit: dashboard task counts are computed in the
  database; tasks and label links load in pages; notifications load 50 at a
  time with "Load older notifications" and an accurate unread count.
- Supabase does not apply access rules to delete events, so every client
  received deletes from all projects (IDs only); label and attachment views
  now ignore those instead of reloading.
- Project members now update live (joins, removals, role changes); a
  removed user is returned to the dashboard.
- Opening an inaccessible project showed a raw database error.
- (migration `20261109000300_bug_hunt_fixes.sql`)

### Testing

- 167 tests (from 102), including accessibility audits of the calendar,
  label manager and attachments section.
- The tests are now TypeScript too, with typed test data builders
  (`src/test/fixtures.ts`); `allowJs` is off, so all of `src` is checked.

## 2026-11-08

A full review and overhaul: bug fixes, database security hardening, new
features, an automated test suite, CI, and performance, mobile and
accessibility work.

### Security

Applied to the live Supabase database and verified.

- Admins could add any user to a project with any role, including a second
  `owner` (who could then delete the project). Removed the direct member-insert
  policy; members now join only through invitations. (`919ad26`)
- Any member could take over a task by changing its creator and then delete it.
  A task's creator and project are now read-only. (`919ad26`)
- `projects.owner_id` could be changed by admins and was never updated by
  ownership transfers. It is now kept in sync and protected. (`919ad26`)
- Removed a leftover debug database function that anyone, even signed-out
  visitors, could call. (`919ad26`)
- No misuse was found: no project had more than one owner.

### Fixed

- The "project deleted" message was never shown. (`564f605`)
- The dashboard showed an out-of-date name and no profile picture. (`564f605`)
- The "New email" field started filled with the current email, so saving
  always failed. (`564f605`)
- Old profile pictures were never deleted from storage. (`564f605`)
- The app could hang on "Loading your workspace..." if restoring the session
  failed. (`564f605`)
- Signup accepted 6-character passwords while Profile Settings required 8.
  (`564f605`)
- Signed-in users could still open `/login` and `/signup`. (`564f605`)
- Saving two tasks at once could unlock the wrong task, and a failed save
  could undo teammates' live changes. (`564f605`)
- The list view showed "null priority" and no priority colours. (`564f605`)
- The favicon was missing (404 on every page load). (`564f605`)
- A missing `.env` gave a cryptic error. (`564f605`)
- Creating a project showed errors behind the open dialog. (`6db58e0`)
- **Live site:** every address except the home page (`/login`, `/signup`,
  `/dashboard`, ...) returned Netlify's 404 page. (`1bcdcd6`)
- Deleting a comment that the database refused looked successful, and the
  comment reappeared later. (`92d493e`)
- Invitation notifications opened a project the user had not joined yet.
  They now go to the dashboard. (`a12fc25`)
- **Phones:** the task reminders dropdown was almost entirely off-screen and
  the notification dropdown was cut off; member rows were cramped; long names
  overflowed. (`1f3b74b`)

### Added

- Edit and delete tasks (delete for the task's creator and for owners and
  admins). (`209ee5c`)
- Edit your own comments. (`92d493e`)
- Decline project invitations. (`3c6062e`)
- Notifications page with full history, All/Unread filter and "mark all as
  read". (`a12fc25`)
- Pop-up notices (toasts) for success and errors. (`6db58e0`)
- Dashboard project cards show your role and task progress, plus a project
  search. (`3448a18`)
- Dropdowns and dialogs close with Escape or a click outside. (`4c26558`)

### Accessibility

- All form labels are linked to their fields, with autofill hints. (`0f63846`)
- Dialogs move keyboard focus inside, keep Tab inside, and return focus when
  closed. (`0f63846`)
- Secondary text raised from 3.1-4.2:1 contrast (below WCAG AA) to
  5.7-7.9:1. (`0f63846`)
- A consistent keyboard focus outline. (`0f63846`)

### Performance

- Pages load only when first visited. (`fecf26f`)
- React, the router and Supabase are in separate long-lived files, so returning
  visitors re-download about 5 kB instead of about 140 kB after each deploy.
  (`b68b185`)
- One shared login check instead of a server round-trip on every request.
  (`0e50de7`)
- Live updates for tasks and comments are filtered to the current project.
  (`9bf1522`)

### Changed

- `ProjectDetails.jsx` split from 2,574 lines into focused components and
  hooks. (`00dc1ae`, `60f2c6e`, `6d9d51a`)
- Notification logic shared between the dashboard and the Notifications page.
  (`a12fc25`)

### Database

- The full schema (tables, access rules, functions, triggers, storage and
  Realtime setup) is now in `supabase/migrations/`, reconstructed from the live
  project. (`690fb55`)

### Testing and tooling

- Vitest and React Testing Library: 96 tests across services, components,
  hooks and pages, including axe-core accessibility audits. (`3a54226`,
  `3008f32`, `0f63846`)
- GitHub Actions runs lint, tests and the build on every push and pull
  request. (`35445ec`)
- `.env.example`, a project README and this changelog.

### Error monitoring

- Optional Sentry error monitoring, off unless `VITE_SENTRY_DSN` is set (the
  SDK is then not included at all). Loaded in the background; only the
  needed parts are bundled (31 kB instead of 150 kB gzip). (`5233515`)
- A "Something went wrong" screen with a reload button replaces the blank
  page when the app crashes. (`5233515`)
- **Privacy fix:** Sentry 11 silently ignores the old `sendDefaultPii`
  option, and its new `dataCollection` defaults collect user info (including
  IP), cookies, headers, bodies and query parameters. All of these are now
  switched off; only the user's ID is sent. Found by the TypeScript
  conversion; no data had been sent, as monitoring was not yet enabled.
  (`7cdf8ff`)

### TypeScript

- The whole app was converted to TypeScript with strict checking, run in CI
  on every push. Database types are generated from the live schema, so
  queries are checked against the real tables. (`58ecde9`, `c813041`,
  `d6ff3e5`, `a4704dd`, `2f6e4bb`, `a2c08d7`, `915b1e1`)
- Issues the type checker found and fixed: dates shown as "1 Jan 1970" when
  a nullable `created_at` was missing (project cards, comments,
  invitations); the project page passing a possibly-missing ID to a dozen
  calls; updates merged into data that had not loaded yet; and the Sentry
  privacy setting above.

## 2026-11-01

- Initial version of DevSpace. (`981633a`)
