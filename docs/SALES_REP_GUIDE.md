# PLUSS CRM — Sales Rep Playbook

This guide explains **exactly** how to use PLUSS CRM from the moment a lead is assigned to you until the deal is closed and the client is in the system.

---

## Table of contents

1. [Getting started](#1-getting-started)
2. [What you can and cannot do](#2-what-you-can-and-cannot-do)
3. [The full sales journey (overview)](#3-the-full-sales-journey-overview)
4. [Step-by-step: lead to close](#4-step-by-step-lead-to-close)
5. [Page-by-page instructions](#5-page-by-page-instructions)
6. [Lead statuses explained](#6-lead-statuses-explained)
7. [Deal pipeline stages](#7-deal-pipeline-stages)
8. [Activity logging rules](#8-activity-logging-rules)
9. [After you win a deal](#9-after-you-win-a-deal)
10. [Daily routine checklist](#10-daily-routine-checklist)
11. [Common mistakes to avoid](#11-common-mistakes-to-avoid)
12. [Quick reference](#12-quick-reference)

---

## 1. Getting started

### Login

| Item | Value |
|------|--------|
| **Login URL** | `/login` (e.g. `https://your-domain.com/login`) |
| **Your email** | Provided by your admin when your account is created |
| **Password** | Set by admin on first invite — change it under **Settings → Security** |

> **Note:** Admin login is a separate hidden URL (`/portal/staff`). Reps must use `/login` only.

### Your sidebar menu

As a sales rep you have access to:

| Menu item | Purpose |
|-----------|---------|
| **Dashboard** | Your personal KPIs, pipeline snapshot, activity feed |
| **Leads** | Your assigned leads — start every sale here |
| **Pipeline** | Active deals and stage progression |
| **Clients** | Won accounts you manage |
| **Activities** | Log calls, emails, meetings, tasks |
| **Payments** | View payment status (recording is admin-only) |
| **Leaderboard** | Rankings, tiers, and performance badges |
| **Settings** | Password and notification preferences |

You **do not** see: Import Leads, Split Rules, Queue, All Leads, Accounting, or Team. Those are admin-only.

---

## 2. What you can and cannot do

### You CAN

- View and work **only leads assigned to you**
- Edit lead details (name, company, phone, wilaya, links, notes, value) for your leads
- Delete leads assigned to you (use only if duplicate or invalid)
- Create deals, move them through the pipeline, and mark them **Won** or **Lost**
- Log activities and complete scheduled tasks
- Manage clients where you are the **manager**
- View payments linked to your deals
- Track your performance on the Dashboard and Leaderboard

### You CANNOT

- See or work other reps' leads
- Import CSV leads or change assignment rules
- Record payments (admin does this)
- Access accounting, team management, or company-wide admin views
- Change another rep's deals or clients

---

## 3. The full sales journey (overview)

```
Admin assigns lead to you
        ↓
   LEADS board — contact the prospect
        ↓
   Log every touchpoint in ACTIVITIES
        ↓
   Qualify the opportunity
        ↓
   PIPELINE — create a deal
        ↓
   Move deal: Contacted → Qualifying → Proposal → Negotiation
        ↓
   Mark deal WON (or LOST)
        ↓
   Client auto-created → manage in CLIENTS
        ↓
   Admin records payment → visible in PAYMENTS
```

**Golden rule:** If it happened in the real world, it must be in the CRM. No activity = no proof of work = no credit on the leaderboard.

---

## 4. Step-by-step: lead to close

### Phase 1 — Receive and claim the lead

1. Log in and open **Leads**.
2. New leads appear with status **Assigned** (or **New** if unclaimed in your queue).
3. If status is **New**, click the blue **Assign** button on the card to claim it yourself.
4. Review the card:
   - **Phone** icon — tap to call
   - **Email** icon — tap to email
   - **Pencil** icon — edit details if something is wrong
   - **Value** — estimated deal size in USD

### Phase 2 — First contact

1. Call or message the lead using the icons on the card.
2. Click the action button **Contact** (when status is **Assigned**).
   - This moves the lead to **Contacted**.
3. Immediately go to **Activities → Log Activity** (or click **Log Activity** on the lead card — it opens Activities with the lead pre-selected).
4. Log the touchpoint:
   - **Type:** Call, Email, WhatsApp, or Meeting
   - **Note:** What was said, next step, objections
   - **Outcome:** e.g. "Interested", "Callback Friday", "No answer"

### Phase 3 — Qualify the opportunity

1. Continue logging every follow-up in **Activities**.
2. On the **Leads** board, keep working leads in **Contacted** and **Qualifying** status.
3. When the prospect is a real opportunity (budget, need, timeline confirmed):
   - Open **Pipeline**
   - Click **+ New Deal**
   - Select the lead from the dropdown (only your assigned leads appear)
   - Enter **deal value**, **currency** (USD or DZD), and **expected close date**
   - Click **Create Deal**

### Phase 4 — Work the pipeline

1. Stay in **Pipeline** — your deal appears in the **Contacted** column.
2. **Click the deal card** each time you advance the sale. One click = one stage forward:

   ```
   Contacted → Qualifying → Proposal → Negotiation → Won
   ```

3. Keep logging activities in parallel — especially after meetings and proposals sent.
4. Watch the **days in stage** counter on each card. If a deal sits too long, follow up or mark **Lost**.

### Phase 5 — Close the deal

**If you WIN:**

1. In **Pipeline**, click the deal card until it reaches **Won**.
2. The system automatically:
   - Sets the lead status to **Won**
   - Creates a **Client** record under your name
   - Creates a **commission** entry (pending admin payout)
   - Adds **+100 points** to your profile for the leaderboard
   - Notifies admin

3. On **Leads**, click **View Client** on the won lead to open the client profile.

**If you LOSE:**

1. Keep clicking the deal card past **Negotiation** until it lands in **Lost**.
2. On the **Leads** board, you can click **Reactivate** on a lost lead to move it back to **Contacted** if they come back later.

### Phase 6 — Client management & payment

1. Open **Clients** and click the client name.
2. On the client profile you can:
   - View **Deal History** and **Payment History**
   - Read the **Activity Timeline**
   - Add **Notes** (e.g. renewal reminders)
   - Upload **Files** (contracts, proposals)
   - Click **Flag for renewal** when it's time to re-engage

3. **Payments** — you can view status here. When the client pays, **admin records the payment**. You will see it as **Received** once logged.

---

## 5. Page-by-page instructions

### Dashboard (`/dashboard`)

Your personal command center:

- **Deals won this month** — closed revenue you brought in
- **Win rate** — % of your deals won vs lost
- **Pipeline value** — total value of open deals
- **Activity feed** — recent actions on your accounts
- **Charts** — revenue trend, pipeline funnel, activity volume

Check this every morning before calling.

---

### Leads (`/leads`)

**Views:**

- **Grid** — cards with quick actions (default)
- **Kanban** — columns by status (New → Negotiation)

**Filters:**

- Search by name or company
- Filter by status

**Buttons on each lead card:**

| Lead status | Button label | What it does |
|-------------|--------------|--------------|
| New | Assign | Claims the lead for you |
| Assigned | Contact | Moves to Contacted |
| Contacted | Log Activity | Opens Activities with this lead |
| Qualifying | Log Activity | Opens Activities with this lead |
| Proposal | Open Deal | Opens Pipeline |
| Negotiation | Open Deal | Opens Pipeline |
| Won | View Client | Opens client profile |
| Lost | Reactivate | Moves back to Contacted |
| Dormant | Contact | Moves back to Contacted |

**Edit lead (pencil icon):** Update name, company, number, wilaya, Google Maps link, website, source, value, and notes. You cannot change status from here — status follows your actions and pipeline.

**Delete lead (trash icon):** Only for duplicates or bad data. Cannot be undone from your view.

---

### Pipeline (`/pipeline`)

**Summary bar:** Active deal count and total pipeline value (shown in your display currency).

**Columns:**

| Column | Meaning |
|--------|---------|
| Contacted | Deal created, initial conversation done |
| Qualifying | Confirming fit, budget, timeline |
| Proposal | Offer/proposal sent |
| Negotiation | Terms, pricing, final objections |
| Won | Closed — client created automatically |
| Lost | Did not close |

**How to move a deal:** Click the deal card. Each click advances one stage.

**New Deal form:**

- Lead — must be assigned to you
- Value — deal amount
- Currency — USD or DZD
- Close date — when you expect to sign

> **Tip:** Set a realistic close date. Overdue deals show a red warning icon.

---

### Activities (`/activities`)

**Tabs:**

| Tab | Shows |
|-----|-------|
| Activity Log | All logged touchpoints |
| Scheduled Tasks | Open tasks with due dates |
| Call Log | Calls only |

**Log Activity form:**

| Field | Required | Notes |
|-------|----------|-------|
| Type | Yes | Call, Email, Meeting, Note, Task, WhatsApp |
| Lead | Recommended | Link activity to the lead |
| Note | Yes | Be specific — this is your paper trail |
| Outcome | No | Result of the interaction |
| Due date | For tasks | Creates a scheduled task |

**Scheduled tasks:** Mark complete with the check button when done. Overdue tasks are highlighted.

---

### Clients (`/clients`)

- Lists clients where **you are the manager**
- **+ Add Client** — manually add a client (usually clients are auto-created when you win a deal)
- Click a row to open the full **client profile**

**Client profile tabs:**

1. **Deal History** — won deals for this company
2. **Payment History** — invoices and payment status
3. **Activity Timeline** — all logged touchpoints
4. **Notes & Files** — internal notes and document uploads

---

### Payments (`/payments`)

**Read-only for reps.** Use this to:

- See total received this month
- Check if a client's payment is **Pending**, **Partial**, or **Received**
- Follow up with admin if payment is overdue

Recording a payment is **admin only**.

---

### Leaderboard (`/leaderboard`)

- Compare your rank against other reps (Daily / Weekly / Monthly)
- Tiers: **Bronze → Silver → Gold → Diamond**
- Earn points from activities and won deals
- Badges for top closers, high win rate, and rising performers

---

### Settings (`/settings`)

- **Security** — change your password
- **Notifications** — toggle which events you want to track locally

---

## 6. Lead statuses explained

| Status | Color | Meaning | Your action |
|--------|-------|---------|-------------|
| **New** | Blue | Just entered system, unclaimed | Click **Assign** |
| **Assigned** | Purple | Assigned to you, not yet contacted | Click **Contact** after first outreach |
| **Contacted** | Cyan | First touch made | Log activity, qualify |
| **Qualifying** | Amber | Evaluating fit | Log activity, create deal when ready |
| **Proposal** | Orange | Offer sent | Open Pipeline, advance deal |
| **Negotiation** | Red | Final terms | Open Pipeline, push to Won or Lost |
| **Won** | Green | Deal closed | View Client, manage relationship |
| **Lost** | Gray | Did not close | Reactivate if they return |
| **Dormant** | Slate | Gone cold | Click **Contact** to re-engage |

---

## 7. Deal pipeline stages

Deal stages mirror lead progression but are tracked separately as **opportunities with a dollar value**.

```
Contacted ──► Qualifying ──► Proposal ──► Negotiation ──► Won
                                              │
                                              └──► Lost
```

| Stage | Exit criteria (move forward when…) |
|-------|--------------------------------------|
| **Contacted** | You have spoken with the decision-maker |
| **Qualifying** | Budget, need, authority, and timeline confirmed |
| **Proposal** | Written proposal or quote delivered |
| **Negotiation** | Active back-and-forth on terms |
| **Won** | Signed, paid, or contract agreed |
| **Lost** | Prospect declined or went elsewhere |

---

## 8. Activity logging rules

Log an activity **every time** you:

- Make or receive a call
- Send an email or WhatsApp
- Hold a meeting (in person or video)
- Send a proposal
- Get a clear yes/no from the prospect

**Minimum standard:** At least one activity per lead per week while the deal is open.

**Good note example:**
> "Called Ahmed at 10:30. Interested in Q3 campaign. Asked for proposal by Friday. Budget ~$5,000 USD. Callback Monday if no reply to email."

**Bad note example:**
> "Called."

---

## 9. After you win a deal

When a deal hits **Won**, the system handles:

| Automatic action | Details |
|------------------|---------|
| Lead → Won | Lead card turns green |
| Client created | Company, contact, email, phone copied from lead |
| Commission created | Based on your compensation plan (admin pays out) |
| +100 points | Added to your leaderboard score |
| Admin notified | "Deal Won" notification sent |

**Your follow-up checklist:**

- [ ] Open **Clients** and verify contact details are correct
- [ ] Add a note: "Onboarding started — [date]"
- [ ] Upload signed contract in **Notes & Files** if applicable
- [ ] Confirm with admin that payment will be recorded
- [ ] Schedule a check-in task in **Activities**

---

## 10. Daily routine checklist

### Morning (15 min)

- [ ] Open **Dashboard** — check pipeline value and deals won MTD
- [ ] Open **Leads** — filter by **Assigned** and **Contacted**
- [ ] Open **Activities → Scheduled Tasks** — complete or reschedule overdue tasks
- [ ] Plan your top 5 calls for the day

### During the day

- [ ] Call/email leads from your board
- [ ] Log every touchpoint immediately after it happens
- [ ] Advance pipeline deals when a stage is truly complete (don't skip stages)

### End of day (10 min)

- [ ] All today's calls logged in **Activities**
- [ ] Deal stages updated in **Pipeline**
- [ ] Lead cards reflect reality (no stale "Assigned" leads you already contacted)
- [ ] Check **Leaderboard** for your rank

---

## 11. Common mistakes to avoid

| Mistake | Why it hurts | Fix |
|---------|--------------|-----|
| Not logging activities | No proof of work; manager can't coach you | Log before you close the CRM tab |
| Skipping pipeline stages | Inflated pipeline, wrong forecasts | Click through each stage honestly |
| Creating a deal too early | Junk pipeline | Wait until lead is qualified |
| Forgetting close date | Deals show overdue | Set date when creating deal |
| Working unassigned leads | You may not have permission; data issues | Only work leads on your board |
| Marking Won before it's real | Wrong commission and client records | Only mark Won when deal is truly closed |
| Not checking client after win | Miss onboarding and renewal | Open client profile same day |

---

## 12. Quick reference

### Lead card action buttons

```
New          →  Assign
Assigned     →  Contact
Contacted    →  Log Activity
Qualifying   →  Log Activity
Proposal     →  Open Deal
Negotiation  →  Open Deal
Won          →  View Client
Lost         →  Reactivate
Dormant      →  Contact
```

### Pipeline click progression

```
Contacted → Qualifying → Proposal → Negotiation → Won → (or Lost)
```

### Currency

- Deals can be in **USD** or **DZD**
- Dashboard and totals may display in your company's chosen display currency (set by admin)
- Enter the actual currency of the deal when creating it

### Who assigns leads?

Your **admin** assigns leads via:

- CSV import + split rules (automatic round-robin)
- Assignment queue (manual bulk assign)
- All Leads page (individual assign)

You receive a notification when a lead is assigned to you.

### Getting help

- **Platform/password issues** → contact your admin
- **Lead data wrong** → edit the lead or ask admin to fix import
- **Payment not showing** → ask admin to record it in Payments
- **Commission questions** → admin checks Team → Commission Ledger

---

## Summary: the 7 commands of PLUSS CRM

1. **Work your Leads board every day**
2. **Log every touch in Activities**
3. **Create a Deal only when qualified**
4. **Advance Pipeline honestly, one stage at a time**
5. **Mark Won only when the deal is real**
6. **Manage the Client after you win**
7. **Check Dashboard and Leaderboard to stay on track**

---

*PLUSS CRM — Sales Rep Playbook · Internal use only*
