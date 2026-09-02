# Prime Time Miami — Launch Checklist

Who does what: **[F]** = friend creates the account (it's his business, his logins).
**[H]** = Henry does the technical step (10-15 min each).

## 1. GitHub — where the code lives
- [F] Create account at github.com (free).
- [F] Add Henry as a collaborator OR share login so Henry can push.
- [H] Create private repo `primetime-miami-site` under the friend's account, push this project:
  `git remote add origin <repo-url> && git push -u origin main`

## 2. Domain + email
- [F] Buy `primetimemiami.com` (Namecheap or directly inside Vercel, ~$15/yr).
- [F] Set up `sales@primetimemiami.com`:
  easiest = Cloudflare Email Routing (free, forwards to his Gmail),
  or the email add-on from wherever he buys the domain.

## 3. Vercel — hosting (free Hobby plan is fine)
- [F] Sign up at vercel.com **using "Continue with GitHub"** (that's the whole connection).
- [H] "Add New Project" → import the GitHub repo → Deploy. No build settings needed.
- [H] Project → Settings → Domains → add primetimemiami.com (Vercel shows the 2 DNS
  records to set where the domain was bought).

## 4. Supabase — inventory database (free plan is fine)
- [F] Sign up at supabase.com, create a project (name: primetime, region: US East).
- [H] SQL Editor → paste and run `supabase/schema.sql` from this repo (creates the
  pieces table + photo storage).
- [H] Seed the 553 pieces: run the one-time import from data/pieces.json (Henry has this).
- Keys live in Project Settings → API: copy the URL and the `service_role` key.

## 5. Resend — sends the inquiry emails (free plan is fine)
- [F] Sign up at resend.com.
- [H] Domains → add primetimemiami.com → add the 3 DNS records it shows → verified.
- [H] API Keys → create one, copy it.

## 6. Connect everything (Vercel → Settings → Environment Variables)
| Name | Value |
|---|---|
| SUPABASE_URL | from step 4 |
| SUPABASE_SERVICE_ROLE_KEY | from step 4 |
| RESEND_API_KEY | from step 5 |
| NOTIFICATION_EMAIL | sales@primetimemiami.com |
| ADMIN_PASSWORD | a strong password the friend picks (his dashboard login) |
| ADMIN_SECRET | any long random string (Henry generates) |
| CRON_SECRET | any long random string (Henry generates) |

Then Deployments → Redeploy. The admin at /admin.html switches from test mode to
the real database automatically.

## 7. Ten-minute test after launch
- [ ] primetimemiami.com loads, video plays
- [ ] Browse pieces, open a piece, WhatsApp button pre-fills
- [ ] Submit a Request form → email arrives at sales@
- [ ] Log into /admin.html with the real password → edit a piece → shows on site ≤1 min
- [ ] Mark a piece sold → disappears from site

## Later / optional
- Instagram live feed: connect his IG (Business account) to a free Meta developer app,
  drop INSTAGRAM_ACCESS_TOKEN into Vercel. The strip works fine without it (baked posts).
- Analytics: enable Vercel Analytics (one click in the dashboard).

## 8. Journal (added 2026-09-02)
The site now has a journal at `/journal` (empty until the first article) and a
Journal tab in `/admin` with a full editor. It needs one table + one storage
bucket in Supabase before it works:

- [H] Supabase → project **primetime** (ref `aeutowqtsqjqogpjjjqc`) → SQL Editor → New query.
- [H] Paste the whole **JOURNAL** section from `supabase/schema.sql` (everything
  from `-- JOURNAL (added 2026-09-02)` to the end of the file) and click Run.
  Expected result: "Success. No rows returned."
- No new env vars. It reuses SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and ADMIN_SECRET.
- Test: log in at `/admin`, click the Journal tab, New Article, type a title,
  upload a hero, Publish. It should show on `/journal` within a minute and open
  at `/journal/<slug>`.
- Not built yet (on purpose): email subscribers + "email this article" broadcast.
  Say the word and it gets added; it needs a subscribers table + Resend templates.
