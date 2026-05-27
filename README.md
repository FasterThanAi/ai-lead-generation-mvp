# AI Lead Generation MVP

## 1. Project Overview

This is an AI-powered lead generation and cold email outreach MVP. It supports campaign creation, lead upload, public email extraction, AI lead scoring, AI-generated email drafts, Gmail OAuth connection, sending approved drafts, manual reply checks, AI reply classification, AI response drafts, company knowledge retrieval, campaign analytics, and safe follow-up drafts.

## 2. Features

- Campaign management
- Lead CSV upload
- Public email extraction from websites
- AI lead scoring and qualification
- Lead priority, outreach angle, pain point, and CTA recommendations
- AI email generation using Gemini
- Company knowledge base for product, pricing, FAQ, demo, and objection handling notes
- Document upload for the Knowledge Base with PDF, DOCX, TXT, and Markdown extraction
- Hybrid semantic and keyword RAG for company-specific AI context
- Draft approve/reject workflow
- Gmail OAuth connection
- Send approved emails
- Manual Gmail reply checks
- AI reply classification with intent, sentiment, priority, and next action suggestions
- AI response draft generation for classified replies
- Knowledge used in AI response drafts
- Response draft approve/reject/send workflow
- Follow-up draft generation and sending
- Campaign analytics and reply rate
- Dashboard stats

## 3. Tech Stack

Frontend:
- React
- Vite
- Tailwind CSS
- Axios
- Vercel

Backend:
- FastAPI
- SQLAlchemy
- Supabase PostgreSQL
- Render

AI and email:
- Gemini API
- Gmail API OAuth

## 4. Architecture

The frontend is a Vite React app deployed on Vercel. It calls the FastAPI backend through `VITE_API_BASE_URL`.

The backend is deployed on Render and stores application data in Supabase PostgreSQL through SQLAlchemy models. Gmail and Gemini credentials stay on the backend and are loaded from environment variables.

Main data flow:
1. Campaigns are created in the app.
2. Leads are uploaded from CSV and linked to campaigns.
3. Website extraction searches public pages for lead emails.
4. Gemini scores leads and explains priority, fit, outreach angle, pain point, and CTA.
5. Gemini generates cold email drafts with relevant company knowledge when available.
6. Users approve or reject drafts.
7. Gmail OAuth enables sending approved drafts only.
8. Users manually check sent emails for replies and review campaign analytics.
9. Gemini classifies replies by intent, sentiment, priority, summary, and suggested next action.
10. Gemini drafts a safe response for classified replies using relevant company knowledge when available.
11. Users approve, reject, or send approved response drafts manually.
12. If there is no reply, users generate, approve, and send follow-up drafts manually.
13. The Knowledge page stores company-specific facts for the first simple RAG layer. This does not train an LLM.
14. Users can upload PDF, DOCX, TXT, or Markdown knowledge documents. The backend extracts text, splits it into chunks, and stores each chunk as searchable company knowledge.
15. When semantic RAG is enabled, knowledge entries are embedded on the backend and searched through Supabase/PostgreSQL `pgvector`, with keyword fallback if semantic search is unavailable.

## 5. Week-wise Progress

Week 1:
- Campaign creation
- Campaign list
- Backend/frontend connection

Week 2:
- Lead CSV upload
- Lead table
- Campaign-wise lead connection
- Invalid CSV validation

Week 3:
- Website/public email extraction
- Single lead email extraction
- Campaign-wise extraction
- Lead statuses: `new`, `email_found`, `email_not_found`, `website_missing`, `extraction_failed`

Week 4:
- Gemini AI email draft generation
- Generate draft for one lead
- Generate drafts for campaign in safe batches
- Email draft model/table
- Approve/reject email drafts

Week 5:
- Gmail OAuth connection
- Gmail token storage
- Send approved drafts only
- Single draft sending
- Campaign approved sending with limits
- Sent status, `sent_at`, and `gmail_message_id`

Week 6:
- Real dashboard stats
- Cleaner Gmail Settings UI
- Status-based email draft actions
- Campaign summary cards
- Better empty states and error messages
- Demo documentation and sample CSVs

Week 7:
- Gmail readonly scope for manual reply checks
- Sent draft reply tracking
- Campaign reply analytics
- Dashboard reply stats

Week 8:
- Follow-up draft generation
- Follow-up approval/rejection
- Follow-up sending through Gmail
- Follow-up safety rules and limits
- Follow-up analytics

Week 9:
- AI lead scoring
- Lead priority and qualification labels
- Explainable score reason
- Suggested outreach angle
- Likely pain point
- Recommended CTA
- Dashboard and campaign analytics for scored leads

Week 10:
- AI reply classification
- Reply intent detection
- Reply sentiment and priority
- Reply summary and next action suggestion
- Suggested response direction without automatic sending
- Manual control and safety-first workflow

Week 11:
- AI response draft generation from classified replies
- Approve/reject response drafts
- Send approved responses through Gmail
- Reply classification to response flow
- Manual safety control before every response is sent

Week 12:
- Company knowledge base
- Simple database-backed RAG
- Knowledge retrieval for AI response drafts
- Relevant company context for cold emails and follow-ups
- Knowledge used visibility on response drafts
- First step toward company-specific AI without training an LLM

Week 12.1:
- Document upload for the Knowledge Base
- Supported document types: PDF, DOCX, TXT, and Markdown
- Uploaded documents are converted into text chunks and stored in `company_knowledge`
- Document chunks remain searchable through the existing keyword RAG flow
- AI cold emails, follow-ups, and response drafts can use uploaded document knowledge when relevant
- Knowledge and response draft UI now show whether knowledge came from a manual entry or an uploaded document

Week 12.2:
- Stronger RAG grounding for response drafts
- Structured retrieved knowledge context for AI replies
- Pricing and demo replies prefer exact retrieved company facts
- Response drafts avoid invented prices and keep manual approval flow

Week 13:
- Semantic RAG with embeddings
- Supabase/PostgreSQL `pgvector` support when available
- Hybrid search that combines semantic retrieval and keyword fallback
- Query expansion for common sales terms such as cost, walkthrough, start small, and track progress
- Search modes: Hybrid, Semantic, and Keyword
- Embedding backfill from the Knowledge page
- Semantic status visibility for active, embedded, missing, and errored knowledge entries

## 6. Local Setup

Backend:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

Default local URLs:
- Backend: `http://127.0.0.1:8000`
- Frontend: `http://localhost:5173`

## 7. Environment Variables

Do not commit real secrets. Use Render, Vercel, or local `.env` files for real values.

Backend:
```env
APP_NAME=
APP_ENV=
FRONTEND_URL=
DATABASE_URL=
BACKEND_HOST=
BACKEND_PORT=
GEMINI_API_KEY=
GEMINI_MODEL=
EMBEDDING_MODEL=
EMBEDDING_DIMENSION=
ENABLE_SEMANTIC_RAG=
SEMANTIC_RAG_TOP_K=
SEMANTIC_RAG_MIN_SCORE=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REDIRECT_URI=
GMAIL_SENDER_EMAIL=
GMAIL_DAILY_LIMIT=
```

Frontend:
```env
VITE_API_BASE_URL=
```

## 8. Deployment

Frontend:
- Deploy the `frontend` app to Vercel.
- Set `VITE_API_BASE_URL` to the Render backend API URL, including `/api` if the app expects that base path.

Backend:
- Deploy the `backend` app to Render.
- Set all backend environment variables in Render.
- Point `DATABASE_URL` to Supabase PostgreSQL.
- Configure Gmail OAuth redirect URI to match the deployed backend callback.

## 9. Demo Flow

1. Create campaign
2. Add company knowledge such as product details, pricing notes, FAQs, and demo scripts
3. Upload sample knowledge documents from `sample-data/knowledge-documents/`
4. Generate missing embeddings from the Knowledge page when semantic RAG is enabled
5. Upload leads CSV
6. Score leads with AI
7. Review top priority leads
8. Generate first email
9. Approve and send first email
10. Recipient replies
11. Check replies
12. Classify reply with AI
13. Generate response draft using relevant company knowledge
14. Review intent, priority, next action, suggested response direction, knowledge used, and draft response
15. Approve response
16. Send approved response
17. If no reply, generate follow-up draft
18. Approve follow-up
19. Send follow-up
20. Track follow-up status

## 10. Knowledge Document Upload

The Knowledge page supports uploading PDF, DOCX, TXT, and Markdown files up to 5 MB. The backend extracts readable text with `pypdf` for PDF files and `python-docx` for DOCX files. Plain text and Markdown files are read directly with UTF-8 fallback handling.

Uploaded text is sanitized, split into manageable chunks of roughly 2,000 to 2,500 characters with small overlap, and stored as active `company_knowledge` rows with `source_type="document"`. Each chunk keeps its `document_id` and `chunk_index`, while manual knowledge entries continue to use `source_type="manual"`.

AI email generation, follow-up generation, and response draft generation all use the same RAG search path. When uploaded document chunks match the outreach or reply context, they are included in the AI prompt with source information such as document filename and chunk number.

## 11. Semantic RAG

Week 13 adds embeddings for company knowledge. The backend uses Gemini embeddings through `EMBEDDING_MODEL` and stores vectors in Supabase/PostgreSQL with `pgvector` when the extension and permissions are available.

Startup migration tries to run `CREATE EXTENSION IF NOT EXISTS vector`, add an embedding column using the configured embedding dimension, and create an ivfflat cosine index. If any pgvector setup step fails, the app logs a warning and continues with keyword search.

Knowledge entries are embedded when manual entries are created or edited, and document chunks are embedded after upload. If embedding generation fails, the knowledge entry remains usable and stores an `embedding_error`; document upload and AI generation continue.

The Knowledge page includes a Semantic RAG status card and a `Generate Missing Embeddings` button. Search supports Hybrid, Semantic, and Keyword modes. Hybrid search tries semantic retrieval first, expands common sales/product phrases into related terms, merges keyword matches, deduplicates results, and falls back to keyword search when semantic retrieval is unavailable.

Suggested sample knowledge entry:
- Title: Training Analytics and Progress Tracking
- Category: Product Details
- Tags: analytics, progress, completion, quiz scores, HR dashboard
- Content: Managers can track lesson completion, quiz scores, engagement, and employee training status.

Current limitation: semantic quality depends on the embedding model, chunk quality, and how specific the company knowledge is. Keyword fallback remains available for all environments.

## 12. Safety Notes

- Emails are not sent automatically.
- AI scoring is a recommendation and should be reviewed before outreach.
- Only approved drafts can be sent.
- Follow-ups are never sent automatically.
- Only approved follow-ups can be sent.
- Follow-ups are limited to 2 per original email.
- Gmail sending is limited.
- Reply checks use Gmail readonly access and do not send emails.
- AI reply classification only suggests next actions. It does not send replies automatically.
- AI response drafts are not sent automatically.
- Response drafts must be approved before sending.
- AI can use saved company knowledge when relevant, but users must review before sending.
- Do not include pricing unless it has been verified.
- Credentials stay backend-only.
- Sample CSV files use placeholder data only.
- Sample knowledge documents use placeholder data only.

## 13. Future Improvements

- Google Search lead discovery
- Authentication
- CRM integration
- Better semantic reranking for larger knowledge bases
- Richer embedding health monitoring and retry controls
