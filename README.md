# Bloc Sales CRM | Foundation Engineer Edition

A high-performance lead management system designed to handle **10k+ leads/day** with zero race conditions, atomic assignment logic, and secure webhook ingestion.

---

## 🏗️ Architecture Overview

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

## ⚠️ Automation Trigger Note

The current integration uses **Make.com's free tier**, which enforces a **15-minute polling interval** to watch for new Google Sheet rows. 

**In a true production environment (Business Tier):**
- This would be replaced by an **instant webhook trigger** or direct **WhatsApp API integration**.
- The backend architecture is already optimized for **sub-second ingestion**; only the external automation trigger is restricted by the free plan's frequency.

---

## 🔐 Concurrency & Atomicity Strategy

To ensure data integrity under heavy load, the assignment engine was moved entirely to a **Postgres RPC (Remote Procedure Call)**.

- **Why RPC?**: handling complex logic in Node.js (Fetch -> Calculate -> Update) creates "Check-then-Act" race conditions. Moving it to the DB ensures the entire operation is a single atomic unit.
- **FOR UPDATE Locking**: We select candidates using `FOR UPDATE`. This locks the specific caller rows until the transaction commits, preventing multiple leads from being assigned to the same caller simultaneously.
- **Stateless Scaling**: Because the locking happens at the database level, this system can scale horizontally across multiple stateless API instances without needing a central lock manager (like Redis).

---

## 📈 Scaling to 10k+ Leads/Day

This CRM is architected for significant growth:
- **Stateless Next.js API**: The `/api/ingest` endpoint can be deployed as serverless functions, scaling instantly with incoming traffic.
- **Database Consistency**: Row-level locking ensures that even with massive parallelism, lead distribution remains fair and accurate.
- **Realtime Scalability**: Supabase Realtime handles message broadcasting independently of the main database load.
- **Future-Proofing**: The logic can be easily moved to **Supabase Edge Functions** for global, low-latency execution nearer to the lead source.

---

## 🔒 Security Considerations

- **X-Webhook-Secret**: The ingestion endpoint is protected by a shared secret. Any request without the correct `X-Webhook-Secret` header is rejected with a `401 Unauthorized`.
- **Database RLS**: Row Level Security is enabled on all tables. Public access is strictly read-only for the real-time feed, while modifications require the service role or authenticated admin sessions.
- **Duplicate Protection**: An idempotency check prevents phone numbers from being re-ingested within 24 hours, mitigating accidental automation loops or spam.

---

## 🧪 Manual Verification Checklist

- [ ] **Auth Check**: Access `/api/ingest` without `X-Webhook-Secret` → Result: `401 Unauthorized`.
- [ ] **Spam Check**: Submit lead with same phone twice (within 24h) → Result: `duplicate: true` (no new assignment).
- [ ] **Fairness Check**: Verify `assignment_logs` table after multiple leads → Confirm variety of assignment reasons (e.g., `state_match_round_robin`).
- [ ] **Capacity Check**: Set a caller's `daily_limit` to 1, assign a lead → Confirm subsequent leads trigger `cap_overflow_fallback`.
- [ ] **Real-time Check**: Open `/dashboard` and submit a lead via CURL → Confirm the row "flashes" instantly without refresh.

---

## 🧪 Interview Quick-Start
To defend this architecture in an interview, point to:
- **[assign_lead_atomic.sql](file:///e:/projects/Assignment_grok/migrations/20260227_atomic_assignment.sql)**: The transaction boundary.
- **[route.ts](file:///e:/projects/Assignment_grok/src/app/api/ingest/route.ts)**: The security & idempotency layer.
- **[LeadsTable.tsx](file:///e:/projects/Assignment_grok/src/components/LeadsTable.tsx)**: The reactive real-time UI.

---

## 🖼️ Preview
- **Vercel Deployment**: [https://bloc-sales-crm.vercel.app](https://bloc-sales-crm.vercel.app)
- **Dashboard**: ![Dashboard](./docs/screenshot_dashboard.png)
- **Callers**: ![Callers](./docs/screenshot_callers.png)
