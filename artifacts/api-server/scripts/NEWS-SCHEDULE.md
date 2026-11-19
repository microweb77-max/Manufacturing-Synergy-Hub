# Hourly news schedule

The news page has no visitor-triggered collection buttons. The scheduler POSTs
to `/api/scheduled/news` every hour on the hour in `Asia/Ho_Chi_Minh` (UTC+07:00),
i.e. 24 collections per day (each run makes two Gemini calls).
The ordinary administrator `/api/news/collect` endpoint retains Clerk protection.
The scheduled callback has separate bearer authentication and is mounted before
Clerk; it does not accept member sessions or cookie admin flags.

## Activation (not automatic)

1. Apply the `news_refresh_slots` database schema to the environment that will run
   the callback. It stores completed Vietnam-time hours (`YYYY-MM-DDTHH`), not
   secrets or news content. (The older per-day `news_refresh_runs` table is no
   longer written and is kept only for history.)
2. Add `NEWS_SCHEDULER_TOKEN` (a new random credential, at least 32 characters)
   through Replit Secrets. Do not reuse Clerk keys or session secrets.
3. In the cron-job.org console, create an API key and add it as
   `CRON_JOB_API_KEY` through Replit Secrets. It is operator-only and not sent
   to the browser.
4. Obtain the published origin through Replit deployment metadata; never guess
   a URL or use the Preview URL as the scheduled production target.
5. Prepare a disabled job:
   `node artifacts/api-server/scripts/configure-news-schedule.mjs --url https://VERIFIED-ORIGIN/`
6. After the user republishes this code and the production schema is present,
   run the same command with `--enable`. It verifies the authenticated published
   callback with one real collection before enabling the hourly schedule.
   Re-running it against an existing daily job PATCHes that job to hourly.
7. Confirm the job's `nextExecution` and execution history in cron-job.org.

The job requires a 300-second request timeout; the setup script rejects accounts
that cannot retain that setting rather than enabling an unreliable timeout.
It enables failure, recovery and auto-disable notifications to the scheduler
account. `saveResponses` is off. The two Gemini calls remain synchronous so
Autoscale cannot terminate a background collection after sending an early 202.
The response is sent only after the database commit.

The global PostgreSQL advisory lock prevents concurrent collectors across
instances. The completion marker and inserted articles commit in one
transaction. Successful retries in the same Vietnam-time hour skip the AI calls;
failed runs can be retried. There is no promise of automatic retries by the
external provider: failures generate notifications and an operator can retry.

An open news page refetches saved articles every minute and on window focus.
Each run passes the 40 most recently saved headlines to the search prompt and
asks for stories from the last 24–48 hours, so hourly runs look for new stories
instead of repeating the same ones; title de-duplication still applies.

Do not claim the hourly schedule is active until secrets, publishing, schema,
and the external enabled job have all been verified.

## Daily 구인 (hiring) job postings

The same setup script also manages a second job that POSTs to
`/api/scheduled/talent` once a day at 08:00 `Asia/Ho_Chi_Minh`. It collects
구인 (hiring) posts only (8 per run, two Gemini calls) and uses the same
`NEWS_SCHEDULER_TOKEN`. 구직 (seeking) posts stay admin-triggered.

1. Publish this code so the `talent_refresh_runs` table exists in production.
2. Prepare a disabled job:
   `node artifacts/api-server/scripts/configure-news-schedule.mjs --job talent --url https://VERIFIED-ORIGIN/`
3. Run it again with `--enable`; it performs one real collection first.

Completed days are recorded per post type in `talent_refresh_runs`
(`YYYY-MM-DD`, `hiring`) in the same transaction as the inserted posts, so a
retry on the same day is a no-op and a failed run can be retried. Talent
collection uses its own advisory lock `(728301, 2)` and does not block news.
Each run lists the 30 most recently saved posts of the same type in the search
prompt so it looks for new postings.
