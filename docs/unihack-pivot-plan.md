# UniHack Pivot Plan
## Lead Agent → Product Intelligence Engine

**Team FasterThanAI** · Priyanshu · Nupur · Raj
**Challenge:** AI-Powered Product Intelligence for Industrial Commerce (Unilog / UniHack)
**Window:** 3–7 days · **Strategy:** keep the machine, replace the domain

---

## The one-line thesis

> Your lead agent and this challenge are the **same abstract problem**: take sparse structured records, fetch unstructured web and document data about each one, use an LLM to produce structured fields carrying confidence and provenance, let a human approve, and do it in bulk.

You are not starting over. You are swapping the noun from **Lead** to **Product** and adding four things you don't have yet: unit normalisation, rule validation, multi-source conflict detection, and vision.

---

## Read the rubric first

Slide 4 of the UniHack template is the scoring criteria wearing a disguise. Everything in this plan traces back to one of these three questions. If a task doesn't, cut it.

| | Rubric question | What wins it |
|---|---|---|
| **Q1** | How do you enrich minimal product information? | Part Number + Brand + Short Description in → 20+ structured attributes out |
| **Q2** | How do you ensure accuracy and trust? | Per-attribute confidence, source URL, rule validation, cross-source conflict flags, human review |
| **Q3** | What makes it scalable for enterprise catalogs? | Background jobs, batch ingest, new manufacturers with no code change, HTML + PDF + image handling |

The brief names six approaches — *AI agents, RAG, knowledge graphs, document intelligence, vision-language models, human-in-the-loop*. **You already ship working RAG, document intelligence and human-in-the-loop.** Add vision, call the orchestration layer agents, and skip knowledge graphs entirely. They're a trap.

---

# PART A · THE TRIAGE

## A1. Delete these — 9 services, 10 routes, 7 tables

Deleting is not loss, it's the fastest way to make this obviously a different product. Do it on day one so nobody wastes time maintaining dead code.

**Services to delete**
```
apollo_service.py            email_guesser_service.py     followup_service.py
gmail_service.py             hunter_service.py            reply_classification_service.py
reply_response_service.py    vapi_service.py              opportunity_service.py *
```
\* keep the *shape* of `opportunity_service` if you want AI-generated attribute schemas — see B4.

**Routes to delete**
```
calls.py     emails.py    followups.py    gmail.py      hunter.py
apollo.py    replies.py   reply_classification.py       reply_responses.py    lead_agent.py
```

**Tables to drop**
```
EmailDraft   FollowUpDraft   ReplyResponseDraft   CallLog
CallScript   GmailToken      GmailOAuthState
```

**Frontend pages to delete:** `Calls.jsx`, `Emails.jsx`
**Dependencies to drop:** `google-api-python-client`, `google-auth-oauthlib`, `google-auth-httplib2`, `dnspython`, and the unused `tenacity`

That removes roughly 40% of the codebase and every trace of outbound sales.

## A2. Reuse completely untouched — this is your unfair advantage

Do not rewrite these. Change nothing but the prompt strings where noted.

| File | Why it survives the pivot |
|---|---|
| `services/scraper_service.py` | Fetches public pages with robots.txt checks, SSRF guards, 1 MB cap, 8 s timeout. Now it fetches manufacturer product pages. **Zero changes.** |
| `services/document_service.py` | PDF/DOCX/TXT → text → indexed chunks. Now it eats spec sheets and catalogs. **Zero changes.** |
| `services/embedding_service.py` | Gemini embeddings, 3072-dim, error handling. **Zero changes.** |
| `services/knowledge_service.py` | Hybrid semantic + keyword retrieval over pgvector. Now retrieves taxonomy rules and reference specs. **Zero changes.** |
| `services/ai_service.py` | The Gemini client, `clean_value`, `extract_json_from_text`. **Keep the helpers, replace the email prompts.** |
| `db/database.py`, `db/database_utils.py` | Engine, pooling, the `ensure_*_columns` pattern. **Zero changes.** |
| `utils/time_utils.py` | **Zero changes.** |
| The three job-table patterns | `*_job` tables + `processed/total/failed` + polling endpoint. This *is* your Q3 scalability answer. **Copy the pattern, rename.** |
| All 9 UI primitives + Midnight Aurora tokens | `Button`, `Card`, `Badge`, `Table`, `PageHeader`, `EmptyState`, `Skeleton`, `Toast`, `StatCard`, plus `index.css`. **Zero changes.** |
| `App.jsx`, `Sidebar.jsx`, `Navbar.jsx`, theme system | Change the nav labels. Nothing else. |

## A3. Rename and re-prompt — same code, new domain

| Old | New | What actually changes |
|---|---|---|
| `lead_research_service.py` | `enrichment_service.py` | Same fetch→Gemini→structured-output flow. **New prompt, new output schema.** |
| `lead_scoring_service.py` | `quality_service.py` | Same scoring flow. Now scores data completeness and confidence instead of sales fit. **New prompt.** |
| `lead_discovery_service.py` | `sourcing_service.py` | Keep the scraping, AI structuring, confidence scoring, dedupe and merge logic. **This file is your crown jewel — it already does cross-source dedupe, which becomes conflict detection.** |
| `routes/leads.py` | `routes/products.py` | Same CRUD, CSV upload, CSV export, async job trigger. |
| `routes/campaigns.py` | `routes/catalogs.py` | Same. |
| `routes/lead_scoring.py` | `routes/quality.py` | Same. |
| `routes/discovery.py` | `routes/sourcing.py` | Same. |
| `pages/Leads.jsx` | `pages/Products.jsx` | Same table, filters, async job cards. New columns. |
| `pages/Campaigns.jsx` | `pages/Catalogs.jsx` | Same. |
| `pages/LeadDiscovery.jsx` | `pages/Sources.jsx` | Same. Paste manufacturer URLs, upload PDFs. |

---

# PART B · THE NEW DATA MODEL

This is the single most important design decision in the pivot. Get it right and the rubric answers itself.

## B1. Store attributes as rows, not as a JSON blob

The instinct is to put enriched data in a JSON column on `Product`. **Don't.** The rubric asks for per-attribute confidence, per-attribute provenance and per-attribute review. A blob throws all of that away.

```
Catalog                    (was Campaign)
  id, name, vertical, description, created_at

AttributeSchema            (NEW — or repurpose Opportunity)
  id, catalog_id, category_name          e.g. "Ball Valve"
  attributes  JSON  [{ key, label, data_type, unit_family,
                       allowed_values, required, min, max }]

Product                    (was Lead)
  id, catalog_id
  part_number, manufacturer, short_description      ← THE MINIMAL INPUT (Q1)
  category, canonical_name, long_description
  status          pending | sourcing | enriching | needs_review | approved | failed
  completeness_score      0-100   how many required attributes are filled
  confidence_score        0-100   mean confidence across attributes
  quality_grade           A | B | C | D
  enriched_at, model_used, error

ProductAttribute           (NEW — the heart of the whole thing)
  id, product_id
  key                     "pressure_rating"
  value_raw               "150 PSI"      exactly as found
  value_norm              "150"          after normalisation
  unit                    "psi"
  confidence              0-100
  status                  proposed | approved | rejected | conflicted
  source_id               → SourceDocument              ← PROVENANCE (Q2)
  extraction_method       html | pdf | vision | inferred
  validation_flags        JSON  rule failures, enum mismatch, out of range
  model_used, reviewed_by, reviewed_at

SourceDocument             (was DiscoveredLead)
  id, product_id, url, filename, doc_type   html | pdf | image
  fetched_at, content_hash, text_snippet, page_number

AttributeConflict          (NEW — the multi-source verification story)
  id, product_id, key
  candidates  JSON  [{ value, source_id, confidence }]
  resolution        unresolved | auto | human
  resolved_value, resolved_by, resolved_at

EnrichmentJob / ValidationJob    (copy LeadResearchJob / LeadScoringJob verbatim)
  id, catalog_id, status, total, processed, succeeded, failed,
  started_at, finished_at, error
```

Three new tables. Everything else is a rename. You already have the migration pattern in `database_utils.py`.

## B2. Why this exact model wins

- **Q1** — `Product` starts with three fields and ends with 20+ `ProductAttribute` rows. That's the demo.
- **Q2** — every single attribute carries confidence, a source document, an extraction method, validation flags and a review status. When a judge asks *"how do I know this is right?"* you click one attribute and show the source PDF page it came from.
- **Q3** — `EnrichmentJob` runs the whole catalog in the background. A new manufacturer needs no code, just a new source URL.

## B3. The pipeline

```
1  INGEST      CSV: part_number, brand, short_description        ← minimal input
2  SOURCE      find + fetch manufacturer pages, PDFs, images     ← sourcing_service
3  EXTRACT     HTML  → text     → Gemini → attributes
               PDF   → pypdf    → Gemini → attributes
               image → Gemini vision      → attributes           ← NEW
4  NORMALISE   units, formats, enums — deterministic, no LLM     ← NEW
5  VALIDATE    rule checks + AI cross-check + conflict detect     ← NEW
6  SCORE       per-attribute confidence, per-product completeness ← quality_service
7  REVIEW      human approves / edits / rejects                   ← Review queue
8  EXPORT      clean structured catalog out as CSV / JSON         ← NEW
```

Steps 1, 2, 3 (text), 6 and 7 already exist in your codebase in another domain. Steps 4, 5, 8 and vision are the genuinely new work — and they are also exactly the four things that win.

## B4. Optional: AI-generated attribute schemas

Your `opportunity_service.py` takes a messy goal and produces a 20-field structured strategy. Point that same code at *"ball valves for industrial plumbing"* and it produces a candidate attribute schema. It's a two-hour change to an existing file and it's a genuinely impressive demo beat — the system proposes what attributes a category should even *have*.

---

# PART C · THE FOUR DIFFERENTIATORS

Most teams will ship a prompt that returns JSON. These four are what separate you.

## C1. Unit and format normalisation — do this first, it's the highest ROI

`1/2 in` · `0.5"` · `12.7 mm` · `½ inch` are the same value. Unilog's entire business is this problem. Almost no hackathon team will touch it because it isn't glamorous.

Build `services/normalization_service.py` — **deterministic Python, no LLM**:

- **Dimensions** — fractional inches, decimal inches, mm, cm → canonical mm and inches
- **Pressure** — psi, bar, kPa, MPa
- **Temperature** — °F, °C
- **Threads** — NPT, BSP, UNF variants
- **Materials** — `SS304` / `304 SS` / `Stainless Steel 304` → canonical enum
- **Booleans** — Yes/Y/True/✓ → true

Store both `value_raw` and `value_norm`. Show both in the UI. **Saying "we normalise units deterministically rather than trusting the LLM to do arithmetic" is a senior-engineer answer** and judges will notice.

## C2. Multi-source conflict detection

Fetch each part from 2–3 sources. When they disagree, don't silently pick one — record an `AttributeConflict` and surface it.

Your `lead_discovery_service.py` already does `_find_existing_contact`, `_apply_discovered_data_to_existing_lead` and field-level merge with quality heuristics (`_role_quality`, `_url_quality`, `_phone_quality`). **That is conflict resolution.** Port the pattern: highest-confidence source wins automatically, ties and large divergences escalate to the human queue.

This is the strongest possible answer to *"multi-source verification"* in rubric Q2.

## C3. Vision on datasheets

`google-genai` is already installed and Gemini 2.5 Flash is multimodal. You do not need a new dependency.

- Feed product photos → extract visible model numbers, form factor, connection type
- Feed **scanned PDF spec sheets** (the ones with no text layer) → render page to image → extract the spec table
- Feed catalog page images → pull the row for a given part number

Set `extraction_method = "vision"` on those attributes so provenance shows *how* each value was obtained. The brief names vision-language models explicitly; this is a cheap, visible win.

## C4. Rule-based validation alongside AI validation

The brief lists both. Run both, show both.

From the `AttributeSchema`: required fields present, `data_type` matches, value inside `min`/`max`, value inside `allowed_values`, unit belongs to the right `unit_family`. Failures land in `validation_flags` and drop `confidence`.

Then a separate cheap Gemini pass: *"here are the extracted attributes for this part, flag anything implausible for this product category."* Two independent checks — deterministic and probabilistic. Say exactly that on the deck.

---

# PART D · SEVEN-DAY SCHEDULE

Three people, parallelised. Adjust down if you have less time; the day-by-day order is the priority order.

### Day 1 — Foundation
- **All:** new public repo `product-intelligence-engine`. Fresh git history, README naming this as built on your own prior framework.
- **Priyanshu:** copy backend skeleton, delete the 9 services / 10 routes / 7 tables from A1, write the new models from B1, add `ensure_*_columns` migrations
- **Nupur:** pull 25–30 **real** part numbers from Grainger or McMaster-Carr across 3 categories. Ball valves, pressure gauges, pipe fittings. Record part number + brand + one-line description only — that's the minimal input.
- **Raj:** write the `AttributeSchema` JSON for those 3 categories, by hand, from real product pages

> **Gate:** by end of day 1 the app boots, tables exist, dead code is gone.

### Day 2 — Ingest → Source → Extract (text)
- **Priyanshu:** CSV ingest endpoint, `products` routes, `EnrichmentJob` background job copied from `LeadResearchJob`
- **Raj:** `enrichment_service.py` — port `lead_research_service`, new prompt returning attributes keyed to the schema, writing `ProductAttribute` rows with confidence and `source_id`
- **Nupur:** rename frontend pages, strip Calls and Emails, wire the Products table

> **Gate:** upload a CSV of 25 parts, run the job, see attributes appear with sources.

### Day 3 — Normalise + Validate
- **Raj:** `normalization_service.py` (C1) — units, materials, threads, booleans
- **Priyanshu:** `validation_service.py` (C4) — rule checks from schema, `validation_flags`, confidence penalties, then `quality_service.py` for completeness and grade
- **Nupur:** attribute detail view — raw value, normalised value, unit, confidence, source link, flags

> **Gate:** `1/2"` and `12.7mm` resolve to the same normalised value on screen.

### Day 4 — Vision + Conflicts
- **Raj:** Gemini vision path (C3) — image and scanned-PDF extraction, `extraction_method = vision`
- **Priyanshu:** `AttributeConflict` detection (C2), porting the merge heuristics from `lead_discovery_service`
- **Nupur:** conflict UI — show competing values side by side with their sources, one click to resolve

> **Gate:** a scanned datasheet produces attributes; a deliberate disagreement raises a conflict.

### Day 5 — Review queue + Export
- **Nupur + Priyanshu:** the **Review** page. This replaces `Emails.jsx` as your approval surface — bulk approve, edit inline, reject, filter by confidence and by flag. Reuse the draft approve/reject state machine wholesale.
- **Priyanshu:** export endpoint — enriched catalog out as CSV and JSON, with a provenance column
- **Raj:** RAG wiring — taxonomy and reference docs into the Knowledge page, retrieved during enrichment

> **Gate:** end-to-end. CSV in → enriched → reviewed → exported.

### Day 6 — Deck, demo data, polish
- **Nupur:** the 15-slide template. Slide 4 is the rubric — answer its three questions literally and directly.
- **Priyanshu:** deploy frontend to Vercel, backend to Render. Seed a fully enriched demo catalog.
- **Raj:** architecture diagram and process flow (template slides 7 and 9)

### Day 7 — Video + submit
- 3-minute demo video (the template caps it at 3 minutes — shorter than your last one, so cut hard)
- Buffer for everything that breaks

---

# PART E · THE DEMO THAT WINS

Three minutes. This is the exact sequence.

| Time | Beat | What it proves |
|---|---|---|
| 0:00–0:20 | The problem, in one screen: a real catalog row with 3 fields and 17 blanks | You understand Unilog's trust gap |
| 0:20–0:50 | Upload the CSV — 25 parts, part number + brand + one line each. Click **Enrich**. | **Q1 — minimal input** |
| 0:50–1:20 | Job runs in the background, progress bar climbing. Products fill in live. | **Q3 — scale** |
| 1:20–2:00 | Open one product. 20+ attributes, each with confidence, unit, and a **source link**. Click through to the actual PDF page it came from. | **Q2 — trust and traceability** |
| 2:00–2:25 | Show a conflict: two sources disagree on pressure rating. Show the raw vs normalised values for a dimension. | **Q2 — multi-source + normalisation** |
| 2:25–2:45 | Review queue: bulk approve the high-confidence ones, hand-edit one low-confidence one. | **Q2 — human-in-the-loop** |
| 2:45–3:00 | Export the clean catalog. Show the before/after row. | The payoff |

**The single most memorable moment** is clicking an attribute and landing on the exact page of the exact PDF it was extracted from. Nobody else will have that. Build the demo around it.

---

# PART F · RISKS AND HONEST CALLS

**Eligibility — resolve this on day 1.** Check whether UniHack requires code written during the event. Use a fresh repo either way, and say plainly in the README and the deck that it builds on a framework your team wrote previously. Being upfront costs nothing; being caught costs everything.

**Domain naivety is your biggest technical risk.** None of you work in industrial distribution. Before designing the schema, spend an hour on real product pages. Look at how a distributor actually presents a ball valve — the attribute names, the units, the abbreviations. Building something that looks right to you and wrong to a Unilog judge is the most likely failure mode.

**Scope discipline.** Cut in this order if you run short: knowledge graphs (never build), AI-generated schemas (B4), vision (C3), conflict detection (C2). **Never cut normalisation or provenance** — they are the two things that make the trust story real.

**Latency.** 25 products × 3 sources × 2 Gemini calls ≈ 150 calls. Your background job system already handles this, but seed the demo catalog beforehand — don't enrich live on camera beyond the one small batch.

**Render cold start.** Same warning as last time. Warm it 20 minutes before recording.

---

## Why this is worth doing

Most teams will spend three days getting a single prompt to return JSON reliably and ship a Streamlit page. You will start day one with background jobs, pgvector RAG, an approval state machine, provenance columns, responsible scraping, document parsing, and a deployed polished UI — all of it already working.

The pivot isn't a compromise. It's the reason you can spend your whole week on the four things that actually score.
