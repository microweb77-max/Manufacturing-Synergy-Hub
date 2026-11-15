---
name: Daily news refresh policy
description: User-approved midnight schedule and external-trigger choice for the news page.
---

News collection should run automatically every day at midnight in Vietnam time rather than from visitor-facing refresh buttons. The user chose a separately scheduled, authenticated HTTP trigger while retaining Autoscale.

**Why:** An idle Autoscale instance may stop, so an in-process midnight timer cannot ensure execution when there are no visitors. The user explicitly selected the external-trigger approach after this limitation was explained.

**How to apply:** Do not reintroduce visitor collection buttons or describe a server timer as equivalent. Distinguish code readiness from external schedule activation; verify the credentials, published callback, database schema, enabled schedule, and next execution before claiming it is active.
