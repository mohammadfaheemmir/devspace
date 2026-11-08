# DevSpace

A team project-management app: projects, tasks (list and Kanban board),
comments, members and roles, invitations, an activity feed, due-date reminders
and live updates.

**Live site:** https://developersspace.netlify.app/signup

Built with React 19, Vite, Tailwind CSS 4 and [Supabase](https://supabase.com)
(Postgres, Auth, Storage and Realtime).

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

## Database

The complete database setup lives in `supabase/migrations/`:

| Migration | Contents |
|---|---|
| `20261108000000_baseline_schema.sql` | Tables, constraints, indexes, functions, triggers, Row Level Security policies, the `avatars` storage bucket and Realtime publication, reconstructed from the live project |
| `20261108000100_security_hardening.sql` | Fixes from the schema review: removes direct member inserts, makes a task's creator/project read-only, keeps `projects.owner_id` in sync on ownership transfer, and drops a debug function |

Access control is enforced in the database with Row Level Security. Project
roles are `owner`, `admin` and `member`, stored in `project_members`; helper
functions `is_project_member`, `is_project_admin` and `is_project_owner` are
used by the policies.

**Using the Supabase CLI with the existing project:** both migrations are
already applied to the live database (the baseline describes how it was built;
the hardening was applied on 2026-11-08), but the CLI's migration history does
not know that yet. Mark them as applied before pushing anything new:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase migration repair --status applied 20261108000000 20261108000100
npx supabase db push    # applies any newer migrations
```

**Setting up a fresh project:** run the migrations in order (for example with
`npx supabase db push` against an empty project).
