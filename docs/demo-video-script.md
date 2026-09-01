# AI Lead Generation Agent — Demo Video Script

**Team FasterThanAI** · Nupur · Priyanshu · Raj
**Target length:** 7:00 · **Format:** fully live, one take · **UI:** Midnight Aurora (dark mode)

| # | Speaker | Covers | In | Out | Budget |
|---|---------|--------|-----|-----|--------|
| 1 | **Nupur** | Problem statement + solution | 0:00 | 1:45 | 105s |
| 2 | **Priyanshu** | Live product walkthrough + backend | 1:45 | 5:00 | 195s |
| 3 | **Raj** | LLM pipeline + RAG | 5:00 | 6:50 | 110s |
| 4 | **Nupur** | Close + roadmap | 6:50 | 7:00 | 10s |

---

# ⚠️ READ THIS BEFORE YOU RECORD

You chose **fully live, one take**. That's the most convincing format and the most fragile. There are six specific things that will break this recording. All six are avoidable, none take more than a few minutes.

### 1. Render free tier sleeps. This is the biggest risk.

Your backend is on Render at `ai-lead-generation-mvp.onrender.com`. On the free tier it spins down after ~15 minutes of no traffic, and the next request takes **50 seconds or more** while it cold-starts. On a live take that's 50 seconds of silence and a dead-looking page.

**Fix:** open the API health URL in a browser tab **20 minutes before** you record, and refresh it every 5 minutes right up to the take. Keep that tab open during recording.

```
https://ai-lead-generation-mvp.onrender.com/api/health
```

You want it returning instantly before you hit record. I could not verify this from my sandbox — its network is restricted — so **you have to check it yourself**.

### 2. The new UI isn't deployed yet.

The Midnight Aurora redesign is committed on the `ui-glass-redesign` branch on your machine. It is **not on Vercel**. Run this yourself (my sandbox can't do git writes on the mounted folder):

```bash
cd ~/ai-lead-generation-mvp
rm -f .git/index.lock          # I left a stale one, harmless, just remove it
rm -rf _to_delete              # my scratch folder, safe to delete
git checkout main
git merge --ff-only ui-glass-redesign
git push origin main
```

I verified this is a clean fast-forward — **zero conflict risk**. Vercel redeploys in ~90 seconds. Then open the live URL and click all nine pages once, and hit the theme toggle, before you trust it.

### 3. Three integrations are dead and will throw errors on camera.

Hunter.io and Apollo.io subscriptions have lapsed; Vapi was never configured. The buttons still exist. **Do not click them.** Full list in the next section.

### 4. Gemini calls take 3–15 seconds each.

Research, scoring and email drafting all hit Gemini. Live, that's a long silence. **Pre-seed one campaign** the night before so nothing has to generate on camera (details below). If you do want one live generation for the wow factor, do exactly one — the Opportunity strategy — and have a filler line ready.

### 5. Gmail sending is real.

Clicking **Send** on an approved draft sends an actual email to that lead's actual address. Before recording, create a test lead whose email is **your own address**. Send to that one, then show it arriving in your inbox — that's a far better moment than sending to a stranger.

### 6. Do not open `.env` or your terminal history on camera.

`backend/.env` holds live Gemini and Gmail credentials. It is correctly gitignored and was never committed — I checked the full history — but it's on your disk. Close that editor tab before you share your screen.

---

## Pre-flight checklist

Work down this list. Don't skip.

**The night before**

- [ ] Merge and push the new UI (step 2 above); confirm Vercel deployed
- [ ] Open the live site, click all nine pages, toggle dark/light
- [ ] Pick **one** campaign as the demo campaign. Make sure it has:
  - [ ] 8–15 leads with real company names (not test junk)
  - [ ] most leads showing an email (run Email Extraction until coverage is >70%)
  - [ ] at least 5 leads **already researched** — research summary visible
  - [ ] at least 5 leads **already AI-scored** — score, priority, reason visible
  - [ ] 3–5 **email drafts already generated**, at least one already sent
  - [ ] one draft with a **reply already classified** (this is the best moment in the whole demo)
- [ ] Add one lead whose email is **your own address** — for the live send
- [ ] Knowledge page: at least 2 manual entries + 1 uploaded PDF, embeddings backfilled to 100%
- [ ] Opportunities page: one opportunity with a **generated strategy** already saved, and one **blank** one you can generate live if you want that moment
- [ ] Each person reads their section out loud twice with a timer

**20 minutes before**

- [ ] Open `.../api/health`, refresh every 5 min
- [ ] Open the live frontend in a second tab, let it fully load
- [ ] Close `.env`, close your terminal, close Slack/WhatsApp notifications
- [ ] Set display to 1080p or higher, browser zoom at 100%, **dark mode on**
- [ ] Do one silent full click-through of the exact demo path

**Right before**

- [ ] Refresh the health tab one final time
- [ ] Start on the **Dashboard**, scrolled to top
- [ ] Phones on silent

---

## 🚫 DO NOT CLICK — these will error live

| Where | Control | Why |
|---|---|---|
| Leads | **Hunter Enrichment** (any button in that section) | Subscription lapsed → API error |
| Leads / Settings | Anything Apollo | Subscription lapsed **and** the endpoint URL has a bug |
| Calls | **Start AI Call / Start Vapi Call** | `VAPI_ENABLED` is off → HTTP 400 "Vapi is not configured" |
| Leads | **Find Leads Now** (Lead Agent) | Only click if your n8n workflow is confirmed **active**. If it isn't, nothing appears and the UI polls forever |
| Lead Discovery | **Run Discovery** with only generated queries | Returns "Add public source URLs before running discovery" |
| Emails | **Send Approved Emails** (bulk) | Sends real email to real strangers. Use the single-send on your test lead instead |

**Safe to click freely:** every page nav, campaign select, theme toggle, all read-only views, Swagger `/docs`, Knowledge search, and single-send on your own test-lead draft.

---

# 1 · NUPUR — Problem & Solution
### 0:00 – 1:45 · on screen: title card, then the live Dashboard

---

**[0:00 – 0:15] Hook**

> "Hi, we're team FasterThanAI — I'm Nupur, and this is Priyanshu and Raj. We built an AI Lead Generation Agent. I want to start with the problem, because it's one that almost every services business has and almost nobody has solved properly."

**[0:15 – 0:55] The problem**

> "Any company selling B2B services — a training provider, an agency, a consultancy — lives or dies on a steady flow of new clients. Today, finding those clients is manual. Someone spends three to four hours a day on Google Maps and LinkedIn, copying business names into a spreadsheet, hunting for an email address, and then writing more or less the same email forty times.
>
> And it barely works. Generic bulk email gets around a one percent reply rate, because it reads like it was sent to a thousand people. Writing a genuinely personalised email means reading that company's website, understanding what they actually do, and finding a real reason to reach out — and that's fifteen to twenty minutes per lead.
>
> So you can do outreach well, or you can do it at scale. Not both. That's the gap."

**[0:55 – 1:35] The solution**

> "That's what we automated. Our system takes one input — *I sell this, to this kind of company, in this city* — and runs the entire outbound pipeline.
>
> It finds matching companies. It pulls their contact emails out of their own public websites. It reads each company's site and writes a short profile of what they do and what they're likely to need. It scores and ranks every lead. Then it drafts a personalised email built from those researched facts, plus our own product knowledge.
>
> And it doesn't stop at sending. It checks for replies, works out what the person actually wants, and drafts the response.
>
> The part we care most about: **a human never leaves the loop.** Nothing sends automatically. Every email, every follow-up, every reply is a draft that a person approves or rejects. The AI does the research and the typing. The human keeps the judgement."

**[1:35 – 1:45] Handoff**

> "Priyanshu is going to show you the whole thing running live."

**Cut this first if you're over time:** the "fifteen to twenty minutes per lead" sentence, and the reply-handling sentence — Priyanshu demonstrates it anyway.

---

# 2 · PRIYANSHU — Live Walkthrough & Backend
### 1:45 – 5:00 · on screen: the deployed site, dark mode

> **Pacing note:** you have 195 seconds and eight stops. That's ~24s each. Keep moving. Don't read the screen out loud — narrate *why*, let the screen show *what*.

---

### Stop 1 — Dashboard · ~20s

**DO:** Start here. Hover a stat card so it lifts. Hit the **theme toggle** in the top-right, pause one beat, toggle back to dark.

> "This is the command centre. Campaigns, total leads, the email funnel from generated through approved, sent and replied, and the average AI score across the pipeline. Everything you're about to see writes back into these numbers.
>
> — and the whole thing runs light or dark."

*The toggle is an 8-second flex. Don't linger past that.*

---

### Stop 2 — Opportunities · ~30s

**DO:** Open the opportunity with a strategy already generated. Scroll through the AI output.

> "This is where a campaign starts. You type a rough, messy goal in plain English — here it's *'sell our CAD certification to mechanical engineering colleges near Nagpur.'*
>
> Gemini turns that into a full go-to-market strategy: who to target, which roles, their likely pain points, the value proposition, an outreach angle, search keywords, an email script, a call script, a follow-up sequence, and qualification criteria.
>
> One paragraph in, a complete sales strategy out. And from here it's one click to turn that strategy into a live campaign."

**Optional live generation** — only if you've timed it and it's under ~15s. Click Generate on the blank opportunity and say while it runs: *"This is going out to Gemini now — it's writing about twenty structured fields, so give it a few seconds."*

---

### Stop 3 — Leads · ~55s (the core of the demo)

**DO:** Open the demo campaign. Scroll the lead table. Expand one high-scoring lead to show its research summary and score reasoning.

> "This is the working surface. Leads come in three ways: an automated agent that generates Google Maps search queries and pulls in businesses, a manual discovery tool where you paste public pages and we extract contacts from them, or a plain CSV upload.
>
> Then four things happen to every lead, and the order matters.
>
> **One — email extraction.** For any lead with a website but no email, we visit their public contact and about pages and pull the address out. If there isn't one visible, we generate the likely patterns, check the domain's mail records, and verify. That's our own code — no paid database.
>
> **Two — research.** [*expand a lead*] We fetch a few public pages and Gemini writes this: what the business actually is, who they sell to, their likely pain points, and how well they fit this campaign.
>
> **Three — scoring.** [*point at the score*] That research feeds a scoring pass. You get a number, a priority, and — this is the part I like — the *reason*. It's not a black box score. It tells you why, and what angle to lead with.
>
> **Four —** everything above becomes the raw material for the email."

---

### Stop 4 — Emails · ~45s

**DO:** Open a generated draft. Point at the specific, researched detail inside it. Then open the draft that has a **classified reply**.

> "Here's a draft the system wrote. Look at what's in it — [*point*] — that's not a template variable, that's a fact it found on their website during research.
>
> Nothing here has been sent. Everything is a draft with a status: generated, approved, sent. I approve it, and only then can it go out through Gmail — and there's a daily cap so nobody can accidentally blast a thousand emails.
>
> [*open the replied draft*] And this is the loop closing. This lead replied. The system read the reply, classified the intent — *asked for pricing* — flagged it high priority, and drafted a response using our own pricing document. Which I still have to approve before it sends.
>
> If there's no reply at all, it generates a follow-up instead. Same approval gate."

**DO (optional, high impact):** single-send the draft addressed to your own email, then alt-tab to your inbox and show it landed.

---

### Stop 5 — Backend · ~35s

**DO:** Open `https://ai-lead-generation-mvp.onrender.com/docs` in a new tab. Scroll the endpoint list so the sheer volume registers. Expand one endpoint.

> "Quick look under the hood, because this isn't a no-code wrapper.
>
> The backend is **FastAPI** — a hundred and eighteen endpoints across twenty route modules, seventeen services, seventeen database tables, about twenty thousand lines of Python.
>
> A request comes in from React through axios, hits CORS, gets routed, and Pydantic validates the body before any code runs. A database session is injected as a dependency, the route hands off to a service — all the actual logic lives in the service layer, not in the routes — and SQLAlchemy commits to Postgres on Supabase.
>
> The interesting part is the long jobs. Researching a hundred leads means a hundred Gemini calls — that would time out any HTTP request. So those endpoints return a job ID immediately, run in a background task, and write progress into a jobs table. The frontend just polls the job. Same pattern for extraction, research and scoring."

---

### Stop 6 — Knowledge + handoff · ~15s

**DO:** Open the Knowledge page. Show the entries and the embedding coverage.

> "Last piece — this is our own company knowledge. Pricing, case studies, course details, uploaded as documents. This is what stops the AI writing generic marketing copy, and it's the retrieval layer Raj is about to explain.
>
> Raj, over to you."

---

## Backend cheat sheet — for Priyanshu

Keep this open. You won't say most of it on camera, but you'll be asked.

**Request lifecycle**

```
React (axios)
  → CORS middleware            allowlisted origins from FRONTEND_URLS
  → /api prefix → APIRouter    20 route modules mounted in api_router.py
  → Pydantic schema            validates body, rejects bad input before logic runs
  → Depends(get_db)            SQLAlchemy session from a pooled engine, closed after
  → route handler              thin — no business logic here
  → service layer              17 services; talks to Gemini / Gmail / scraper
  → SQLAlchemy commit          Postgres (Supabase) in prod, SQLite locally
  → JSON  { status, message, data }
```

**Why the async job pattern exists**

A Gemini call takes 3–15 seconds. A hundred leads is 5–25 minutes. No HTTP request survives that, and Render would kill it. So:

```
POST /api/campaigns/{id}/research-leads-async   → returns { job_id } instantly
        ↓ FastAPI BackgroundTasks
   writes progress into lead_research_jobs (processed / total / failed)
        ↑
GET  /api/campaigns/research-job/{job_id}       ← frontend polls this
```

Same three-table pattern for `email_extraction_jobs`, `lead_research_jobs`, `lead_scoring_jobs`.

**Numbers worth quoting**

| | |
|---|---|
| API endpoints | 118 |
| Route modules | 20 |
| Service modules | 17 |
| Database tables | 17 |
| Backend Python | ~20,100 lines |
| Frontend JS/JSX/CSS | ~11,000 lines |
| Services calling Gemini | 10 |

**Safety model, in one breath:** nothing sends without `status = approved`; Gmail OAuth tokens live in the database, never in the frontend; a hard daily send cap; a `do_not_call` flag that blocks calling before any request is made; and every AI field has an accompanying error column so a failure is recorded rather than silently swallowed.

---

# 3 · RAJ — LLM Pipeline & RAG
### 5:00 – 6:50 · on screen: Knowledge page, then a lead's research/score, then a draft

---

**[5:00 – 5:15] Frame it**

> "Thanks Priyanshu. The thing I want to correct up front: this isn't one prompt. There are **eight distinct AI jobs** in this pipeline, each with its own prompt, its own context, and its own structured output. Let me walk the chain."

**[5:15 – 5:55] The chain**

> "It starts with **strategy** — the rough goal becomes a structured go-to-market plan. Then **query generation**, turning campaign context into actual search queries.
>
> When we scrape a page, **contact structuring** turns raw messy page text into clean contacts with a confidence score attached.
>
> Then per lead: **research** reads their site and writes a business profile. **Scoring** takes that research plus the campaign and produces a score, a priority, and a written justification. **Drafting** takes the lead, the research, the score *and* our own knowledge, and writes the email.
>
> After sending: **reply classification** works out intent, sentiment and priority. And **response drafting** writes the reply.
>
> Every one of those returns strict JSON, not prose. We parse it with a tolerant extractor, because language models love wrapping JSON in explanation — and every AI field has an error column, so when a call fails we record *why* instead of silently writing nothing."

**[5:55 – 6:40] RAG — the part judges care about**

**DO:** Knowledge page on screen. Point at an entry, then at the embedding coverage.

> "Now the retrieval layer, because this is what makes the emails ours and not generic.
>
> Gemini knows a lot about the world. It knows nothing about *our* pricing, *our* case studies, *our* course catalogue. So we don't fine-tune — we retrieve.
>
> You upload a PDF, a Word doc, a text file. We extract the text, split it into chunks, and store every chunk as a searchable row. Each chunk gets embedded with Gemini's embedding model — three thousand and seventy-two dimensions — stored in Postgres using pgvector.
>
> When the system drafts an email, it runs a hybrid search over that knowledge: semantic similarity first, with keyword search as a fallback if embeddings aren't available. It takes the top five matches above a similarity threshold and injects them into the drafting prompt.
>
> [*point at a draft*] And here's the part I'd highlight — every draft records **exactly which knowledge chunks the AI was given**. So when it quotes a price, you can trace where that number came from. The reasoning is auditable, not a black box.
>
> We chose retrieval over fine-tuning deliberately. Our pricing changes; a fine-tuned model would be stale the day it finished training, it'd cost far more, and it couldn't cite a source. Retrieval updates the moment you upload a new document."

**[6:40 – 6:50] Handoff**

> "That's the AI layer. Nupur will close us out."

---

## RAG cheat sheet — for Raj

```
UPLOAD    PDF / DOCX / TXT / MD
            ↓  document_service — text extraction
CHUNK     split into indexed chunks → one company_knowledge row each
            ↓  embedding_service
EMBED     gemini-embedding-001 · 3072 dimensions → pgvector column
            ↓
RETRIEVE  hybrid: cosine similarity (top-K = 5, min score = 0.50)
          with keyword search as fallback
            ↓
INJECT    matched chunks go into the drafting / reply prompt
            ↓
AUDIT     knowledge_used column on the draft records what was retrieved
```

Config lives in env: `ENABLE_SEMANTIC_RAG`, `SEMANTIC_RAG_TOP_K=5`, `SEMANTIC_RAG_MIN_SCORE=0.50`, `EMBEDDING_MODEL=gemini-embedding-001`, `EMBEDDING_DIMENSION=3072`, `GEMINI_MODEL=gemini-2.5-flash`.

---

# 4 · NUPUR — Close
### 6:50 – 7:00

> "So — one line of intent in, a queue of researched, scored, personalised emails out, with a human approving every single send.
>
> Next up for us: authentication and team roles, a search API so discovery runs fully automatically, and a WhatsApp channel, because for Indian SMBs a phone number is often the only contact you get.
>
> Thanks for watching."

---

# Q&A BANK

Answer honestly. Judges respect "here's what doesn't work yet" far more than a dodge — and every one of these has a good honest answer.

## For Priyanshu — product & backend

**"Is this just a wrapper around ChatGPT?"**
No. Gemini is one component inside seventeen backend services. We built the website scraper, the email-pattern-and-verification engine, the background job system, the RAG retrieval layer, and the approval state machine. Roughly thirty-one thousand lines across backend and frontend. The LLM writes text; the system does everything around it.

**"Where do the leads actually come from?"**
Three paths. An automated agent where Gemini writes Google Maps search queries and an n8n workflow runs them through Apify. A manual discovery tool where you paste public URLs and we extract contacts, respecting robots.txt. And plain CSV upload.

**"Do you buy an email database?"**
No. We scrape the company's own public website — contact and about pages. If there's no visible address we generate likely patterns, check the domain's mail records, and verify. Hunter.io and Apollo are supported as optional paid enrichment, but our free path replaces them, and they're switched off right now.

**"Isn't this spam?"**
Three guardrails. Nothing sends without a human approving that specific email. There's a hard daily send cap. And we only contact business addresses published on a company's own public website. What we don't have yet is an unsubscribe list and a do-not-contact register — that's the first compliance item on the roadmap, and we'd want it before any real volume.

**"What happens if Gemini is down or you run out of quota?"**
It degrades instead of crashing. Query generation falls back to industry templates. Research and scoring mark the lead as failed with the reason stored. Drafts simply don't generate. No page breaks.

**"Why FastAPI?"**
Async-native, which matters because we're making concurrent outbound HTTP calls to Gemini and to lead websites. Pydantic validation comes free. Background tasks are built in — that's what our async job system is built on. And auto-generated Swagger, which is what I just showed you.

**"What's your database?"**
Postgres on Supabase in production, SQLite locally, both through SQLAlchemy. Seventeen tables. pgvector for the embeddings.

**"Does it scale?"**
Honestly — to a point. Background jobs currently run in-process via FastAPI's BackgroundTasks. That's correct for an MVP and wrong for real volume; the next step is a proper queue, Celery or RQ with Redis. And there's no authentication yet, which is the single thing I'd fix before letting anyone else use it.

**"What's not working right now?"**
Three optional integrations are off: Hunter and Apollo subscriptions lapsed, Vapi voice calling was never configured. None of them are load-bearing — our own free extraction replaces Hunter and Apollo entirely. And the discovery tool's fully-automatic search mode isn't implemented; today you paste the URLs yourself.

**"How much does it cost to run?"**
Under thirty dollars a month at MVP volume. Gemini's free tier covers our usage, Gmail sending is free, hosting is free tier, and the only real cost is the Maps scraping at roughly five to thirty dollars a month.

**"How is this different from Apollo, Lemlist or Instantly?"**
Those sell you a contact database and a sending tool. Neither reads each company's website and writes from what it finds there. And in ours the AI's reasoning is visible and editable — you can see why a lead scored 88, what angle it suggests, and which knowledge it used. In those tools it's a template with merge fields.

**"How long did this take?"**
[*Your honest answer — and mention it's a working deployed system, not a prototype.*]

## For Raj — AI & RAG

**"Why Gemini and not GPT or Claude?"**
Cost and throughput. We make roughly four model calls per lead — research, scoring, drafting, and classification if there's a reply. At that volume 2.5-flash is fast and cheap, the free tier is generous, and embeddings come from the same SDK, so there's one integration instead of two.

**"Why RAG instead of fine-tuning?"**
Our knowledge changes — pricing, course lists, case studies. A fine-tuned model is stale the day training finishes, costs far more, and can't tell you where an answer came from. Retrieval updates the instant you upload a document, and it's auditable.

**"How do you stop it hallucinating in an email?"**
Four layers. Research is grounded in text we actually fetched from their site, not the model's memory. Knowledge chunks are our own verified documents. The prompt explicitly forbids stating pricing unless it came from retrieved knowledge. And a human reads every draft before it sends.

**"What's your chunking strategy?"**
Documents are split into indexed chunks, each stored and embedded independently, so retrieval returns the specific passage rather than a whole document.

**"Why 3072 dimensions?"**
It's the native output of Gemini's embedding model and pgvector handles it comfortably. We didn't truncate — our chunks are short, so recall matters more to us than storage.

**"What if semantic search returns nothing relevant?"**
There's a minimum similarity threshold of 0.50 — below that we return nothing rather than injecting a bad match, which is worse than no context. And keyword search is the fallback if embeddings aren't available at all.

**"How do you evaluate output quality?"**
Right now, two real signals: reply rate on sent emails, and the human approve-versus-reject ratio on drafts — if a person rejects a lot of drafts, the prompt is wrong. What we don't have is a formal evaluation set with graded outputs. That's a genuine gap and it's what I'd build next.

**"How do you get reliable JSON out of an LLM?"**
Prompts specify a strict schema, and we parse with a tolerant extractor that pulls the JSON object out even when the model wraps it in explanation. Every field is cleaned and type-checked, and if parsing fails we store the error on the record rather than writing garbage.

## For Nupur — problem & business

**"Who's the customer?"**
Any small-to-mid B2B services business doing its own outbound — training providers, agencies, consultancies, staffing firms. We built it for a training company, which is why the demo targets engineering colleges.

**"How big is the market / would anyone pay?"**
Every one of those businesses is already paying someone to do this manually, or paying for a tool that only does part of it. The pitch isn't a new budget line, it's replacing hours of a salesperson's day.

**"What's the one-year vision?"**
Multi-tenant with proper roles, a CRM sync, scheduled daily lead runs, and WhatsApp as a first-class channel alongside email — because in India, Maps data gives you a phone number far more often than an email.

---

# ONE-PAGE CUE CARD

*Print this. One per person.*

```
┌─ NUPUR ─────────────────────── 0:00–1:45 ─┐
│ Hook + team              0:00              │
│ Problem: 3–4 hrs/day manual, 1% reply      │
│ Tension: do it well OR at scale, not both  │
│ Solution: find → email → research →        │
│           score → draft → reply → follow   │
│ KEY LINE: human never leaves the loop      │
│ Handoff: "Priyanshu, running live"   1:35  │
└────────────────────────────────────────────┘

┌─ PRIYANSHU ─────────────────── 1:45–5:00 ─┐
│ 1 Dashboard      + THEME TOGGLE      20s   │
│ 2 Opportunities  rough goal → strategy 30s │
│ 3 Leads          extract/research/     55s │
│                  score/reason              │
│ 4 Emails         draft → approve →     45s │
│                  reply classified          │
│ 5 /docs          118 endpoints, jobs   35s │
│ 6 Knowledge      handoff to Raj        15s │
│                                            │
│ ⛔ Hunter · Apollo · Vapi · bulk send      │
└────────────────────────────────────────────┘

┌─ RAJ ───────────────────────── 5:00–6:50 ─┐
│ Frame: EIGHT AI jobs, not one prompt  15s  │
│ Chain: strategy → queries → contacts →     │
│        research → score → draft →          │
│        classify → respond             40s  │
│ RAG:   upload → chunk → embed(3072) →      │
│        hybrid retrieve top-5 → inject 45s  │
│ KEY LINE: every draft records which        │
│           chunks it used = auditable       │
│ Why not fine-tune: stale, costly, no cite  │
└────────────────────────────────────────────┘
```

**If you're running long:** Nupur cuts the "15–20 minutes per lead" line. Priyanshu cuts Stop 2 (Opportunities) entirely and mentions it in one sentence during Stop 3. Raj compresses the eight-job chain to "eight distinct AI jobs — research, scoring, drafting, classification and four more" and goes straight to RAG.

**If something breaks mid-take:** say *"that's the live backend waking up — while it does, let me show you…"* and move to a read-only page. Do not stop and restart; a small recovery reads as confidence.
