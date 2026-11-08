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
| `npm test` | Run the test suite once (Vitest) |
| `npm run test:watch` | Re-run tests on every change |

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

Access control is enforced in the database with Row Level Security. Project
roles are `owner`, `admin` and `member`, stored in `project_members`; helper
functions `is_project_member`, `is_project_admin` and `is_project_owner` are
used by the policies.

**Using the Supabase CLI with the existing project:** all three migrations are
already applied to the live database (the baseline describes how it was built;
the others were applied on 2026-11-08), but the CLI's migration history does
not know that yet. Mark them as applied before pushing anything new:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase migration repair --status applied 20261108000000 20261108000100 20261108000200
npx supabase db push    # applies any newer migrations
```

**Setting up a fresh project:** run the migrations in order (for example with
`npx supabase db push` against an empty project).
