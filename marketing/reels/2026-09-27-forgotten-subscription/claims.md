# Claims — 2026-09-27-forgotten-subscription
Date: 2026-09-27 · Format: reel (1080×1920) · Frames: 5 · Pillar: where-it-went

**The one thing this post says:** Mintr notices a bill that keeps repeating
under the same merchant, even when it's a small charge, and names the rhythm
it repeats on — so you notice the recurring bill you forgot about.

| # | On-screen / spoken | Type | Source | Status |
|---|---|---|---|---|
| 1 | "Groups the charge under one name" — Mintr groups bank transactions by the merchant `Description` string and requires at least 2 occurrences with ≤40% amount variance before treating them as one recurring line | capability | `finance-ai-dashboard/app/engine/recurring_payment_detector.py:9-50` | sourced |
| 2 | "Names the rhythm" — cadence label (Annual / Monthly / Fortnightly / Weekly / "Every ~N days") is produced by running DBSCAN on the day-gaps between charges for that merchant | capability | `finance-ai-dashboard/app/engine/recurring_payment_detector.py:9-50` | sourced |
| 3 | "Even the small ones" — the detector class's own default excludes anything under $150, but the production path overrides that down to $10, so small recurring charges (a streaming-style subscription, a small app fee) do qualify in the live app | capability | `finance-ai-dashboard/app/engine/ai_reserves_service.py:115-128` | sourced |
| 4 | "Recurring bill" / "recurring payment" naming used on the reveal and proof frames | naming | matches the friction the mechanism above solves; deliberately avoids the in-app inconsistency between the "Recurring" nav tile (`finance-ai-mobile/components/home/DeepDivesGrid.tsx:8-9`) and the "Liabilities" screen header (`finance-ai-mobile/app/(tabs)/recurring.tsx:259`) — already flagged separately for the copy-inventory owners, not resolved here | naming | see "For counsel" | flagged, not invented |
| 5 | Merchant name, dollar amount and cadence shown on the reveal card ("Streaming service", "$14.99", "Monthly") | figure | none — no seeded demo account reliably reproduces a stable recurring line, so this is a constructed example, not a screenshot | **illustrative — chip on frame 3 (reveal)** |
| 6 | Everyday "subscription" language on the hook/ache frames (1–2) | copy register | plain-English framing for the friction the viewer already feels; the reveal/proof frames (3–4) switch to "recurring bill/payment" to match what the app itself is called | n/a | by design |

No real merchant or brand name appears on any frame. Frame 3 uses a generic
placeholder ("Streaming service") specifically so the illustrative figure
cannot be read as a claim about, or endorsement by, any named company.

## Blocklist check

Confirmed absent: data-sharing claim · encryption spec · training claim ·
retention period · deletion-completeness claim · guarantee/performance
language · any score or rating of a user · product-recommendation or
directive-framing advice verbs. The verb across every frame is *notice* /
*spot* / *group* / *flag* — never *cancel*, *switch* or *save you money*.

This post does not recommend acting on a financial product. Per FMCA Part 6,
noticing a recurring charge is budgeting insight; telling the viewer to cancel
or switch it would not be, and no frame or caption does that.

## For counsel

- The in-app naming split ("Recurring" tile vs. "Liabilities" screen header,
  `finance-ai-mobile/components/home/DeepDivesGrid.tsx:8-9` and
  `app/(tabs)/recurring.tsx:259`) is a standing copy-inventory item, not
  something this post resolves. This post avoids picking a third name by
  using the plain description "recurring bill/payment" rather than either
  in-app label. Flag to the copy-inventory owners if not already tracked
  there as a separate item.
- No novel, comparative or security claim is made. No number about a user
  (score, gauge, rating) appears.
