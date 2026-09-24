# Feature catalogue

**What this is.** One folder per Mintr feature, holding everything needed to
explain that feature to somebody: the frames, the script, the captions, and the
claims table that sources every factual statement. A feature is scripted once
here and reused — in the Sunday social slot, in a weekly or monthly email, on
the website, in an app-store screenshot caption.

**Why it exists rather than generating copy each time.** The weekly pipeline in
`marketing/reels/` produces a package per *week*. Nothing carries over, so the
same feature gets re-described from scratch every time it is mentioned, and each
re-description is a fresh chance to make a claim the product does not support.
That is not hypothetical here:

- `legal.json` claimed the categoriser "learns from your corrections". Traced
  22 Sep 2026: the retrain job is scheduled and has **never trained a model**
  (last eligible run declined, `labeled samples 19 < minimum 50`). Removed in
  PR #44 as a Fair Trading Act s 9 problem.
- The same sentence is still sitting in `marketing/email/welcome.html:260` and
  `welcome.txt:41`, written the day before the fix, because nothing scans that
  directory.

A catalogue entry is the single place a feature's wording lives, so correcting
it once corrects it everywhere.

---

## The five pillars

Taken from the welcome email, which is the canonical user-facing grouping.
Do not invent a sixth.

| Pillar | Holds |
|---|---|
| **Track** | statement upload · receipt scan · transactions · categorisation |
| **Analyse** | intelligence hub · spending breakdown · Mintor |
| **Discipline** | Money Minute · badges · notifications |
| **Plan** | AI Advisor · smart weekly planner |
| **Grow** | goals · product price tracker |

## What may and may not be advertised

Verified against `finance-ai-mobile origin/main`, `finance-ai-dashboard
origin/main` and `ai-forecasting origin/master` on 24 Sep 2026. **Re-verify
before adding an entry** — a gated surface can be ungated, and a stub can be
fixed.

### Blocked

| Feature | Why | Evidence |
|---|---|---|
| Inflation Guru (CPI) | Badges "Beating national avg" green against a hardcoded constant, not a real national figure | `cpi.tsx:203` `const NATIONAL_AVG = 3.0;` · `cpi.tsx:259-271` |
| Recurring / AI Reserves | No paid, settled or dismissed state exists; "overdue" derives from `days_until_due < 0` and never clears, permanently inflating the required reserve | `ai_reserves_service.py`, `bill_declarations.py`, `reserve_bill_filter.py` · PRIORITIES P1 #37 |
| Bank sync (Akahu) | No bank aggregation exists. Correctly hidden in-app | `ENABLE_BANK_SYNC` false · `bank_sync_screen.tsx:29` redirects to `/upload` |
| Smart Zone | Gated off, location keys stripped from the binary; re-enabling needs a native rebuild | `ENABLE_SMART_ZONES` false |
| Explore tab | Orphaned — hidden from the tab bar, zero inbound navigation. Dead code, not a surface | `_layout.tsx:81` `href: null` |

**Blocked means blocked in every wording.** The precedent in this codebase is
remove, not soften — a softened false claim is still false.

### Needs a decision before use

| Feature | Open question |
|---|---|
| Dashboard / Safe to Spend | The screen is real and reachable. Its AI Forecast chart is fed by the LSTM that benchmarked to a near-flat line and lost to seasonal-naive. Show the screen; do not claim forecast accuracy. |
| Streak forgiveness | The cover mechanic works, but its explainer never renders: `AppShellHeader.tsx:70-71` reads `freezes_remaining` and `/bootstrap` only sends `covers_*`. Fix the key before highlighting it. |
| Email connector | Production still authenticates through the old personal-tenant Azure app; publisher verification unconfirmed. Mobile visibility depends on an EAS variable that cannot be read from source. |

---

## Entry layout

```
marketing/features/<slug>/
├── claims.md     every factual statement + file:line source
├── script.md     ELI5 beats, on-screen text and voiceover (separate registers)
├── frames/       *.html sources + rendered *.png
├── prompts.md    one block per shot: Flow mode + which PNG anchors it
└── captions.md   LinkedIn · Facebook · the email paragraph
```

`claims.md` is written **before** the first frame renders. That ordering is the
whole control: a claim with no source gets cut or gets an `Illustrative example`
chip, and neither decision survives being made after the art is finished.

Full rules: `marketing-reel/references/claims-gate.md`.

## Rendering

```bash
node "$CLAUDE_PLUGIN_ROOT/skills/marketing-reel/scripts/render.cjs" \
  --all marketing/features/<slug>/frames --preset reel
```

Then **look at the PNGs**. A frame that renders is not a frame that works.

Text is always rendered from real brand tokens, never generated. Veo supplies
motion; it never supplies a word or a number.

## Reusing an entry

| Destination | Take |
|---|---|
| Sunday social (`calendar.md` weeks 4, 8, 12) | the frames + the LinkedIn/Facebook caption |
| Weekly or monthly email | the email paragraph from `captions.md`, linking the same frames |
| Website / app store | individual frames |

Point the calendar row at the entry rather than copying its text into the row.
One source, one correction.

> ## The gate does not reach this directory yet
>
> `npm run test:social-copy` scans `marketing/reels/*/captions.md` only
> (`scripts/social-copy.test.mjs:43`). It does not scan `marketing/features/`,
> `marketing/email/` or `marketing/pitches/`. And there is no rule in
> `scripts/social-copy-rules.mjs` for the "learns from your corrections" claim,
> so widening the scan alone would not catch it.
>
> Until both are done, **every entry here is reviewed by hand against
> `claims-gate.md`.** Do not treat a green test run as clearance.
