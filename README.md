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
- Simple database-backed RAG for company-specific AI context
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
3. Upload leads CSV
4. Score leads with AI
5. Review top priority leads
6. Generate first email
7. Approve and send first email
8. Recipient replies
9. Check replies
10. Classify reply with AI
11. Generate response draft using relevant company knowledge
12. Review intent, priority, next action, suggested response direction, knowledge used, and draft response
13. Approve response
14. Send approved response
15. If no reply, generate follow-up draft
16. Approve follow-up
17. Send follow-up
18. Track follow-up status

## 10. Safety Notes

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

## 11. Future Improvements

- Google Search lead discovery
- Authentication
- CRM integration
- Vector database or semantic RAG for larger knowledge bases
