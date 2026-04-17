# Cyncly Advisor

React + TypeScript scaffold for a branded chatbot web app that presents itself as **Cyncly Advisor** while routing work through three behind-the-scenes agent roles:

- `Summit Product Manager` as the primary customer-facing orchestration agent
- `Summit Knowledge Agent` as the Summit-specific specialist
- `Third-Party Research Agent` as the external research specialist

This scaffold is now organized with explicit service layers for:

- orchestration
- persistence
- finalization
- provider adapters

It also includes:

- multi-thread chat UI
- attachment UI
- staged "thinking" states
- client-side PII redaction plumbing
- Supabase schema and RLS bootstrap SQL
- Notion export wiring
- prompt files already populated with your current prompt content

## Current Status

What is already in place:

- themeable React chat interface
- fixed header and footer with scrollable conversation area
- left-hand chat history
- local thread persistence in browser storage
- staged thinking indicator:
  - considering the question
  - investigating Summit's capabilities
  - researching
  - drafting response
- frontend runtime services under `src/services/`
- backend application services and provider adapters under `server/`
- prompt files in `prompts/`
- Supabase starter schema in `supabase/bootstrap.sql`
- live backend chat adapter from the frontend to `POST /api/chat/send`
- live Claude API calls through the server-side Anthropic SDK
- live RAG ingestion for `docx` and `csv`
- live retrieval over ingested Summit knowledge during chat turns
- live backend email allowlist gate with signed lightweight sessions
- live server-backed thread sync for the current lightweight access mode
- live Notion export code paths for transcript and idea pages

What is still a stub:

- live Supabase auth
- live embeddings and vector retrieval
- live attachment upload into private storage during active chat turns
- live external web retrieval for the third-party research agent

## Project Layout

- `src/`
  - frontend UI and runtime services
- `src/hooks/useChatWorkspace.ts`
  - app-level workspace state
- `src/services/orchestration/`
  - frontend turn planning and staged thinking
- `src/services/persistence/`
  - frontend local persistence
- `src/services/finalization/`
  - frontend export status handling
- `src/services/providers/`
  - frontend provider adapters
- `shared/`
  - cross-runtime orchestration contracts
- `server/application/`
  - backend use-case services
- `server/providers/model/`
  - Claude adapter boundary
- `server/providers/persistence/`
  - Supabase adapter boundary
- `server/providers/integrations/`
  - Notion adapter boundary
- `server/composition/createAppServices.ts`
  - backend service composition root
- `prompts/`
  - agent prompt files
- `supabase/bootstrap.sql`
  - starter schema + RLS

## Secret Handling

### Important rule

Never hardcode real keys in frontend code.

Safe pattern:

- browser-safe values go in `VITE_*` variables
- server-only secrets stay in plain `.env` variables without the `VITE_` prefix

This project already ignores `.env` through `.gitignore`, so the local environment file is the right place for real secrets.

### Browser-safe values

These may be exposed to the browser bundle:

- `VITE_APP_NAME`
- `VITE_API_BASE_URL`
- `VITE_USE_MOCK_BACKEND`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### Server-only secrets

These must stay server-side only:

- `ANTHROPIC_API_KEY`
- `NOTION_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`

### Current local env status

The local gitignored `.env` now contains:

- Claude server key
- Notion integration secret
- Supabase URL
- Supabase publishable key
- Supabase secret key
- both Notion database IDs
- the current allowlisted emails

That means the local runtime is configured for:

- live Claude calls
- live RAG ingestion against the private Supabase bucket
- live backend email access checks

What is still not complete is code, not configuration:

- full Supabase Auth ownership model
- vector embeddings and broader file ingestion

## Quick Start

1. Review `.env` and `.env.example`.
2. Review `.env.example` for the expected variable names.
3. Run `supabase/bootstrap.sql` in the Supabase SQL editor if you are starting from scratch.
4. Run `supabase/rag_shared_assets_migration.sql`.
5. Run `supabase/lightweight_runtime_persistence.sql` if your project was bootstrapped before the lightweight thread-sync tables were added.
6. Install dependencies:

```bash
npm install
```

7. Start the backend:

```bash
npm run server:dev
```

8. Start the frontend:

```bash
npm run dev
```

9. Ingest the private RAG bucket:

```bash
npm run rag:ingest
```

Important:

- the frontend now defaults to same-origin `/api` calls
- local Vite development proxies `/api/*` to `http://localhost:8787`
- the current email gate is validated by the backend
- you need the backend running for sign-in to work

## Environment Variables

### Frontend-facing variables

```env
VITE_APP_NAME=Cyncly Advisor
VITE_API_BASE_URL=
VITE_USE_MOCK_BACKEND=false
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Leave `VITE_API_BASE_URL` blank on Vercel when the frontend and API are deployed from the same repo. Only set it when you intentionally host the API somewhere else.

### Server-side variables

```env
ACCESS_ALLOWED_EMAILS=person1@example.com,person2@example.com
ACCESS_GATE_SECRET=your-server-only-session-secret

ANTHROPIC_API_KEY=...
CLAUDE_MODEL=claude-sonnet-4-20250514

NOTION_TOKEN=ntn_...
NOTION_CHAT_LOG_DATABASE_ID=
NOTION_IDEA_CAPTURE_DATABASE_ID=

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=rag-private
```

### Current temporary access model

Because you said you do not need full auth yet, the scaffold currently uses a lightweight server-backed email gate.

How it works:

- the frontend shows an email form before the chat UI
- the backend validates the submitted email against `ACCESS_ALLOWED_EMAILS`
- if the email is approved, the backend issues a signed lightweight session token
- the browser stores that signed session locally and sends it back for thread sync and finalization routes

Current local allowlist values have been stored in `.env`, not in frontend code.

This keeps the approved emails out of the frontend bundle while staying much simpler than full Supabase Auth.

### Prompt path variables

```env
AGENT_PRIMARY_PROMPT_PATH=prompts/summit-product-manager.md
AGENT_KNOWLEDGE_PROMPT_PATH=prompts/summit-knowledge-agent.md
AGENT_RESEARCH_PROMPT_PATH=prompts/third-party-research-agent.md
```

## Vercel Deployment

This repo is now structured for a single Vercel project:

- the frontend builds to `dist`
- Vercel serves API routes from `api/*`
- prompt files are bundled into the serverless functions through `vercel.json`
- the frontend uses same-origin `/api` calls in production

Set these environment variables in Vercel:

- `VITE_APP_NAME`
- `VITE_USE_MOCK_BACKEND=false`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `ACCESS_ALLOWED_EMAILS`
- `ACCESS_GATE_SECRET`
- `ANTHROPIC_API_KEY`
- `CLAUDE_MODEL`
- `NOTION_TOKEN`
- `NOTION_CHAT_LOG_DATABASE_ID`
- `NOTION_IDEA_CAPTURE_DATABASE_ID`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `AGENT_PRIMARY_PROMPT_PATH`
- `AGENT_KNOWLEDGE_PROMPT_PATH`
- `AGENT_RESEARCH_PROMPT_PATH`

Recommended deploy flow:

1. Push the repo to GitHub.
2. Import it into Vercel as a Vite project.
3. Add the environment variables above.
4. Redeploy after any secret change.

Notes:

- do not set `VITE_API_BASE_URL` unless your API is hosted outside the same Vercel project
- `npm run rag:ingest` is still a manual server-side task and is not run automatically on deploy
- Notion exports require both databases to be shared with the integration

## Prompt Files

These files are now populated:

- `prompts/summit-product-manager.md`
- `prompts/summit-knowledge-agent.md`
- `prompts/third-party-research-agent.md`

### Product manager prompt note

Your original product manager prompt referenced a `Log idea` tool, but that tool does not exist in the scaffold yet.

I adapted the prompt so it now emits a machine-readable `IDEA_CAPTURE_CANDIDATES` block instead. That gives us a clean contract for the backend finalization layer to parse and write into Notion later.

This is a better match for the current state of the app than telling the model to call a tool that is not yet implemented.

## Claude Setup

Claude should only be called from the server layer.

Current adapter file:

- `server/providers/model/claudeProviderAdapter.ts`

What it does now:

- loads prompt files from disk
- calls Anthropic from the server
- retries with a stable fallback model if the configured model alias is unavailable
- uses Summit RAG sources plus compressed thread context during the orchestrated turn

What still needs to be implemented:

- add stronger structured-output handling for idea capture
- add a live external retrieval path for the third-party research agent

Do not put the Claude API key in `VITE_*` env vars.

## Supabase Setup

### Why Supabase should remain the runtime system

Use Supabase for:

- user auth
- email allowlist
- threads and messages
- thread memory digests
- attachment metadata
- private document storage
- RAG chunk storage
- background export bookkeeping
- lightweight server-owned thread snapshots while the app is still on the temporary email gate

Keep Notion as a downstream mirror for:

- transcript visibility
- idea capture
- operator review

### Current relationship between the temporary gate and Supabase

Right now the email gate uses the server-side `ACCESS_ALLOWED_EMAILS` env variable.

Later, when we switch to full auth, those same emails should also be seeded into:

- `public.allowed_users`

That future state gives you:

- real persisted user profiles
- backend ownership checks
- room for role-based access

### Bootstrap steps

1. Create a Supabase project.
2. Copy the project URL into:
   - `VITE_SUPABASE_URL`
   - `SUPABASE_URL`
3. Copy the publishable key into:
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_PUBLISHABLE_KEY`
4. Copy the service role key into:
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Open the Supabase SQL editor.
6. Paste the contents of `supabase/bootstrap.sql`.
7. Run it.
8. Seed the allowlist table:

```sql
insert into public.allowed_users (email, full_name, role)
values
  ('person1@example.com', 'Person One', 'member'),
  ('person2@example.com', 'Person Two', 'member');
```

### What the bootstrap SQL creates

- `public.allowed_users`
- `public.profiles`
- `public.chat_threads`
- `public.chat_messages`
- `public.thread_memory_snapshots`
- `public.agent_runs`
- `public.conversation_exports`
- `public.file_assets`
- `public.rag_documents`
- `public.rag_chunks`
- `public.advisor_threads`
- `public.advisor_messages`
- `public.advisor_thread_exports`

It also creates starter RLS policies for user-owned chat data.

### Future change discipline

Whenever persistence changes, update:

1. `supabase/bootstrap.sql`
2. `README.md`
3. any migration notes or changed property mappings

### Required follow-up migration for shared RAG assets

Because the RAG corpus is a shared knowledge base and not owned by one signed-in user, `public.file_assets.owner_id` must be nullable.

Run this once in Supabase SQL editor:

```sql
alter table public.file_assets
alter column owner_id drop not null;
```

This migration is also stored in:

- `supabase/rag_shared_assets_migration.sql`

### Required migration for lightweight runtime persistence

If you already ran an earlier version of the bootstrap script, run this too:

- `supabase/lightweight_runtime_persistence.sql`

That script adds the server-owned tables used by the current lightweight email-gated runtime:

- `public.advisor_threads`
- `public.advisor_messages`
- `public.advisor_thread_exports`

## Notion Setup

### Your Notion secret is probably not the problem

The `ntn_...` value is the internal integration secret, and that is the correct kind of secret to use.

What is missing is usually one or more of these:

- the two Notion databases do not exist yet
- the integration has not been shared with those databases
- the environment does not contain the two database IDs
- the code is trying to rely on database names instead of database IDs

### You need two Notion databases

Create these two Notion databases:

1. `Advisor Conversation Tracker`
2. `Cyncly Advisor Ideas`

The exact database titles can vary. The API uses database IDs, not the visible names.

### Conversation Log database properties

Create these properties:

- `Title` as `title`
- `Thread ID` as `rich text`
- `User Email` as `email`
- `User Name` as `rich text`
- `Opened At` as `date`
- `Closed At` as `date`
- `Status` as `select`
- `Summary` as `rich text`
- `Idea Count` as `number`

Store the full transcript in the page body, not in a single large property.

### Idea Capture database properties

Create these properties:

- `Title` as `title`
- `Thread ID` as `rich text`
- `Conversation Date` as `date`
- `Customer Name` as `rich text`
- `Problem` as `rich text`
- `Idea` as `rich text`
- `Evidence` as `rich text`
- `Recommended Next Step` as `rich text`
- `Confidence` as `select`
- `Source Agent` as `select`
- `Category` as `select`

### How to get the database IDs

1. Open the database as a full page in Notion.
2. Copy the URL.
3. The long ID in the URL is the database ID.
4. Put them into:
   - `NOTION_CHAT_LOG_DATABASE_ID`
   - `NOTION_IDEA_CAPTURE_DATABASE_ID`

### Important sharing step

After creating each database, share it with your Notion integration.

If you do not share the database with the integration, the secret will be valid but all API requests will fail.

### Notion adapter status

Current adapter file:

- `server/providers/integrations/notionProviderAdapter.ts`

What it does now:

- uses the Notion SDK
- reads the actual property schema from both databases
- creates one transcript page in the conversation tracker database
- creates zero or more idea pages in the idea database
- adapts to your current property types, including text fields where you used rich text instead of select

What still needs to be implemented:

- stronger idempotency/versioning if a previously exported thread is reopened and exported again
- richer operator-facing page formatting if you want more structure in Notion

### Why the old JSON did not work

The JSON itself was not the main issue.

The bigger issues were:

- there was no live `Log idea` tool
- there were no configured Notion database IDs
- the integration may not have been shared with the databases
- there was no backend parser translating that JSON into Notion API page-creation requests

The current implementation no longer depends on that raw block appearing in the visible assistant reply. Finalization runs a separate idea-extraction pass against the stored transcript and then exports the structured results to Notion.

## Idea Capture Mapping

The product manager prompt now emits a structured JSON block that should be parsed by the finalization layer.

Recommended mapping into the `Cyncly Advisor Ideas` database:

- `Title`
  - first 80 characters of `ideaStatement`
- `Thread ID`
  - thread identifier
- `Conversation Date`
  - thread close date
- `Customer Name`
  - `conversedWith`
- `Problem`
  - `problemStatement`
- `Idea`
  - `ideaStatement`
- `Evidence`
  - joined `keyQuotes`
- `Category`
  - `category`
- `Source Agent`
  - `Summit Product Manager`

Recommended mapping into the `Advisor Conversation Tracker` database:

- `Title`
  - thread title
- `Thread ID`
  - thread identifier
- `User Email`
  - authenticated user email
- `User Name`
  - authenticated user name
- `Opened At`
  - thread start time
- `Closed At`
  - thread finalized time
- `Status`
  - finalized state
- `Summary`
  - thread summary
- `Idea Count`
  - number of extracted ideas

Store the full transcript and any parsed idea JSON in the page body.

## RAG Storage And Preparation

Do not store private RAG documents in the frontend bundle.

Recommended production storage:

- private Supabase Storage bucket for source files
- Supabase tables for extracted documents and chunks

Recommended preprocessing flow:

1. Upload raw source files to private storage.
2. Create a `file_assets` row.
3. Create a `rag_documents` row.
4. Extract text server-side.
5. Chunk the extracted text.
6. Store chunks in `rag_chunks`.
7. Add embeddings later.
8. Retrieve only approved chunks during a live turn.

### Current ingestion command

The first real ingestion pass is now implemented for:

- `docx`
- `csv`

Run it with:

```bash
npm run rag:ingest
```

Current behavior:

- lists all files in the private Supabase bucket from `SUPABASE_STORAGE_BUCKET`
- downloads supported files server-side
- extracts text from `docx` and `csv`
- stores one `file_assets` row per source file
- stores one `rag_documents` row per source file
- replaces `rag_chunks` for each ingested document
- marks `/Features/...` content as lower-priority fallback metadata
- flags likely stub or thin content in metadata
- continues past per-file failures so one bad object does not abort the whole ingest
- retrieval is wired into the live backend turn and ranks preferred folders above `/Features`

Current limitations:

- embeddings are not created yet
- `pdf`, `xlsx`, images, and video are not yet supported in this ingestion pass
- your current bucket has one file that still skips with `Object not found`:
  - `Features/aha_list_features_260410205932.csv`
- one uploaded DOCX currently extracts as empty text:
  - `access/Sign In to Summit.docx`

### File-type guidance

- PDF
  - extract text and preserve headings and page references when possible
- DOCX
  - extract headings and paragraph structure
- XLSX and CSV
  - normalize each sheet into structured text plus source metadata
- images
  - OCR if text matters
- video
  - transcribe first, then chunk the transcript

### Development placeholders

Local folders currently in the repo:

- `rag/raw/`
- `rag/processed/`

Use them only for local experimentation. Production storage should be private backend storage.

## Stub Map

### Frontend stubs

- `src/services/persistence/threadRepository.ts`
  - still provides the browser cache layer
  - is now supplemented by backend sync through `src/services/persistence/threadSyncProvider.ts`

- `src/services/providers/mockConversationProvider.ts`
  - still exists for offline/demo fallback when `VITE_USE_MOCK_BACKEND=true`
  - the default app path now uses `src/services/providers/apiConversationProvider.ts`

### Backend stubs

- `server/providers/model/claudeProviderAdapter.ts`
  - live model calls are wired
  - still needs more structured output handling for idea capture and research-mode constraints

- `server/providers/persistence/supabasePersistenceAdapter.ts`
  - now reads and writes lightweight runtime thread snapshots
  - should later converge with the full Supabase-auth ownership model

- `server/providers/integrations/notionProviderAdapter.ts`
  - now writes transcript and idea pages
  - should later gain stronger re-export versioning

## Auth And Email Gating

Do not keep allowed emails in the frontend.

Recommended approach:

- authenticate with Supabase Auth
- allow access only if the user exists in `public.allowed_users`
- sync display name from `public.allowed_users` into `public.profiles`

This is already the intended shape of `supabase/bootstrap.sql`.

### Current implemented gate

Until full auth is added, the current implementation is:

- backend route:
  - `POST /api/access/email`
- backend service:
  - `server/application/access/emailAccessService.ts`
- backend allowlist adapter:
  - `server/providers/access/envAllowlistAdapter.ts`
- backend signed session helper:
  - `server/lib/accessSessionSigner.ts`
- frontend hook:
  - `src/hooks/useEmailAccess.ts`
- frontend provider:
  - `src/services/access/emailAccessProvider.ts`
- frontend session storage:
  - `src/services/access/emailSessionRepository.ts`

This is intentionally simple, but it still keeps the allowed emails off the frontend and avoids trusting a raw email string alone for thread APIs.

## PII Protection

Current file:

- `src/lib/piiRedaction.ts`

What it does now:

- emails
- phone numbers
- obvious addresses
- heuristic name detection

What still needs hardening:

- replace heuristic name detection with a stronger detector
- move sensitive detection to a more robust pre-model pipeline if higher assurance is needed

## Next Good Passes

1. Converge the lightweight runtime tables into the future Supabase-auth ownership model.
2. Add embeddings plus `pdf`, `xlsx`, image OCR, and video transcript ingestion.
3. Add a live web research path for the third-party research agent.
4. Add explicit close/archive controls in the UI.
5. Add stronger export idempotency for reopened threads.
6. Replace the temporary email gate with full Supabase auth.
