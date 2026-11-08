# DevSpace

[![CI](https://github.com/mohammadfaheemmir/devspace/actions/workflows/ci.yml/badge.svg)](https://github.com/mohammadfaheemmir/devspace/actions/workflows/ci.yml)

A team project-management app: projects, tasks (list and Kanban board),
comments, members and roles, invitations, an activity feed, due-date reminders
and live updates.

**Live site:** https://developersspace.netlify.app/signup

Built with React 19, Vite, Tailwind CSS 4 and [Supabase](https://supabase.com)
(Postgres, Auth, Storage and Realtime).

See [CHANGELOG.md](CHANGELOG.md) for what has changed.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in your Supabase URL and publishable key
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with Oxlint |
| `npm run typecheck` | Type-check the TypeScript files |
| `npm test` | Run the test suite once (Vitest) |
| `npm run test:watch` | Re-run tests on every change |

## TypeScript

The app and its tests are written in TypeScript and checked strictly
(`npm run typecheck`, also run in CI). Typed test data builders live in
`src/test/fixtures.ts`.

Database types in `src/types/database.ts` are generated from the live schema.
After changing the database, regenerate them:

```bash
npx supabase gen types --lang=typescript --remote=<project-ref> --schema public > src/types/database.ts
```

`src/types/app.ts` adds app-level types on top (for example task statuses,
which the database stores as plain text with CHECK constraints).

## Error monitoring

Optional, with [Sentry](https://sentry.io). Set `VITE_SENTRY_DSN` (in `.env`
locally, and in Netlify under *Site configuration -> Environment variables*
for the live site, then redeploy). Without it, monitoring is off and the Sentry
SDK is not included in the build.

When on, Sentry receives uncaught errors and React render crashes (the app
shows a "Something went wrong" screen instead of a blank page). It sends no
IP addresses, cookies or emails, only the signed-in user's ID, and no
performance tracing. See `src/lib/monitoring.js`.

## Project structure

```
src/
  pages/               Route pages (Login, Signup, Dashboard, ProjectDetails, ProfileSettings)
  components/          Route guards
  components/project/  Project page panels, task list/board, comments, task form
  components/dashboard/ Dashboard project card
  context/             Auth and toast providers (+ useAuth / useToast hooks)
  hooks/               useTaskComments, useDismiss
  lib/                 Supabase client and data services
supabase/migrations/   Database schema, access rules, functions and triggers
```

## Tests

Tests live next to the code they cover (`*.test.js` / `*.test.jsx`) and run with
[Vitest](https://vitest.dev) and React Testing Library in a simulated browser.
They never contact Supabase: the client gets dummy settings and services are
mocked (see `src/test/`).

GitHub Actions (`.github/workflows/ci.yml`) runs lint, tests and the build on
every push to `main` and on every pull request.

## Database

The complete database setup lives in `supabase/migrations/`:

| Migration | Contents |
|---|---|
| `20261108000000_baseline_schema.sql` | Tables, constraints, indexes, functions, triggers, Row Level Security policies, the `avatars` storage bucket and Realtime publication, reconstructed from the live project |
| `20261108000100_security_hardening.sql` | Fixes from the schema review: removes direct member inserts, makes a task's creator/project read-only, keeps `projects.owner_id` in sync on ownership transfer, and drops a debug function |
| `20261108000200_decline_invitation.sql` | `decline_project_invitation()` so invited users can decline |
| `20261109000000_task_labels.sql` | `project_labels` and `task_labels` tables with access rules |
| `20261109000100_task_attachments.sql` | Private `task-attachments` bucket, `task_attachments` table and access rules |
| `20261109000200_attachment_task_creator_delete.sql` | Task creators may also delete attachments on their tasks |
| `20261109000300_bug_hunt_fixes.sql` | Unassign tasks of departed members, expired-invitation fixes, task counts function, live member updates |

Access control is enforced in the database with Row Level Security. Project
roles are `owner`, `admin` and `member`, stored in `project_members`; helper
functions `is_project_member`, `is_project_admin` and `is_project_owner` are
used by the policies.

**Using the Supabase CLI with the existing project:** all seven migrations are
already applied to the live database (the baseline describes how it was built;
the others were applied on 2026-11-08), but the CLI's migration history does
not know that yet. Mark them as applied before pushing anything new:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase migration repair --status applied 20261108000000 20261108000100 20261108000200 20261109000000 20261109000100 20261109000200 20261109000300
npx supabase db push    # applies any newer migrations
```

**Setting up a fresh project:** run the migrations in order (for example with
`npx supabase db push` against an empty project).
