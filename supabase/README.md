# Supabase setup

This phase adds Google sign-in and the private cloud-records table. It does not
move local records or turn on cloud sync yet; those are the next implementation
steps so existing device data cannot be overwritten during first sign-in.

## Configure the project once

1. Create a Supabase project.
2. In **Authentication → Providers → Google**, enable Google and add the OAuth
   client credentials for Ledge. Set the Google OAuth redirect URI to the
   callback URL shown by Supabase.
3. Add the app's local and production origins to Supabase's allowed redirect
   URLs.
4. Apply `migrations/202611080001_initial_user_data.sql` in the Supabase SQL
   Editor (or through the Supabase CLI).
5. Copy the project URL and publishable key into the local `.env` using the
   names in `.env.example`, then restart the dev server.

The Google OAuth client belongs to the Ledge project. Users only choose their
Google account and approve sign-in; they do not provide an API key. The
publishable Supabase key is designed for client apps. The database's RLS
policies ensure signed-in users can access only rows whose `owner_id` matches
their authenticated user ID.

## Current scope

The Settings page can start and end a Supabase-backed Google sign-in session.
The existing IndexedDB data remains local, and the Google Drive backup remains
separate. Cloud record sync, safe first-device import, and multi-device realtime
updates have not been enabled yet.
