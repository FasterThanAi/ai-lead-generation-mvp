# Prasunethon 2.0 — Final Submission Prep

Team Avengers · LeadGenAI · prepared 22 Aug 2026

Deliverables required: **source code · documentation · deployed demo · PPT · demo video**

---

## A. Screenshots to capture

Save as PNG, **light mode**, minimum 1600px wide, from the deployed site
(`ai-lead-generation-mvp.vercel.app`). Use realistic data — no empty tables, no
lorem text. Blur or replace any real customer email address.

Use these exact filenames:

| # | Filename | What it must show |
|---|----------|-------------------|
| 1 | `01-dashboard.png` | Dashboard with real stat tiles and recent activity |
| 2 | `02-campaigns.png` | Campaigns list with 3+ campaigns |
| 3 | `03-campaign-detail.png` | One campaign opened — offer, industry, location, role |
| 4 | `04-discovery.png` | Lead Discovery page mid-run or with results pending review |
| 5 | `05-leads-table.png` | Leads table showing score, priority and status columns |
| 6 | `06-lead-research.png` | AI research profile — business type, pain points, fit, risk flags |
| 7 | `07-lead-score.png` | The explainable score with its written reason and outreach angle |
| 8 | `08-email-draft.png` | Generated cold email draft with approve / reject controls |
| 9 | `09-settings-gmail.png` | Settings page showing Gmail connected state |
| 10 | `10-reply-classification.png` | A classified reply — intent, sentiment, priority, next action |
| 11 | `11-knowledge.png` | Knowledge base with uploaded documents listed |
| 12 | `12-knowledge-retrieval.png` | A grounded AI response showing retrieved company facts |
| 13 | `13-calls.png` | Calls page with a real call log, outcome and transcript |
| 14 | `14-opportunities.png` | Campaign / opportunity generator output |
| 15 | `15-n8n-workflow.png` | The n8n workflow canvas showing your real nodes |

**For the deck specifically:** crop to the meaningful region rather than
shrinking a full 1920px page — a full-page screenshot becomes unreadable at
slide size. If a page has a wide empty right margin, crop it out.

If you also have the n8n workflow JSON export, send that too — it lets the
architecture figure match your actual node graph.

---

## B. Repo — do this before submitting

`backend/.env` (live Gemini + Gmail credentials) and `leadgen.db` are committed
to git history. The submission is scored on security, and this is the first
thing a technical judge checks.

**Step 1 — rotate the exposed credentials.** They are already public, so
purging history alone does not fix the leak.

- New Gemini API key — Google AI Studio
- New Gmail OAuth client secret — Google Cloud Console

**Step 2 — update the deployed backend** (Render environment variables) with the
new values, then re-connect Gmail in the app and send one test email to confirm
it still works. Budget ~30 minutes. Do this *before* recording the demo video,
not after.

**Step 3 — stop tracking the secrets:**

```bash
git rm --cached backend/.env leadgen.db
printf '\n.env\n*.db\nvenv/\n__pycache__/\n' >> .gitignore
git commit -m "chore: remove committed secrets and local database from tracking"
```

**Step 4 — purge them from history.** Back up the repo folder first; this
rewrites history and anyone else with a clone must re-clone.

```bash
pip install git-filter-repo
git filter-repo --path backend/.env --path leadgen.db --invert-paths --force
git remote add origin https://github.com/FasterThanAi/ai-lead-generation-mvp
git push --force origin main
```

**Step 5 — push your 6 unpushed commits, then tag the submission point:**

```bash
git push origin main
git tag -a v1.0-prasunethon -m "Prasunethon 2.0 final submission"
git push origin --tags
```

**Step 6 — README for judges.** Add near the top: what it does in two lines, the
live URL, a screenshot of the dashboard, setup steps, required env vars
(pointing at `.env.example`), and a short "architecture in 60 seconds" section
noting that Apify/Maps sourcing runs inside n8n rather than in this repo.

---

## C. Report restructure — 44 pages to roughly 22

The content is good; the structure repeats itself and carries no visual proof.
Current chapters 10 (UI/UX) and 7 (Module Design) describe the same screens
twice, and 14/15/17/18 all discuss forward-looking work.

| New chapter | Pages | Built from |
|---|---|---|
| 1. Executive Summary | 1 | current §1 |
| 2. Problem and Objectives | 2 | §2 + §3.3 |
| 3. System Overview and Workflow | 2 | §3.1 + §4, keep Fig 4.1 |
| 4. System Architecture | 3 | §5 + §6 as one stack table + **new n8n figure** |
| 5. Module Design (screenshot-led) | 4 | §7 compressed, §10 folded in as the screenshots |
| 6. AI and Data Workflows | 2 | §8 — keep the RAG detail, it is the differentiator |
| 7. Data Model and API | 2 | §9 + Fig 9.1 + Table 9.1 |
| 8. Security, Safety and Governance | 2 | §11 + §12.3 |
| 9. Testing and Validation | 1.5 | §12 as a single matrix |
| 10. Deployment and Demo | 1.5 | §13 + live URLs + demo sequence |
| 11. Impact, Limitations and Roadmap | 2 | §14 + §15 + §17 + §18 merged |
| 12. Conclusion | 0.5 | §19 |

Team and responsibilities (§16) moves to the title page or a half-page appendix.

**New content to add:**

- **n8n automation architecture figure** — backend → `N8N_WEBHOOK_URL` →
  Apify/Google Maps → normalise → `POST /api/leads/create`. This matters
  because Apify does not appear anywhere in the repo; without the figure it
  reads as an overclaim, with it, it reads as a deliberate boundary.
- **A short honest limitations subsection** — the API currently has no
  authentication layer, and SMTP verification on port 25 is blocked by most
  cloud hosts so email confidence caps at MX-level in production. Stating known
  gaps with a mitigation plan scores better than leaving a judge to find them.

---

## D. Corrections needed in the deck

| Slide | Issue | Fix |
|---|---|---|
| 4 | "103 commits" — actual is 64 local / 58 on origin | Push, then restate, or drop the number |
| 6 | 92% / 82% / 78% bars are not measured anywhere | Replace with a real discovery screenshot |
| 11 | "Auth + validation" — no authentication exists | Change to request validation; move auth to roadmap |
| 13 | Drawn mock dashboard with invented figures | Replace with `01-dashboard.png` |
| 4, 14 | Hunter listed as an active enrichment path | Lead with the free scraper + email-guesser path |
| 9 | Vapi calling shown without constraint | Footnote: demo calls run to a verified test number on the current plan |

Screenshots to add: slide 6 (discovery), 7 (research + score), 8 (email draft),
10 (knowledge), 13 (dashboard).
