# MagPET

MagPET is a personal expense tracker for recording expenses, organizing categories, managing savings and monthly budgets, and reviewing financial activity in reports.

## Technologies

- React
- Vite
- JavaScript
- Supabase (authentication and database)
- CSS

## Features

- Email and password sign-up and sign-in
- Email verification during account creation
- Password recovery using a one-time password (OTP) and secure password reset
- Authenticated dashboard and profile management
- Expense and category management
- Savings tracking
- Monthly overall and category budgets
- Reports, charts, and export tools

## Project structure

```text
.
├── public/                    # Public static assets
├── src/
│   ├── assets/images/         # Application images
│   ├── components/            # Shared UI components
│   ├── context/               # Authentication context
│   ├── layouts/               # Public, auth, and app layouts
│   ├── lib/                   # Supabase client and feature logic
│   ├── pages/                 # App, auth, and recovery pages
│   └── styles/                # Page and shared CSS
├── supabase/
│   ├── migrations/            # Database migrations
│   └── manual_migrations/     # Migrations requiring manual review
├── .env.example               # Safe environment-variable template
├── index.html
├── package.json
└── vite.config.js
```

## Install and run

Requirements: Node.js and npm.

```sh
npm install
npm run dev
```

Vite prints the local development URL after startup. To create a production build, run `npm run build`. Run `npm run lint` to check the source.

## Supabase configuration

1. Create or select a Supabase project.
2. In the project settings, copy the **Project URL** and the **publishable key**. Use only a publishable key in this browser application. Never put a `service_role` key or other secret in a `VITE_` variable or commit it to Git.
3. Configure the Supabase Auth Site URL and allowed redirect URLs for local development and each deployed site. The password-recovery flow redirects to `/verify-otp`; allow the corresponding full URL for your local and deployed origins.
4. Configure the Auth email templates for account verification and password recovery. The recovery flow expects a six-digit email OTP; set the recovery email template to send the token (for example, `{{ .Token }}`), not a recovery link.
5. For reliable email delivery beyond Supabase's default email-service limits, configure a custom SMTP provider in the Supabase Auth settings. Keep SMTP credentials in Supabase's dashboard, not in this repository.

### Environment variables

The Supabase client reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from a local environment file. Copy the example file to `.env.local` and replace the placeholders with your own project's URL and publishable key:

```powershell
Copy-Item .env.example .env.local
```

On macOS or Linux, use:

```sh
cp .env.example .env.local
```

Vite loads `.env.local` when the development server starts. If you change it while the server is running, restart the server. `.env.local` is excluded by `.gitignore`; do not commit it. The committed `.env.example` must contain placeholders only.

## Database migrations

Review and apply the SQL files in `supabase/migrations/` to the project's Supabase database in filename order (or through your established Supabase migration workflow). The budgets migration expects the application's `public.categories` table to already exist. Review each migration and back up important data before applying it to a database with existing data.

`supabase/manual_migrations/20261115_unique_category_name_per_user_type.sql` is intentionally separate. Review duplicate category names for each user and transaction type first, resolve any duplicates, and then apply this migration manually.

## Authentication and password recovery

The app uses Supabase Auth for email/password signup and sign-in. Account creation stores the full name and username as Auth user metadata; the profiles migration creates/maintains profile rows from that metadata. Password recovery requests a six-digit OTP by email, verifies it, and permits a password update only for the verified recovery session. Configure Supabase's Auth redirect allowlist and recovery email template as described above.
