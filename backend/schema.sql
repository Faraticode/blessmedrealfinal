-- Run this once in the Supabase SQL editor (or `psql $DATABASE_URL -f schema.sql`)
-- before starting the backend. It creates the `users` table with the same
-- fields your Mongoose User schema had.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),

  first_name text not null,
  last_name text not null,
  other_names text default '',
  email text unique not null,
  password text not null,
  wallet_address text,

  is_verified boolean not null default false,
  otp_code text,
  otp_expires_at timestamptz,

  age integer,
  blood_group text default 'Unknown',
  genotype text default 'Unknown',
  allergies text[] default '{}',
  medical_conditions text[] default '{}',
  emergency_contact jsonb,
  profile_picture text,

  points integer not null default 0,
  step_streak integer not null default 0,
  daily_step_goal integer not null default 5000,
  last_goal_met_date text,
  total_steps_lifetime integer not null default 0,
  step_milestones_reached integer[] default '{}',
  checkin_streak integer not null default 0,
  last_checkin_date text,

  qr_code_id text unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_email_idx on users (lower(email));

-- Daily step counts. One row per user per calendar day; steps for a given
-- day are upserted in place (never a new row per sync).
create table if not exists step_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,

  date text not null, -- "YYYY-MM-DD", local calendar day
  steps integer not null default 0 check (steps >= 0),
  source text not null default 'sensor' check (source in ('sensor', 'manual', 'google_fit')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, date)
);

create index if not exists step_entries_user_date_idx on step_entries (user_id, date desc);

-- One check-in per user per day. Wallet-signature-verified: `signature` is
-- the Stacks wallet signature over that day's deterministic challenge
-- message, `wallet_address` is the address that produced it.
create table if not exists daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,

  date text not null, -- "YYYY-MM-DD"
  mood text not null check (mood in ('great', 'good', 'okay', 'low', 'struggling')),
  note text default '',
  points_awarded integer not null default 0,
  streak_at_checkin integer not null default 0,
  wallet_address text not null,
  signature text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, date)
);

create index if not exists daily_checkins_user_date_idx on daily_checkins (user_id, date desc);

-- Medication reminders. `times` is a list of "HH:mm" strings; `days_of_week`
-- is a list of 0-6 (Sun-Sat) with an empty array meaning "every day".
create table if not exists medication_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,

  medication_name text not null,
  dosage text,
  times text[] not null,
  days_of_week integer[] not null default '{}',
  notes text,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists medication_reminders_user_idx on medication_reminders (user_id, created_at desc);

-- One quiz per user per day. `questions` stores the full generated set
-- (question/options/correctIndex/explanation) as JSON; `answers` stays null
-- until the quiz is submitted.
create table if not exists daily_quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,

  date text not null, -- "YYYY-MM-DD"
  questions jsonb not null,
  answers integer[],
  score integer,
  points_awarded integer not null default 0,
  completed boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, date)
);

create index if not exists daily_quizzes_user_date_idx on daily_quizzes (user_id, date desc);
