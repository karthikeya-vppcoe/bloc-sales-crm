# 🚀 Bloc Sales CRM | Foundation Engineer Submission

A high-performance lead management system designed to handle **10k+ leads/day** with zero race conditions, atomic assignment logic, and secure webhook ingestion.

---

## � Submission Links
> [!IMPORTANT]
> Please update the placeholders below with your actual deployment and media links before submitting.

- **Vercel Deployment**: [https://bloc-sales-crm.vercel.app](https://your-deployment-link.vercel.app)
- **Google Sheets (Test Leads)**: [📊 View Live Spreadsheet](https://docs.google.com/spreadsheets/d/your-sheet-id)
- **Video Demo**: [🎬 Watch Application Walkthrough](https://drive.google.com/your-video-link)

---

## 🏗️ Architecture Overview

The system architecture is designed for **stateless horizontal scaling**, offloading complex concurrency management to the database layer to ensure 100% data integrity.

```text
       [ Google Sheets ]
               │
               ▼
   [ Make.com Automation ] ─── ( 15-min Polling / Free Tier )
               │
               ▼
     [ /api/ingest Route ] ─── ( Next.js API Layer )
               │
               ├─ ( X-Webhook-Secret Validation )
               └─ ( 24h Duplicate Phone Check )
               │
               ▼
   [ assign_lead_atomic() ] ── ( Postgres RPC / Transaction )
               │
               ├─ ( Row-Level Locking: FOR UPDATE )
               ├─ ( State-Priority Routing )
               ├─ ( Daily Cap Enforcement )
               └─ ( Assignment Logs Insert )
               │
               ▼
      [ Supabase Realtime ] ── ( Database CDC )
               │
               ▼
      [ Live Dashboard ] ───── ( Instant UI Update )
```

---

## ⚙️ Setup & Installation

Follow these steps to deploy the CRM environment from scratch.

### 1. Database Provisioning (Supabase)
1. Initialize a new project at [supabase.com](https://supabase.com).
2. Execute the primary schema: Run the contents of [supabase_schema.sql](file:///e:/projects/Assignment_grok/supabase_schema.sql).
3. Enable the Assignment Engine: Run the contents of [20260227_atomic_assignment.sql](file:///e:/projects/Assignment_grok/migrations/20260227_atomic_assignment.sql).

### 2. Application Deployment
1. Clone the repository and install dependencies: `npm install`.
2. Configure Environment Variables in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   WEBHOOK_SECRET=your-secure-webhook-secret
   ```
3. Boot the development server: `npm run dev`.

### 3. Automation Configuration (Make.com)
1. **Module 1**: Google Sheets -> "Watch New Rows".
2. **Module 2**: HTTP -> "Make a Request" (Method: `POST`).
3. **URL**: `https://your-domain.com/api/ingest`.
4. **Header**: `X-Webhook-Secret` matching your `.env` value.

---

## 🧠 Smart Assignment Logic (Development Rationale)

The core challenge of this project was ensuring **fairness** and **consistency** in a high-concurrency environment.

### 4-Tier Routing Strategy:
1.  **State Priority**: Leads are first routed to callers assigned to that specific geography.
2.  **Global Balancing**: If no state-match is found, the system pulls from the global caller pool.
3.  **Daily Cap Enforcement**: Callers who have reached their `daily_lead_limit` are automatically excluded from the round-robin.
4.  **Overflow Fallback**: To prevent lead loss, if *all* eligible callers are at capacity, the system assigns the lead to the caller with the absolute fewest leads assigned today.

### 🔐 Concurrency Defense:
We moved the assignment logic from Node.js to a **Postgres RPC** because application-level "fetch-then-update" flows are vulnerable to race conditions. By using **Row-Level Locking (`FOR UPDATE`)**, we ensure that even if 100 leads arrive at the same millisecond, they are queued and assigned sequentially without double-counting or skipping callers.

---

## 🗄️ Database Structure

### 1. `callers` Table
- **Purpose**: Manages agent capacity and routing preferences.
- **Key Fields**: `assigned_states` (Array with GIN index for search performance), `leads_assigned_today` (Atomic counter), `last_assigned_at` (Drives round-robin).

### 2. `leads` Table
- **Purpose**: Centralized lead repository with deduplication logic.
- **Key Fields**: `phone` (Indexed for 24h duplicate checks), `metadata` (JSONB for flexible ingestion).

### 3. `assignment_logs` Table
- **Purpose**: Audit trail for debugging routing decisions.
- **Key Fields**: `assignment_reason` (Records why a specific caller was chosen).

---

## ⚠️ Automation Trigger & Scaling Note

> [!NOTE]
> The current setup uses **Make.com's Free Tier**, which polls Every **15 minutes**. 
> This is a platform limitation, not a system limitation. The backend is architected for **sub-second ingestion**. On a paid tier or direct WhatsApp API integration, leads appear on the dashboard instantly after submission.

---

## 🛤️ Future Improvements (With More Time)
1. **Webhook Security**: Implement HMAC-SHA256 signatures for authenticating requests from Make.com.
2. **Dynamic Routing**: Add language-based matching (already planned in the schema).
3. **Real-time Performance Metrics**: Visualize caller conversion rates directly on the dashboard.
4. **Automated Re-assignment**: Automatically move leads if a caller hasn't updated the status within 2 hours.

---

## 🖼️ Visual Preview

### Automation Workflow
![Make.com Workflow](./docs/make_workflow.png)
*Visualizing the ingestion pipeline from Google Sheets to Next.js.*

### Real-Time Dashboard
![Dashboard](./docs/screenshot_dashboard.png)
*The reactive dashboard showing leads as they are assigned in real-time.*

### Caller Management
![Callers](./docs/screenshot_callers.png)
*Interface for adjusting capacities and state routing preferences.*
