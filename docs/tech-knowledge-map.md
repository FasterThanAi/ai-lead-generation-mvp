# Tech Knowledge Map — AI Lead Generation Agent

**What each of you needs to know cold, mapped to what is actually in your code.**  
Team FasterThanAI · Priyanshu · Nupur · Raj

Every technology listed below is really in your `package.json` or `requirements.txt`. Nothing here is generic advice — each entry says *why it's in this project*, *which file it lives in*, and *the question a judge will ask*.

---

## The one thing to get right before anything else

Your project is an **applied AI system**. It uses large language models and embeddings through APIs. It does **not** train, fine-tune, or evaluate machine-learning models.

That is not a weakness — it's the correct architecture for this problem, and most production AI products in 2026 look exactly like this. But claiming ML you didn't do is the fastest way to lose a technical judge.

> **If asked "what ML is in this?"** — *"We're an applied-AI system. We don't train models; we orchestrate them. The engineering is in the retrieval layer, the structured-output handling, the grounding, and the pipeline around it. Training our own model on this data volume would be worse and more expensive than what we've built."*

That answer is honest, technically correct, and stronger than a bluff.

---

# PART 1 · FRONTEND — Priyanshu

**Stack:** React 19 · Vite 8 · Tailwind CSS 4 · React Router 7 · axios · Recharts 3 · Framer Motion 12 · ESLint 10

## The libraries

### React 19
**What:** A JavaScript library for building UIs out of reusable components.  
**Why here:** Nine pages, all sharing the same nine UI primitives (Button, Card, Badge, Table…). Without a component model you'd copy the same table markup nine times.  
**Where:** `src/pages/*.jsx`, `src/components/*.jsx`  
**Judge asks:** *"Why React and not plain HTML/JS?"*  
→ *"State. This UI polls background jobs, updates lead tables as scores come in, and manages draft approval states. Doing that by hand with DOM manipulation across nine pages would be unmaintainable."*

### Vite 8
**What:** The build tool and dev server. Bundles your JSX into browser-ready JavaScript.  
**Why here:** Instant hot reload during development; produces one optimised bundle for Vercel.  
**Where:** `vite.config.js`  
**Know this:** `VITE_API_BASE_URL` is read at **build time**, not runtime. If you change it on Vercel you must redeploy — a very common gotcha.

### React Router 7
**What:** Client-side routing — URL changes swap components without reloading the page.  
**Why here:** `/leads`, `/emails`, `/discovery` etc. all feel like separate pages but it's one app.  
**Where:** `src/App.jsx` (the `<Routes>` block)  
**Know this:** Your `frontend/vercel.json` has a rewrite sending every path to `index.html`. **Understand why:** the server has no `/leads` file — React Router creates that route in the browser. Without the rewrite, refreshing on `/leads` gives a 404. Judges who've deployed an SPA love this question.

### Tailwind CSS 4
**What:** Utility-first CSS — you style with class names instead of separate stylesheets.  
**Why here:** ~11,000 lines of frontend with a consistent look, no CSS file sprawl.  
**Where:** `tailwind.config.js`, `src/index.css`  
**Know this (new since the redesign):** every colour is a CSS custom property defined in `index.css`. One class on `<html>` — `.dark` or `.light` — repaints the entire app. That's why the theme toggle is instant and why nothing is hard-coded.

### axios
**What:** HTTP client. Makes requests from browser to backend.  
**Why here:** One configured instance with a base URL, so no page repeats the API host.  
**Where:** `src/services/api.js` — 12 lines, and every page imports it.  
**Judge asks:** *"Why axios over fetch?"* → *"A single configured instance with a base URL and default headers, and cleaner error objects. With 118 endpoints, centralising that mattered."*

### Recharts 3
**What:** Charting library built on React and SVG.  
**Why here:** The Dashboard email funnel and reply-signal charts.  
**Where:** `src/pages/Dashboard.jsx`  
**Nice detail:** the charts read `var(--chart-1)` through `var(--chart-5)` straight out of CSS, so they recolour with the theme automatically. That's SVG inheriting CSS custom properties — worth mentioning if charts come up.

### Framer Motion 12
**What:** Animation library for React.  
**Why here:** Page transitions, the sliding active pill in the sidebar, card hover lifts, count-up stat numbers.  
**Where:** `src/App.jsx`, `src/components/Sidebar.jsx`, `src/components/StatCard.jsx`  
**Know this:** the sidebar pill uses `layoutId` — two elements sharing a `layoutId` get automatically animated between positions. That's the one genuinely clever bit.

### ESLint 10
**What:** Static analysis — catches bugs and bad patterns before runtime.  
**Why here:** Specifically `eslint-plugin-react-hooks`, which catches the classic React mistakes (missing dependencies, conditional hooks).

## The concepts behind them

You need these more than you need library trivia.

| Concept | Why it matters in *your* code |
|---|---|
| **Components, props, state** | Every `.jsx` file. `Badge` takes a `variant` prop and renders differently — that's the whole model. |
| **`useState` / `useEffect`** | `useState` holds data that changes (the lead list). `useEffect` runs side effects (fetching on mount, starting a poll). |
| **Rules of hooks** | Hooks run top-level only, never inside conditions or loops. Break this and React breaks silently. |
| **Async / await, Promises** | Every API call. `await api.get(...)` pauses until the server responds without freezing the page. |
| **Polling** | Your background jobs need it: `setInterval` hits `/research-job/{id}` every few seconds until status is `completed`. Understand *why* — HTTP is request/response, the server can't push. |
| **Controlled inputs** | Form fields whose value lives in React state. That's how campaign creation and discovery job forms work. |
| **CORS (browser side)** | The browser blocks cross-origin requests unless the server allows it. Your Vercel frontend calling a Render backend is cross-origin — that's what the CORS middleware exists for. |
| **Conditional rendering** | `{isLoading ? <Skeleton /> : <Table />}` — used everywhere. |
| **Keys in lists** | `key={lead.id}` when mapping. Without stable keys React re-renders wrongly. |
| **Build-time env vars** | Only `VITE_`-prefixed variables reach the browser. This is a *security boundary* — anything you put there is public. |

---

# PART 2 · BACKEND — Priyanshu

**Stack:** Python 3.12 · FastAPI · Uvicorn · Pydantic 2 · SQLAlchemy 2 · PostgreSQL (Supabase) · BeautifulSoup · dnspython · Google APIs

## The libraries

### FastAPI + Starlette + Uvicorn
**What:** FastAPI is the web framework. Starlette is the ASGI toolkit underneath it. Uvicorn is the server that actually runs it.  
**Why here:** Async-native (you make many concurrent outbound calls), automatic validation via Pydantic, built-in background tasks, and auto-generated Swagger docs at `/docs`.  
**Where:** `app/main.py`, `app/api/routes/*.py`  
**Know the layering:** Uvicorn (server) → Starlette (ASGI plumbing, middleware) → FastAPI (routing, validation, DI). If someone asks "what is ASGI?" — *"the async successor to WSGI; it lets one process handle many concurrent requests without a thread per request."*

### Pydantic v2
**What:** Data validation using Python type hints.  
**Why here:** Every request body is validated before your code runs. Bad input gets a 422 automatically — you never write validation code.  
**Where:** `app/schemas/*.py`  
**Judge asks:** *"How do you handle bad input?"* → *"We don't, explicitly. Pydantic rejects it at the boundary with a structured error before any handler executes."*

### SQLAlchemy 2.0
**What:** ORM — Python classes map to database tables.  
**Why here:** 17 tables with relationships (a Campaign has many Leads, a Lead has many EmailDrafts). Writing that as raw SQL would be hundreds of lines of joins.  
**Where:** `app/db/models.py` (the tables), `app/db/database.py` (engine + session)  
**Know this:** you use **both**. The ORM for normal queries, and raw SQL via `text()` for the vector similarity search — because pgvector's `<=>` operator has no ORM equivalent. That's a good, honest answer to *"ORM or raw SQL?"*: *"ORM by default, raw SQL where the ORM can't express it."*

### PostgreSQL + psycopg2 + Supabase
**What:** Postgres is the database; psycopg2 is the Python driver; Supabase is the hosted Postgres.  
**Why here:** Relational data with real foreign keys, plus the **pgvector** extension for embeddings — which SQLite can't do.  
**Know this:** you run **SQLite locally, Postgres in production**, both through SQLAlchemy. That's why semantic search degrades to keyword search on your laptop.

### FastAPI BackgroundTasks
**What:** Run a function after returning the HTTP response.  
**Why here:** This is the single most important backend design decision in your project. Researching 100 leads = 100 Gemini calls = 5–25 minutes. No HTTP request survives that.  
**Where:** `app/api/routes/campaigns.py`, `leads.py`, `lead_scoring.py`  
**The pattern:** endpoint returns a `job_id` instantly → work runs in the background → progress written to a jobs table → frontend polls.  
**Honest limitation to own:** these run in-process. If the server restarts mid-job, the job is lost. Production would use Celery or RQ with Redis.

### requests + httpx + BeautifulSoup4
**What:** HTTP clients and an HTML parser.  
**Why here:** Fetching lead websites and extracting text and emails from them.  
**Where:** `app/services/scraper_service.py`, `lead_discovery_service.py`  
**Point worth making:** you check `robots.txt` before fetching, block private/local IPs (SSRF protection), cap responses at 1 MB, and time out at 8 seconds. That's responsible scraping and judges notice it.

### dnspython + smtplib
**What:** DNS lookups and SMTP protocol.  
**Why here:** This is your Hunter.io replacement. When a website shows no email, you generate likely patterns (`info@`, `firstname.lastname@`), look up the domain's **MX records** to confirm it accepts mail, then open an SMTP connection and probe whether the mailbox exists — without ever sending anything.  
**Where:** `app/services/email_guesser_service.py`  
**This is your best "we built it ourselves" story.** Know it well.  
**Own the caveat:** SMTP port 25 is blocked outbound by Render and most cloud hosts, so in production you fall back to MX-only confidence. It works locally.

### pypdf + python-docx
**What:** Text extraction from PDF and Word files.  
**Why here:** The Knowledge page — upload a brochure, get chunks that feed RAG.  
**Where:** `app/services/document_service.py`

### google-genai
**What:** The official Gemini SDK. Handles both text generation and embeddings.  
**Where:** used across 10 services.

### google-auth-oauthlib + google-api-python-client
**What:** OAuth2 flow and the Gmail API client.  
**Why here:** Sending approved emails from the user's real Gmail.  
**Where:** `app/services/gmail_service.py`, `app/api/routes/gmail.py`  
**Know the OAuth flow** — this is a classic interview question and you implemented it:  
1. User clicks Connect → backend generates a `state` token, redirects to Google
2. User consents on Google's page
3. Google redirects back to your `/gmail/oauth/callback` with a `code`
4. Backend exchanges that `code` for an access token + refresh token
5. Tokens stored in the `gmail_tokens` table — **never** in the frontend
6. Access token expires; the refresh token silently gets a new one

**Why it matters:** your app never sees the user's password, and the user can revoke access from their Google account at any time.

### python-dotenv, python-multipart, cryptography
Loading `.env` config; parsing file uploads; TLS/crypto primitives used by the Google libraries.

## The concepts behind them

| Concept | In your project |
|---|---|
| **REST + HTTP verbs** | GET reads, POST creates, PATCH updates, DELETE removes. 118 endpoints follow this. |
| **Status codes** | 200 OK, 400 bad request, 404 not found, 422 validation failed (Pydantic), 500 server error. |
| **Request/response cycle** | CORS → route → validate → DB session → service → commit → JSON out. Memorise this chain. |
| **Dependency injection** | `Depends(get_db)` — FastAPI creates a DB session, hands it to your function, closes it after. You never manage the lifecycle. |
| **Connection pooling** | Opening a DB connection is expensive. SQLAlchemy keeps a pool (`DB_POOL_SIZE=5`) and reuses them. |
| **ORM vs raw SQL** | See SQLAlchemy above — you use both, deliberately. |
| **Sync vs async** | Async lets one process wait on many slow network calls at once. Critical when every Gemini call is 3–15 seconds. |
| **Separation of concerns** | Routes are thin (HTTP only). Services hold logic. Models hold schema. This is why 20k lines stays navigable. |
| **Environment-based config** | `app/core/config.py`. No secret is ever in code. |
| **Idempotency & dedup** | Discovery dedupes contacts within a job; import merges into an existing lead rather than creating a duplicate. |

**Two honest gaps — know them before you're asked:**

- **No migration tool.** You use `ensure_*_columns()` functions in `database_utils.py` that add missing columns on startup. It works, but the production answer is Alembic. Say that plainly.
- **No automated tests.** Own it: *"We prioritised feature completeness for the hackathon. The service layer is already isolated enough to unit-test — that's the next thing."*

---

# PART 3 · LLM & AI — Raj

**Stack:** Gemini 2.5 Flash (generation) · gemini-embedding-001 (embeddings) · pgvector (similarity search)

## The core concepts

### What an LLM actually is (functionally)
A model that predicts the next token given all previous tokens. Everything else — reasoning, writing, classification — is that one operation applied at scale. You don't need the maths; you need to know it's **probabilistic**, which is exactly why your system has fallbacks and human approval.

### Tokens and context windows
Text is split into tokens (roughly ¾ of a word). Every model has a maximum context — prompt plus response. **This is why RAG exists.** You can't paste your entire knowledge base into every prompt; you retrieve only the relevant 5 chunks.
**Also why cost matters:** you're billed per token, and you make ~4 calls per lead.

### Prompt engineering
- **System vs user context** — role and rules vs the specific task
- **Structured output** — you ask for strict JSON, not prose
- **Grounding** — you supply facts in the prompt rather than trusting the model's memory
- **Constraints** — e.g. your explicit rule not to state pricing unless it came from retrieved knowledge

### Why structured JSON output — and the tolerant parser
Every one of your eight AI jobs returns JSON, because the result goes into database columns, not onto a screen.
**The real-world problem:** models wrap JSON in explanation — *"Sure! Here's the JSON: ```json {...}```"*. So you have `extract_json_from_text()` which finds and extracts the object regardless of wrapping.  
**Judge asks:** *"How do you get reliable JSON from an LLM?"* → *"Strict schema in the prompt, tolerant extraction on the way back, field-level cleaning, and an error column so a parse failure is recorded instead of writing garbage."*

### Temperature
Controls randomness. Low = deterministic and repeatable; high = creative and varied. Worth knowing which way you'd move it: **down** for scoring and classification (you want consistency), **up** slightly for email drafting (you don't want 40 identical emails).

## Embeddings — the part that needs real understanding

### What an embedding is
A piece of text converted into a list of numbers — a **vector** — where similar meanings produce nearby vectors. Yours are **3072 numbers long** (`gemini-embedding-001`).

The point: *"our pricing is ₹18,000 per seat"* and *"how much does it cost?"* share almost no words but sit close together in vector space. Keyword search misses that connection; embeddings catch it.

### Cosine similarity
How you measure "nearby". It compares the **angle** between two vectors, ignoring magnitude. Result ranges from -1 to 1; 1 means identical direction.

**In your actual code** (`knowledge_service.py`):
```sql
SELECT id, 1 - (embedding <=> CAST(:query_embedding AS vector)) AS similarity_score
```
`<=>` is pgvector's cosine **distance** operator. Distance and similarity are inverses, so `1 - distance` gives you similarity. That one line is worth being able to explain — it's the mathematical heart of your RAG.

### pgvector
A PostgreSQL extension adding a native `vector` type and distance operators. Your column is literally `vector(3072)`.
**Judge asks:** *"Why not Pinecone or Chroma?"*  
→ *"We already run Postgres. pgvector means embeddings live beside the rows they belong to — one database, one backup, one connection, transactional consistency. A dedicated vector DB only pays off at a scale we're nowhere near."*  
That's a strong answer. Use it.

## RAG — Retrieval-Augmented Generation

The problem: Gemini knows the world but knows nothing about **your** pricing, courses, or case studies.
The wrong fix: fine-tuning. The right fix: retrieval.

```
1. INGEST     upload PDF / DOCX / TXT / MD
                 ↓  pypdf, python-docx
2. CHUNK      split into indexed pieces → one company_knowledge row each
                 ↓  google-genai
3. EMBED      each chunk → 3072-dim vector → pgvector column
                 ↓
4. RETRIEVE   embed the query, cosine-search, take top-K = 5
              above min score 0.50; keyword search as fallback
                 ↓
5. INJECT     matched chunks go into the drafting prompt
                 ↓
6. AUDIT      knowledge_used column records exactly what was retrieved
```

**Know why each number is what it is:**
- **top-K = 5** — enough context to be useful, few enough to leave room in the context window
- **min score 0.50** — below this, a "match" is noise. Injecting a bad chunk is *worse* than injecting nothing, because the model will try to use it.
- **3072 dimensions** — the model's native output. Not truncated, because your chunks are short and recall matters more than storage.
- **Keyword fallback** — so the feature still works when embeddings are unavailable (e.g. on SQLite locally).

### RAG vs fine-tuning — have this answer ready
| | RAG | Fine-tuning |
|---|---|---|
| Update knowledge | Upload a file, instant | Retrain, hours to days |
| Cost | Cheap (embedding calls) | Expensive |
| Cite a source | Yes — you log which chunks | No |
| Needs training data | No | Hundreds to thousands of examples |
| Good for | **Facts that change** | Style and format |

*"Our pricing changes. A fine-tuned model is stale the day training finishes, costs far more, and can't tell you where an answer came from."*

### Hallucination and grounding
LLMs generate plausible text, which means they can generate plausible *wrong* text. Your four defences:
1. **Research is grounded** — built from page text you actually fetched, not the model's memory
2. **Knowledge is yours** — retrieved chunks are your verified documents
3. **Prompt constraints** — no pricing unless it came from knowledge
4. **Human approval** — nothing sends unreviewed

### The eight AI jobs — know that it's eight, not one
Strategy generation · search-query generation · contact structuring · lead research · lead scoring · email drafting · reply classification · response & follow-up drafting.

Each has its own prompt, its own context, its own output schema. *"It's not one prompt"* is the line that separates you from a ChatGPT wrapper.

### Cost and latency thinking
~4 model calls per lead. At 100 leads that's 400 calls. This is **why** background jobs exist, **why** you chose Flash over a larger model, and **why** you cap batches at 5–10 per click. Being able to connect the AI choice to the architecture choice is what makes it read as engineering.

## What you are NOT doing — say it clearly

No model training. No fine-tuning. No PyTorch, TensorFlow or scikit-learn. No gradient descent, no loss functions, no train/test splits.

**And one distinction to be precise about:** your "AI lead scoring" is **LLM judgement**, not a trained classifier. The model reads the lead and reasons about fit. A judge who knows ML may probe this — the honest answer is:

> *"It's LLM-based reasoning, not a trained model. We have no labelled outcome data yet — nobody's told us which leads actually converted. Once we have that, a gradient-boosted classifier on the structured features would likely beat the LLM on ranking, and the LLM would keep doing what it's good at: writing the explanation."*

That answer shows you understand the boundary. It's better than pretending.

**The honest gap in your AI layer:** no formal evaluation set. Your quality signals are reply rate and human approve/reject ratio. Own it, and say a graded eval set is the next thing.

---

# PART 4 · SHARED / DEPLOYMENT — everyone

| Area | What to know |
|---|---|
| **Git** | branch, commit, merge, push. You have a `main` and a `ui-glass-redesign` branch — know why feature branches exist. |
| **Vercel** | Hosts the frontend. Auto-deploys on push to main. Build-time env vars. |
| **Render** | Hosts the backend. Free tier **sleeps after ~15 min idle** and cold-starts in ~50s. Know this before someone asks why it was slow. |
| **Supabase** | Hosted Postgres with the pgvector extension enabled. |
| **Environment variables** | The boundary between code and secrets. Nothing sensitive is ever committed — `.env` is gitignored. |
| **CORS** | Why a Vercel frontend can call a Render backend at all — the backend explicitly allows those origins. |
| **Webhooks** | n8n calls back into your API. A webhook is just "you call me when you're done" instead of polling. |
| **REST between services** | Backend → n8n, n8n → backend, backend → Gemini, backend → Gmail. All HTTP + JSON. |

---

# IF YOU ONLY LEARN 10 THINGS TONIGHT

1. **The request lifecycle** — React → axios → CORS → router → Pydantic → DB session → service → SQLAlchemy → JSON back.
2. **Why background jobs exist** — Gemini takes 3–15s, 100 leads times out any HTTP request, so return a job ID and poll.
3. **What an embedding is** — text as 3072 numbers where similar meaning means nearby vectors.
4. **Cosine similarity** — measures angle, `<=>` is pgvector's distance operator, `1 - distance` = similarity.
5. **The RAG chain** — upload → chunk → embed → retrieve top-5 above 0.50 → inject → log what was used.
6. **RAG vs fine-tuning** — facts that change need retrieval, not retraining.
7. **The OAuth2 flow** — consent → code → token exchange → tokens stored server-side, never in the frontend.
8. **Your own email engine** — scrape site → pattern-guess → MX lookup → SMTP probe. Your best "we built it" story.
9. **Eight AI jobs, not one prompt** — the line that separates you from a wrapper.
10. **The three honest gaps** — no auth, no migrations, no eval set. Saying them first is stronger than being caught.

---

# QUESTIONS THAT WILL EXPOSE A GAP

These are the ones where a vague answer costs you. Each has a good honest response.

**"Walk me through what happens when you click Research Leads."**
POST to the async endpoint → row created in `lead_research_jobs` → `job_id` returned immediately → BackgroundTasks starts → for each unresearched lead, fetch a few public pages, send text plus campaign context to Gemini, parse the JSON, write to the lead row, increment the counter → frontend polls `/research-job/{id}` until status is completed.

**"What's the difference between your embedding model and your generation model?"**
Different jobs. `gemini-embedding-001` turns text into a vector for search — it doesn't write anything. `gemini-2.5-flash` generates text. One is for finding, the other for writing.

**"Why is your database Postgres and not MongoDB?"**
Highly relational data — campaigns to leads to drafts to follow-ups, with real foreign keys and cascades. Plus pgvector, which gives us vector search in the same database as the rows.

**"What happens if two people use this at once?"**
Honestly — there's no authentication yet, so there's no concept of "two people". That's the first thing to build before real users. The data model would need an owner column on campaigns and leads.

**"Is there any actual machine learning?"**
No training. We use pre-trained models through APIs — an LLM for generation and reasoning, an embedding model for semantic search. The engineering is the retrieval layer, the structured-output handling, the grounding and the pipeline. See the scoring answer above for the precise distinction.

**"How do you know the AI output is any good?"**
Two real signals: reply rate on sent emails, and the human approve/reject ratio on drafts. If drafts get rejected a lot, the prompt is wrong. What we don't have is a graded evaluation set — that's the honest gap and the next thing we'd build.
