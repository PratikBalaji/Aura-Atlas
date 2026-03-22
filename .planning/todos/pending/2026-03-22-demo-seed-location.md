# Demo Seed + Location Stability

## Goal

Make the dashboard demo button reliably seed showcase data and stop geolocation errors from appearing before the user intentionally uses location features.

## Checklist

- [x] Reproduce or identify the demo seed failure path
- [x] Identify why geolocation errors surface on initial page load
- [x] Patch demo seeding to tolerate older `checkins` schemas
- [x] Make location tracking opt-in and user initiated
- [x] Verify database seeding path and location flow behavior
- [x] Document outcome and remaining risk

## Notes

- Confirmed current seed failure against Supabase: `Could not find the 'campus_name' column of 'checkins' in the schema cache`
- Current location hook auto-starts `watchPosition()` on mount, and `Map3DView` also requests geolocation on mount
- Verified fallback seeding against current database: optional `campus_name` and `hugs` fields were removed automatically and insert succeeded
- Verification note: repo-wide `npx tsc --noEmit` still fails because legacy backup files `Map3DView.backup.tsx` and `oldMap.tsx` contain broken relative imports unrelated to this fix

## Review

- Demo button should now succeed even on partially migrated `checkins` tables
- Location access is now user initiated from the dock instead of requested on page load
- Remaining risk: if the live `checkins` table is missing additional required columns beyond the current fallback behavior, the seed route will still return a clear API error
