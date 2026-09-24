# Sunday posting calendar

Twelve weeks planned ahead, so the Thursday job picks up a beat rather than
inventing one at 9am. A generator choosing its own subject each week is how a
novel unsourceable claim gets made.

**The week's row is the brief.** Edit it before Thursday if the beat should
change — that is cheaper than rewriting the package after it renders.

Rotation: `number` → `where-it-went` → `plain-english` → `product`.
See [pillars.md](pillars.md) for what each one may and may not say.

| # | Posts | Generated | Pillar | Beat | Assets | Status |
|---|---|---|---|---|---|---|
| 1 | 2026-09-20 | Thu 09-17 | number | Latest NZ food price index move, reported straight | images `feed` | **generated** → `marketing/reels/2026-09-20-food-index/` |
| 2 | 2026-09-27 | Thu 09-24 | where-it-went | The subscription you forgot you had | **+ reel** | planned |
| 3 | 2026-10-04 | Thu 10-01 | plain-english | What "fixed vs variable cost" actually means | images `square` | planned |
| 4 | 2026-10-11 | Thu 10-08 | product | Receipt scan → categories, in one shot | **+ reel** | planned |
| 5 | 2026-10-18 | Thu 10-15 | number | Which grocery category moved most this quarter | images `feed` | planned |
| 6 | 2026-10-25 | Thu 10-22 | where-it-went | The month that looked fine until it was grouped | **+ reel** | planned |
| 7 | 2026-11-01 | Thu 10-29 | plain-english | What a "projection" is, and what it is not | images `square` | planned |
| 8 | 2026-11-08 | Thu 11-05 | product | Knowing what's coming before it lands | **+ reel** | planned |
| 9 | 2026-11-15 | Thu 11-12 | number | Food price index, one year on | images `feed` | planned |
| 10 | 2026-11-22 | Thu 11-19 | where-it-went | Small spends, grouped — the ones that hide | **+ reel** | planned |
| 11 | 2026-11-29 | Thu 11-26 | plain-english | Why "average monthly spend" misleads | images `square` | planned |
| 12 | 2026-12-06 | Thu 12-03 | product | December, seen early | **+ reel** | planned |

## What the job makes, and what you make

**Every week the job renders finished images.** Brand-exact PNGs built from the
real CSS tokens and screenshotted — never drawn by a generative model. Any frame
carrying words, numbers, UI or a claim is rendered, because Veo mangles
typography and will cheerfully invent a figure, and an invented figure in a
finance ad is a misrepresentation with no version field to fix it.

**Video is fortnightly and it is yours.** On a `+ reel` week the job also writes
`prompts.md` — one block per shot, each naming the Flow mode and which rendered
PNG anchors it. It does not generate video. You run those prompts in Google Flow,
which is roughly 20 minutes for a 3–4 shot reel.

| Week type | Job produces | You do | Post is |
|---|---|---|---|
| odd — images | 1–5 rendered PNGs, captions, claims | review, schedule | static post or carousel |
| even — **+ reel** | the same PNGs **plus** `prompts.md` | run prompts in Flow, assemble | Reel, 9:16 |

Use **Frames-to-Video** in Flow with the rendered PNG as the first frame — Veo
animates your exact composition, so the wordmark stays the wordmark. Plain
text-to-video only for atmospheric b-roll with no text in it at all.

**If a reel week gets away from you, post the images.** The rendered frames stand
alone as a carousel. A static post on Sunday beats a Reel that never ships.

Status values: `planned` → `generated` → `approved` → `scheduled` → `posted`.
The Thursday job moves `planned` to `generated` and writes the package path
into the row. Everything after that is a human moving it along.

## The Sunday slot

09:00 NZT. Scheduled in Meta Business Suite, which takes both the Facebook post
and the Instagram Reel and will hold them up to 75 days ahead — so a busy week
can be covered by scheduling two at once rather than skipping.

## UTM per week

```
?utm_source=instagram&utm_medium=social&utm_campaign=w<NN>-<slug>
?utm_source=facebook&utm_medium=social&utm_campaign=w<NN>-<slug>
```

Campaign is the row number and beat slug, so a spike in `mintraiq.com/go`
traffic is attributable to one post rather than to "social".
