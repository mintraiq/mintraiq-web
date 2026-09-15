---
description: Generate this week's Sunday Facebook + Instagram package from marketing/calendar.md
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Skill
---

Generate the social package for the next unposted Sunday.

## 1 — Find the week

Read `marketing/calendar.md`. Take the **first row whose status is `planned`**
and whose posting date is in the future. That row is the brief: its pillar, beat
and format are decided, not yours to change. If the first planned row's date has
already passed, say so and stop — a missed week is a decision for Ram, not
something to quietly backfill.

Read `marketing/pillars.md` for what that pillar may and may not say.

## 2 — Produce the package

Invoke the `mintraiq-toolkit:marketing-reel` skill with the row's beat and
format. Follow it in full — the claims gate in its step 2 is blocking, and
`claims.md` gets written before a single frame renders.

Output goes to `marketing/reels/<posting-date>-<slug>/`.

Two things the skill's defaults do not know about this weekly cadence:

- **Every `captions.md` carries all three links.** Facebook takes
  `https://mintraiq.com/go`, the App Store URL and the Play Store URL as real
  links in the post text. Instagram cannot render a caption link at all, so its
  version says "link in bio" and the bio points at `mintraiq.com/go`. Tag both
  with the week's UTM from the calendar.
- **The pillar constrains the claim.** A `number` week reports a published
  Stats NZ figure and ties to the product in one closing line. A `product` week
  gets the full gate. Do not let a `plain-english` week drift into telling the
  viewer what to do — explaining a term is education, recommending a response
  is regulated advice.

## 3 — Check it

```bash
npm run test:social-copy
```

This is blocking. It catches the claims already proven false in this product
and the FMCA Part 6 advice verbs. If it fails, **fix the copy — do not weaken
the rule.** The precedent in this codebase is remove, not soften.

Then read the rendered PNGs back with the Read tool. A frame that renders is not
a frame that works: check the hook is legible at thumbnail size and nothing
collides with the safe areas.

## 4 — Hand back

Update the calendar row: status `planned` → `generated`, and append the package
path.

Then report, briefly:

- the beat, and the one thing this post claims
- which claims are sourced and which are carrying an `Illustrative example` chip
- anything under **For counsel** in `claims.md`
- what Ram must do before Saturday: run the Veo prompts in Flow if it is a video
  week, then schedule both posts in Meta Business Suite for Sunday 09:00 NZT

**Do not post anything.** This command produces a package for review. Publishing
is a human step in Business Suite, deliberately — there is no path from this
command to a live post.
