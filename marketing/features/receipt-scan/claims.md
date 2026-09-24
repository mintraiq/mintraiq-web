# Claims — receipt-scan
Date: 2026-09-24 · Format: reel (1080×1920) · Frames: 5 · Pillar: Track

**The beat.** For someone who gets to the end of a grocery shop with no idea
what made up the total, Mintr turns a photographed receipt into sorted line
items, so they can see the shape of the shop without typing anything.

## Claims table

| # | On-screen / spoken | Type | Source | Status |
|---|---|---|---|---|
| 1 | "Snap the receipt" — the app can photograph and read a receipt | capability | `finance-ai-mobile app/(tabs)/scan.tsx`, reachable from `components/home/QuickInputRow.tsx:9` and onboarding | sourced |
| 2 | "Every line, read" — OCR extracts individual line items | capability | `receipt-scanner app/ocr/providers.py:30` (`OpenAIProvider`), model `gpt-4.1` at `app/ocr/constants.py:1`; item model `app/models/receipt_document.py:22` | sourced |
| 3 | "Sorted into categories" — line items are categorised automatically | capability | `finance-ai-dashboard app/api/finance_api.py:167` constructs `MintraExpenseCategorizer`; TF-IDF char n-grams → LinearSVC at `app/ml/categorizer_finetuned.py:38,108,118` | sourced |
| 4 | "Without typing a thing" — no manual entry required | capability | Follows from 1–3; upload and scan are the only ingestion paths (founder decision 13 Aug 2026) | sourced |
| 5 | Receipt total, line items and category amounts on frames 3 and 4 | figures | — | **illustrative — chip on frames 3 and 4** |

## Cut from this reel

**The privacy angle, deliberately.** The obvious hook for a receipt-scanning
reel is "your shopping isn't sent to an AI". Two things make that unusable:

- The **receipt image is sent to a third-party vision model** for OCR —
  `receipt-scanner app/ocr/providers.py:30`, `gpt-4.1`. Any frame implying the
  photo stays private is false.
- The categoriser is **not on-device**. `MintraExpenseCategorizer` is
  constructed server-side in the dashboard (`app/api/finance_api.py:167`), a
  Python backend. "On your phone" or "on-device" would be false.

The narrow true statement — *transaction descriptions are categorised by
MintrAIQ's own model rather than sent to an LLM* — is real, but placing it in a
reel whose subject is photographing a receipt creates the impression that the
photo is private too. The Fair Trading Act tests the impression created, not the
words avoided, so the claim is cut here rather than reworded. It belongs on a
categorisation entry, where the subject matches the claim.

**"Learns from your corrections"** is also cut. The retrain job is scheduled and
has never trained a model — last eligible run declined with `labeled samples 19
< minimum 50` (`config.py:883`). Removed from `legal.json` in PR #44 on the same
grounds; it must not reappear here.

**Real retailer and product names**, caught reviewing the rendered PNGs rather
than at the writing stage. The first render put "COUNTDOWN · ROYAL OAK" and
"VOGELS ORIGINAL" on an invented receipt with invented prices. That is the same
defect as the claims gate's bank-logo rule (FTA s 13): it implies a relationship
with a named business that does not exist, and it attributes fabricated prices
to a real retailer, which is a representation about *their* pricing, not ours.

Frames now read "SUPERMARKET RECEIPT" / "GROCERY RECEIPT" and carry no brand
names. Generic descriptors and cultivar names (Cavendish, Agria) stay — they
describe the produce rather than naming a company.

**Standing rule for this catalogue:** an illustrative receipt, statement or
merchant never carries a real business name.

## Blocklist check

Confirmed absent from every frame and caption:
data-sharing claim · encryption spec · training claim · retention period ·
advice verbs · unexplained user score · bank names or logos · savings promise.

No figure appears without either a source or a visible `Illustrative example`
chip. No forecast language appears at all.

## For counsel

1. **Illustrative receipt data.** Frames 3 and 4 show an invented grocery
   receipt with a visible `Illustrative example` chip. Confirm the chip as
   placed is sufficient, given the frame may be screenshotted and reshared
   without the caption.
2. **OCR disclosure in a marketing context.** This reel does not mention that
   the receipt image is processed by a third-party vision model. It makes no
   privacy claim either way. Confirm silence is acceptable here, or whether a
   marketing surface showing the scan flow should carry the same disclosure the
   in-app AI consent card does (`finance-ai-mobile lib/aiDisclosure.ts`).

## Verification caveat

`receipt-scanner` merged the promo-line fix on `origin/main`
(`c08f498`, `e63fcd5` — a quantity-0 promotion line no longer discards the whole
receipt). **Merged is not deployed** in this workspace. Confirm the fix is live
in production before this reel drives scan volume, or the reel will send people
at a bug that eats whole receipts silently.
