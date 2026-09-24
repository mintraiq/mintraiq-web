# Claims — 2026-09-20-food-index
Date: 2026-09-20 · Format: feed (1080×1350) · Frames: 4 · Pillar: number

**The one thing this post says:** food prices rose 1.9% in the year to August
2026, and that average hides a five-point spread between what rose and what fell.

Every figure below is from one release: **Stats NZ, *Selected price indexes:
August 2026*, published 18 September 2026.** Monthly change compares August 2026
with July 2026; annual change compares August 2026 with August 2025. Both
comparisons are stated on the frames, because a figure shown without its
reference month is the exact defect `portal/js/price-overlay-copy.js` was written
to stop — that chart once drew a September 2023 figure across 2026 months.

| # | On-screen | Type | Source | Status |
|---|---|---|---|---|
| 1 | "Food prices rose 1.9%" (year to Aug 2026) | figure | Stats NZ SPI Aug 2026, Food group, annual | sourced |
| 2 | "Meat, poultry and fish +3.4%" | figure | same release, annual | sourced |
| 3 | "Restaurant meals +3.2%" | figure | same release, annual | sourced |
| 4 | "Fruit and vegetables −1.6%" | figure | same release, annual | sourced |
| 5 | "+0.3% on the month" | figure | same release, Food group, monthly | sourced |
| 6 | "Mintr charts a grocery item against the Stats NZ food price index average" | capability | `portal/js/price-overlay-copy.js:26` `CPI_LEGEND_LABEL`, `overlayCaption()` | sourced |
| 7 | "See what your own basket did" | capability | receipt scan → product price chart, same module | sourced |

No illustrative figures. Nothing on these frames is invented, rounded in a
flattering direction, or carried over from a different month.

## Licence condition — not optional

Stats NZ data is CC BY 4.0. `stats.govt.nz/about-us/copyright` prescribes the
attribution sentence when their data is included in a collection, which is what
this post is. `portal/js/price-overlay-copy.js` already pins the exact wording as
`STATS_NZ_ATTRIBUTION`, so this post reuses that string rather than paraphrasing:

> This work is based on Stats NZ's data which are licensed by Stats NZ for reuse
> under the Creative Commons Attribution 4.0 International licence.

It appears on the closing frame **and** in both captions. Attribution uses the
words "Stats NZ" and never their logo.

The index is named `Stats NZ food price index`, matching `CPI_SOURCE_NAME`
verbatim. It is not the CPI and is never called that.

## Blocklist check

Confirmed absent: data-sharing claim · encryption spec · training claim ·
retention period · deletion-completeness claim · advice verbs · guarantee or
forecast language · any score or rating of a user.

The post reports someone else's published statistic and says Mintr will show you
your own figures. It does not tell anyone what to buy, where to shop, or what to
do about a price. The verb stays on seeing.

## For counsel

- None for this post. It makes no novel, comparative or security claim, and
  carries no number about a user.
- Standing item, not raised by this post: "AI financial mentor" and the site
  meta's "intelligent growth insights" are queued in `social-profiles.md` for the
  single pillars review.
