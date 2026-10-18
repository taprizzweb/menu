# Platform admin and two-step sign-in (Phase 5)

## Who needs two-step sign-in
| Account | Authenticator app required? |
|---|---|
| Platform admin (you) | Yes, always |
| Restaurant owner and manager | Yes |
| Waiter, kitchen | No |

The first time an owner, manager or admin signs in they choose their own password (if it was a temporary one) and then set up an authenticator app (Google Authenticator, Microsoft Authenticator, Authy). After that, every sign-in asks for the 6-digit code. The rule is enforced in three places: the page, the server and the database itself.

## Create the first platform admin (one time, on the real Supabase project)
1. In the Supabase dashboard open **Authentication → Users → Add user → Create new user**. Enter your email and a long password. Tick **Auto Confirm User**.
2. Open **SQL Editor → New query**, paste the following (use the same email), and click **Run**:
   `insert into public.platform_admins (user_id) select id from auth.users where email = 'YOU@EXAMPLE.COM';`
3. Go to `https://menu.taprizz.in/login`, sign in, and follow the screens to set up your authenticator app. You land on `/admin`.
4. Keep a second device (or the setup key written down and stored safely) in case you lose your phone.

## What you can do in /admin
Create a restaurant and its owner login (a temporary password is shown once), set plan and paid-until date, suspend / activate (a suspended restaurant cannot take orders and its staff cannot change anything), see last order time and total orders, read any restaurant's activity log, download all of a restaurant's data as JSON, and permanently delete a restaurant (you must type its address exactly; its staff logins and photos are removed too).

## Supabase settings to switch on (staging first, then production)
In **Authentication → Providers → Email**: minimum password length **12**; on a paid plan also switch on **Prevent use of leaked passwords**. In **Authentication → Multi-Factor**: make sure **TOTP** is enabled. Session length ("time-box") is a paid-plan setting; the default access token lasts one hour and is refreshed automatically.

## Error monitoring (optional, free)
Create a free Sentry project (Node.js / Next.js), copy its DSN, and add it as `SENTRY_DSN` in the Vercel environment variables. Nothing is sent without it. Only the error type, a scrubbed message, the request id and the page path are sent.

## Local demo
`npm run test:e2e` starts a local stand-in. Demo logins: `admin@gotomenu.demo`, `owner@spice-garden.demo`, `manager@spice-garden.demo` (password `DemoPass#2025!`; authenticator secret `JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP` for the local stack only).
