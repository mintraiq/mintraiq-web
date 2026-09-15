# Mintr social pillars

Four pillars rotate weekly. The rotation is the point: it means only one week
in four makes a product claim heavy enough to need a full claims gate, and no
two consecutive Sundays sound the same.

Every post, whichever pillar, obeys one rule from
`marketing-reel/references/claims-gate.md` §2 — **the verb stays on
understanding, never on acting on a financial product.** Budgeting insight
needs no licence. Recommending a credit contract, insurance, KiwiSaver or an
investment is regulated financial advice under FMCA Part 6.

| | Safe | Not safe |
|---|---|---|
| verb | see, spot, notice, know, track | switch, refinance, invest, optimise |
| subject | the user's own spending | a product they could buy |
| tense | what happened, what is projected | what they should do |

`npm run test:social-copy` enforces the known-bad phrasings. It cannot catch a
novel false claim in fresh wording — that is what the review step before
scheduling is for.

---

## 1 · The number this week
**Weeks 1, 5, 9 …**

The live NZ food price index already in the product. A published Stats NZ figure
reported accurately is factual, sourced and sits nowhere near the advice line —
which makes this the cheapest slot to fill and the safest to automate.

- Source every figure to the Stats NZ release in `claims.md`. Never round in a
  direction that flatters the story.
- The product tie-in is one line at the end, not the subject of the post.
- Format: `feed` (1080×1350). A chart reads badly in a Reel.

## 2 · Where it went
**Weeks 2, 6, 10 …**

The understanding pillar, and the closest to what the app actually does. The
forgotten subscription, the receipt that turned out to be three categories, the
month that looked fine until it was grouped.

- Any figure on screen is sourced, or carries a visible `Illustrative example`
  chip. Never invent a plausible number to fill a layout.
- App screenshots come from a `mock_injected: true` account only. A real user's
  transactions in an ad is a Privacy Act 2020 breach and blurring is not
  de-identification.
- Format: `reel`.

## 3 · Plain English
**Weeks 3, 7, 11 …**

One term, explained as if to someone who has never heard it. Generic and
non-personalised, which keeps it on the safe side of Part 6 — explaining what
a term *means* is education; telling this viewer what to do about it is advice.

- Explain the concept. Do not recommend a response to it.
- The ELI5 register: big picture, few words, no jargon defended by more jargon.
- Format: `square` carousel, or `reel` if it animates.

## 4 · One thing Mintr does
**Weeks 4, 8, 12 …**

The product beat. One reel says one thing — if the sentence needs an "and", it
is two reels.

- Full claims gate. Every capability named gets a `file:line` in `claims.md`.
- Check the feature's name in `finance-ai-mobile/constants/` and `legal.json`
  before naming it. The streak mechanic already shipped under two names; do not
  add a third in an ad.
- Format: `reel`.

---

## The link, every week

Instagram captions cannot carry a clickable link — Meta began testing caption
links in March 2026 but only for Meta Verified professional creators. So:

| Platform | How the links appear |
|---|---|
| Facebook | Real links in the post text: mintraiq.com, App Store, Play Store |
| Instagram | "Link in bio" → bio points permanently at `mintraiq.com/go` |

`go.html` carries all three destinations. Tag the arrival with UTMs
(`?utm_source=instagram&utm_medium=social&utm_campaign=w38-food-index`) so
PostHog attributes the week. Never put anything but campaign parameters in that
query string — PostHog records the full URL including the query.
