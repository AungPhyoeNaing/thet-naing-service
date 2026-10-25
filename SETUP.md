# Activate Admin / Staff accounts and photos

The app works locally without a login. **Real accounts and database-enforced roles require Supabase shared mode.** Browser-local mode has Admin access on that device and is intended for a single trusted operator/demo.

## 1. Install or upgrade the workshop backend

Use the Supabase project dedicated to Thet Naing Service; never reuse the clinic project.

1. Back up existing workshop records.
2. Run the complete `supabase/schema.sql` in Supabase SQL Editor as the project owner. It is transactional and rerunnable. Existing records and user memberships are preserved. Existing memberships default to **Staff**; no user is silently promoted.
3. Disable public signups under Supabase Auth settings. Create the owner's email/password account in Auth → Users. Give each person their own account, rather than a shared staff password.
4. Bootstrap the first Admin using SQL Editor, replacing the example email:

```sql
insert into public.workshop_staff(user_id, role, display_name)
select id, 'admin', 'Workshop owner'
from auth.users where lower(email) = lower('owner@example.com')
on conflict (user_id) do update
set role = 'admin', active = true, display_name = excluded.display_name;
```

5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` using `.env.example`. Use only the public publishable/anon key. **Never use a service-role or secret key in the frontend.** Rebuild/redeploy the app after setting these build-time values.
6. Sign in as Admin, open Settings → Accounts & access. Create other users in Supabase Auth first, then approve their email, name and role in the app. Optionally link a person to a technician name for the default Today’s work filter.
7. Password creation, invitations and password resets are managed in Supabase Auth. No passwords are stored in workshop data or audit history. Keep a second trusted Admin for recovery; the app prevents disabling/demoting the last active Admin.

Sites hosting access and workshop account roles are separate. This Site remains owner-private. To let staff open the hosted app, the owner must also grant the intended people Site visitor access. This change does not make the Site public or invite anyone automatically.

## 2. Daily permissions

| Action | Admin | Staff |
| --- | --- | --- |
| Today’s work, Repairs, search all repairs | Yes | Yes |
| Create repair, assign technician, diagnosis, notes | Yes | Yes |
| Prepare draft charges | Yes | Yes, before Admin finalizes |
| Finalize/revise charges and issue stock | Yes | No |
| Progress finalized repairs and complete quality checks | Yes | Yes |
| Record payments, collection or cancellation | Yes | No |
| Repair photos | Yes | Add; remove own attachments on open repairs |
| Inventory and its photos, customer directory, reports/export | Yes | No |
| Accounts, technicians, backup/restore and settings | Yes | No |

Today’s work shows active jobs that are due/overdue, urgent, in progress, waiting, ready, newly received today, or assigned to the linked technician. It uses Asia/Rangoon dates. Repairs includes every job and is available for handovers; assignment is a filter, not a privacy restriction.

Staff can read the workshop snapshot used by repair screens, including repair charges and parts reference data. Restricted pages and financial writes are protected, but this is **not** a promise that raw workshop totals are confidential from authenticated staff. A future requirement to hide particular data would need a separate read projection.

## 3. Optional photos

- Open a saved repair → Repair details → Photos. Choose **Take photo** on supported phones, or **Choose photo**. Label the stage: Intake, Diagnosis, Repair, or Quality check. A caption is optional. Limit: 8 photos per repair.
- Open an existing inventory part → Photos. Add a photo of the part, label or packaging. Limit: 4 photos per part. Save a new part before attaching its photos.
- Photo input accepts JPG, PNG and WebP up to 10 MB each. The browser converts to JPEG, removes source metadata through canvas rendering, reduces the longest side to at most 1280 px, and compresses to at most 220 KB. Unsupported formats such as HEIC must first be converted.
- Photos are never required to create or complete a repair. Closed repairs keep their existing photos read-only.
- In cloud mode, images use the private `workshop-photos` bucket installed by the schema. Signed viewing links expire after one hour; disabling an account blocks new database/storage access, but an already issued link remains valid until expiry. The PWA does not cache API responses or cloud images for offline access.
- Staff may upload only into their own folder for an existing open repair. Inventory uploads require Admin. Staff cannot overwrite files or delete storage originals. Removing an attachment keeps its original private for audit/backup recovery. Abandoned uploads from network failures may also remain private; the project owner should periodically review storage usage and only clean up files after checking current records, audits and retained backups.

## 4. Backups and migration

Local photos are embedded in workshop JSON, so local backups include them. Browser storage capacity is limited; a failed save leaves the previous records intact. Use cloud mode for regular photo use across multiple devices.

Cloud JSON backups contain photo references, **not the image binaries**. Back up the private Storage bucket separately; keep its object paths unchanged when restoring into another project. Audit records and account roles also live outside the workshop snapshot and need their own database backup. Restoring a workshop backup does not reset roles or erase the independent audit table.

Restoring an old local JSON into cloud mode preserves embedded images as legacy attachments; it does not silently upload them. New cloud photos use private Storage. Review any local backup before putting it into the shared workshop.

## 5. Enforcement and verification

Staff writes use `staff_workshop_action`, which locks the server snapshot, validates a specific command and builds the change itself. Staff cannot use the old whole-snapshot `save_workshop` endpoint. Admin saves retain atomic stock/payment updates and stale revision checks. Membership is checked live, so disabling or demoting an account affects subsequent database calls even with an existing session. The interface refreshes membership/data every 30 seconds and on focus, and clears displayed data when access checks fail. Sign-out is available in the header for both roles.

The server stamps new repair-history entries with the acting user and writes an independent audit with before/after changes. Settings shows the latest 30 audit summaries. Existing historical entries without an actor retain their original contents; the system does not invent an author for them.

## 6. Vercel same-origin connection (VPN-free access)

The browser connects to `/workshop-api` on the workshop website. Vercel forwards Auth, REST/RPC and Storage requests to this workshop's fixed Supabase project. Signed photo links are also generated on the website's domain; uploads and private image downloads follow the same route. Existing sessions keep the `thet-naing.auth.v1` key. Roles and Supabase RLS continue to apply to every request.

Keep the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` settings in Vercel. The project URL remains `https://sydhltbgymwutkvuhmpl.supabase.co` (without `/rest/v1/`); do not replace it with the website URL. No additional secret or service-role key is needed. `vercel.json` pins the proxy upstream to this project; if the Supabase project is ever changed, update both that file and the Vercel environment variables.

Deploy the latest GitHub commit on Vercel. A push to `main` triggers deployment when Vercel's Git integration is connected; otherwise select Redeploy after importing/syncing the latest source. Vite dev/preview servers use the matching local proxy, so browser requests stay same-origin during development too. A plain static host must provide equivalent proxy routes to run this version in cloud mode.

Auth responses, records and private photos are marked `private, no-store`; both Vercel CDN caching and service-worker navigation fallback are disabled for the API paths. The proxy does not grant any new account permissions or use an admin credential.

After deployment, refresh the app so the installed PWA picks up its updated service worker. With VPN off, check sign-in, repair loading/saving, a photo upload and a photo opened in a new tab. Browser network requests for those operations should all use your website's `/workshop-api/...` paths. A request to `/workshop-api/auth/v1/health` with the project's public anon key in the `apikey` header should return Supabase's health response (200); without that header Supabase returns 401. A protected REST request without user sign-in should still be denied. If you see app HTML instead, check that Vercel deployed the latest `vercel.json` and commit.

This removes the browser's need to reach Supabase directly. It still depends on the visitor being able to reach the website's Vercel/custom domain and Vercel being able to reach Supabase. Validate on the affected connection before treating the VPN issue as resolved. Email links/OAuth and Realtime WebSockets are outside this app's current password-login and polling workflow.

Run `npm test`, `npm run build`, and `npm run lint`. Tests use PGlite with mocked Auth and Storage tables to exercise SQL policies and commands. Before operational use, also verify real Supabase sign-in, staff restrictions, image upload/viewing, disabling a session, and backup/restore on your configured project. That live backend check cannot be completed without the project's configuration and accounts.

Reference: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [private Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals), [Storage access policies](https://supabase.com/docs/guides/storage/security/access-control).
