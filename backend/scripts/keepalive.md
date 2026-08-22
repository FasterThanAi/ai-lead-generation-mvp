# Render Free Tier Cold-Start Mitigation & Keepalive Guide

## The Cold-Start Problem
Render's free tier spins down web services after **15 minutes of inactivity**. When a judge or evaluator visits the production web application after a period of dormancy, the first API request may experience a **30–50 second spin-up latency**.

## Recommended Mitigation (Automatic Uptime Pinger)

To keep SpecForge instantly responsive (sub-100ms response times) throughout evaluation, set up an external automated health check pinger to ping the lightweight `/health` endpoint every **10 minutes**:

### Target URL
```
https://<YOUR-RENDER-BACKEND-URL>/health
```
*(or `https://<YOUR-RENDER-BACKEND-URL>/api/health`)*

### Free Pinger Services (Takes < 1 minute to setup):
1. **[Cron-Job.org](https://cron-job.org)** (Recommended — 100% Free):
   - Create a free account.
   - Add a new cronjob:
     - URL: `https://<YOUR-RENDER-BACKEND-URL>/health`
     - Schedule: Every 10 minutes (`*/10 * * * *`)
     - Request Method: `GET`
2. **[UptimeRobot](https://uptimerobot.com)**:
   - Monitor Type: `HTTP(s)`
   - URL: `https://<YOUR-RENDER-BACKEND-URL>/health`
   - Monitoring Interval: `5 minutes` or `10 minutes`
3. **[Better Stack / Uptime](https://betterstack.com)**:
   - Add monitor for `/health`.

---

## Local Pre-Flight Keepalive Check
You can test and keep the backend warm locally or remotely using:
```bash
./scripts/preflight.sh https://<YOUR-RENDER-BACKEND-URL>
```
