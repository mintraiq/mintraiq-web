# Social profile copy

The bio is the most persistent public representation this product makes. A post
scrolls away; a bio sits on the profile until someone changes it. So it is kept
here, under the same guard as the captions — `npm run test:social-copy` runs
`findViolations` over this file.

It is also here so it is not re-invented. Describing the same thing two ways
across the app, the site and an ad is itself a Fair Trading Act problem, and the
streak mechanic already shipped under two names once.

## Instagram

Chosen 2026-09-20. 100 of the 150 characters available.

```
You didn't overspend. You just weren't looking.
Your AI financial mentor, built in NZ.
↓ Get the app
```

| | |
|---|---|
| Link title | `Get the app` |
| Link URL | `https://mintraiq.com/go?utm_source=instagram&utm_medium=social` |

One link, not three. Instagram allows five but shows only the first prominently,
and `/go` already fans out to iOS, Android and the site.

Bio links are editable on mobile only.

### Why this wording

`AI financial mentor` is the established term — it is on every legal page and in
the store listings. Not a new phrasing, deliberately.

Kept out, and to stay out: **save**, **grow**, **smarter**, **optimise**. Each
moves the verb from understanding your own money toward acting on a financial
product, which is the FMCA Part 6 line.

The `↓` points at the link directly below it in the profile layout. It stops
working if the bio is ever shown without the link block — check before reusing
this text anywhere else.

## Open question for counsel

`mentor` implies guidance, and guidance is the thing Part 6 regulates. This is
not a new exposure — the term is already live across the site, the legal pages
and both store listings — but the bio is the most permanent placement of it, so
it belongs in the same single legal pass as `pillars.md`, not a separate one.

Raised in the same pass: the site meta description currently says *"turn bank
statements into intelligent growth insights."* **Growth** reads as investment
return to a consumer. That is live now and is a stronger claim than anything
here.
