// Operator-only setup. Credentials remain in the server-side environment.
// Never execute this as part of app startup, a build, or publishing.
const apiKey = process.env.CRON_JOB_API_KEY;
const token = process.env.NEWS_SCHEDULER_TOKEN;
const urlArg = process.argv.indexOf("--url");
if (!apiKey || !token || token.length < 32 || urlArg < 0) {
  throw new Error("Requires CRON_JOB_API_KEY, NEWS_SCHEDULER_TOKEN (32+ characters), and --url <verified production origin>.");
}
const origin = new URL(process.argv[urlArg + 1]);
if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/") {
  throw new Error("Use a verified HTTPS production origin without credentials or a path.");
}
const targetUrl = new URL("/api/scheduled/news", origin).href;
const enable = process.argv.includes("--enable");

async function api(path, method = "GET", payload) {
  const response = await fetch(`https://api.cron-job.org${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Scheduler API failed (HTTP ${response.status}); no credentials or raw response logged.`);
  return response.json();
}

// Don't enable a job against an unpublished route. This performs one genuine
// collection; if it succeeds, repeat calls in this Vietnam-time hour are a no-op.
if (enable) {
  const response = await fetch(targetUrl, {
    method: "POST", headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(300_000),
  });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json"))
    throw new Error(`Published news callback not verified (HTTP ${response.status}). Publish and apply schema changes first.`);
  const result = await response.json();
  if (!result.scheduledSlot || typeof result.alreadyCompleted !== "boolean")
    throw new Error("Unexpected callback response; job not enabled.");
}
const jobs = await api("/jobs");
if (jobs.someFailed) throw new Error("Incomplete scheduler job listing; refusing to create a duplicate.");
const matches = jobs.jobs.filter((job) => job.url === targetUrl);
if (matches.length > 1) throw new Error("Multiple matching jobs already exist; review before changing them.");
const job = {
  title: "Manufacturing Synergy Hub — hourly Vietnam news",
  enabled: enable,
  url: targetUrl,
  requestMethod: 1,
  requestTimeout: 300,
  saveResponses: false,
  redirectSuccess: false,
  schedule: {
    timezone: "Asia/Ho_Chi_Minh", expiresAt: 0,
    // Every hour on the hour (-1 = every value in cron-job.org's API).
    hours: [-1], minutes: [0], mdays: [-1], months: [-1], wdays: [-1],
  },
  extendedData: { headers: { Authorization: `Bearer ${token}` }, body: "" },
  notification: { onFailure: true, onFailureCount: 1, onSuccess: true, onDisable: true },
};
let jobId;
if (matches.length) {
  jobId = matches[0].jobId;
  await api(`/jobs/${jobId}`, "PATCH", { job });
} else {
  ({ jobId } = await api("/jobs", "PUT", { job }));
}
const { jobDetails } = await api(`/jobs/${jobId}`);
if (jobDetails.enabled !== enable || jobDetails.schedule.timezone !== job.schedule.timezone ||
    JSON.stringify(jobDetails.schedule.hours) !== "[-1]" ||
    JSON.stringify(jobDetails.schedule.minutes) !== "[0]" ||
    jobDetails.requestMethod !== 1 || jobDetails.url !== targetUrl ||
    jobDetails.requestTimeout < 300) {
  // Never silently retain an enabled job with the wrong schedule or timeout.
  await api(`/jobs/${jobId}`, "PATCH", { job: { enabled: false } });
  throw new Error("Job configuration verification failed; job disabled.");
}
console.log(JSON.stringify({ jobId, enabled: jobDetails.enabled, timezone: jobDetails.schedule.timezone,
  hours: jobDetails.schedule.hours, minutes: jobDetails.schedule.minutes,
  requestTimeout: jobDetails.requestTimeout, nextExecution: jobDetails.nextExecution }));
