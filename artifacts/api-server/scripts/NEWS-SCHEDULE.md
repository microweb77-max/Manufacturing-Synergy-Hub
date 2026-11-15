# Daily news schedule

The news page has no visitor-triggered collection buttons. The scheduler POSTs
to `/api/scheduled/news` at midnight in `Asia/Ho_Chi_Minh` (UTC+07:00).
The ordinary administrator `/api/news/collect` endpoint retains Clerk protection.
The scheduled callback has separate bearer authentication and is mounted before
Clerk; it does not accept member sessions or cookie admin flags.

## Activation (not automatic)

1. Apply the `news_refresh_runs` database schema to the environment that will run
   the callback. It stores completion days, not secrets or news content.
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
   callback with one real collection before enabling the daily schedule.
7. Confirm the job's `nextExecution` and execution history in cron-job.org.

The job requires a 300-second request timeout; the setup script rejects accounts
that cannot retain that setting rather than enabling an unreliable timeout.
It enables failure, recovery and auto-disable notifications to the scheduler
account. `saveResponses` is off. The two Gemini calls remain synchronous so
Autoscale cannot terminate a background collection after sending an early 202.
The response is sent only after the database commit.

The global PostgreSQL advisory lock prevents concurrent collectors across
instances. The completion marker and inserted articles commit in one
transaction. Successful retries on the same Vietnam day skip the AI calls;
failed runs can be retried. There is no promise of automatic retries by the
external provider: failures generate notifications and an operator can retry.

An open news page refetches saved articles every minute and on window focus.
Do not claim the daily schedule is active until secrets, publishing, schema,
and the external enabled job have all been verified.
