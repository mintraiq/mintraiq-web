# Script — 2026-09-27-forgotten-subscription

Pillar `where-it-went`, format `reel`, 5 shots, ≈24s. `prompts.md` runs these
frames through Google Flow.

**The beat:** For someone with a dozen small charges going out of their
account who can't tell which ones are still quietly repeating, Mintr groups
the charge under one merchant name and names the rhythm it repeats on, so they
notice the recurring bill they forgot about.

| Beat | Time | Frame | On-screen |
|---|---|---|---|
| Hook | 0–2s | `01-hook` | `You forgot. It didn't.` |
| Ache | 2–6s | `02-ache` | `Buried in a wall of charges` |
| Reveal | 6–13s | `03-reveal` | `Groups the charge under one name` + illustrative card |
| Proof | 13–20s | `04-proof` | `Same biller, steady gap, flagged` |
| Close | 20–24s | `05-close` | `See what's on repeat` + `mintraiq.com/go` |

## On-screen text and voiceover

On-screen is 3–6 words a frame — most of this plays on mute. Voiceover is a
bonus register, warmer and slightly longer.

1. **Hook (`01-hook`)**
   - On-screen: "You forgot. **It didn't.**"
   - Voiceover: "Somewhere in your bank feed, something's still charging you."
   - Everyday "subscription" language is fine here — that's how the friction
     actually feels to a real person.

2. **Ache (`02-ache`)**
   - On-screen: "Buried in a **wall of charges**"
   - Voiceover: "Fifty lines that all look the same. Nothing on the statement
     says which ones repeat."
   - The usual fix — scrolling your own statement — doesn't scale once a
     charge hides behind a generic merchant code.

3. **Reveal (`03-reveal`)**
   - On-screen: "Groups the charge under **one name**"
   - Voiceover: "Mintr watches for the same biller showing up again and again
     — even a small one — and gives it one name instead of ten."
   - Card shows a constructed example (generic "Streaming service" merchant,
     no real brand, no screenshot) with an `Illustrative example` chip, per
     `claims.md` #5.
   - Switches to "recurring bill" language from here on, matching the
     mechanism rather than either in-app label (see `claims.md` #4).

4. **Proof (`04-proof`)**
   - On-screen: "Same biller, **steady gap**, flagged"
   - Voiceover: "Two charges with a matching rhythm — weekly, fortnightly,
     monthly, yearly — get grouped and named automatically."
   - This is the sourced mechanism from `claims.md` #1–#3: merchant-string
     grouping, the ≥2-occurrence / ≤40%-variance check, and the day-gap
     cadence label.

5. **Close (`05-close`)**
   - On-screen: "See what's **on repeat**"
   - Voiceover: none — wordmark and CTA carry the close.
   - `mintraiq.com/go`, no attribution needed (no third-party data on this
     post).

## Register

Calm and documentary, not urgent. The hook states the friction the viewer
already feels; nothing sells against it. No frame or line tells the viewer to
cancel, switch or act on the charge once found — the verb stays on noticing,
per the claims gate §2 and FMCA Part 6.

## What this post does not do

It does not name a real merchant, does not show a real account, does not
promise a dollar figure as a typical result, and does not recommend cancelling
or switching anything. It says Mintr will show you the recurring bill you
forgot was still there — that's the whole claim.
