# Flow / Veo prompts — receipt-scan
Reel 9:16 · 5 shots · ~28s assembled in Scenebuilder

**Every shot carrying text, UI, a number or the wordmark uses Frames-to-Video
with the rendered PNG as the first frame.** Veo animates the composition that
was already checked against the claims gate, instead of guessing at it. Only
shot 2b is text-free and may be generated from a text prompt.

Confirm your Flow build's per-clip length cap before generating — if clips are
shorter than the beat, generate the shot and use **Extend** rather than
re-prompting at a longer duration.

---

## Shot 1 — Hook (0–2s)
**Mode:** Frames-to-Video · **First frame:** `frames/01-hook.png`

```
Subject: a large green currency figure and a short white headline, already composed in frame.
Action: the frame breathes — an almost imperceptible push in, nothing else moves.
Camera: locked-off, 2% slow push in.
Composition & light: flat graphic composition on a near-black navy ground, faint green and blue ambient bloom in opposite corners.
Ambiance: still, deadpan, a held beat.
Audio: room tone only, one soft low sub hit on the first frame, no music.
no subtitles, no captions, no on-screen text, no watermark, no logos
```

> Keep the push tiny. The joke is that nothing happens while the number sits there.

## Shot 2 — Ache (2–7s)
**Mode:** Frames-to-Video · **First frame:** `frames/02-ache.png`

```
Subject: a long monospace list of grocery line items on a dark card, fading out at the bottom.
Action: the list scrolls slowly upward, endlessly, never reaching a total.
Camera: locked-off.
Composition & light: low-key, dark teal ambient, soft vignette.
Ambiance: tedious, faintly hopeless.
Audio: room tone, a dry paper rustle, no music.
Speaker (warm, calm, mid-30s New Zealand accent): "You know the total. You don't know the shop."
no subtitles, no captions, no on-screen text, no watermark, no logos
```

## Shot 2b — optional b-roll cutaway (~1.5s)
**Mode:** Text-to-Video — the only text-free shot. Use it between 2 and 3 if the
edit needs air.

```
Subject: a crumpled supermarket receipt on a dark kitchen bench, no readable text.
Action: a hand drops car keys beside it and leaves frame.
Camera: 85mm macro, shallow depth of field, handheld drift.
Composition & light: single warm practical from the left, deep shadow, dark teal ambient fill.
Ambiance: end of a long day, quiet.
Audio: keys landing on a hard bench, distant fridge hum, no music.
no subtitles, no captions, no on-screen text, no watermark, no logos
```

> The receipt must stay unreadable. If the generation produces legible line items
> or a store name, discard it — Veo invents both, and an invented retailer name
> on an invented receipt is the exact problem the frames were corrected for.

## Shot 3 — Reveal (7–14s)
**Mode:** Frames-to-Video · **First frame:** `frames/03-scan.png`

```
Subject: a phone held steady, its screen showing a camera viewfinder framing a paper receipt inside green corner brackets.
Action: the green scan line sweeps once down the receipt and the corner brackets pulse as it locks on.
Camera: locked-off, very slight handheld drift.
Composition & light: dark navy ground, green key light spilling from the screen.
Ambiance: precise, quietly satisfying.
Audio: a single soft confirmation chime and one haptic buzz, no music.
Speaker (warm, calm, mid-30s New Zealand accent): "Point your phone at it. That's the job."
no subtitles, no captions, no on-screen text, no watermark, no logos
```

> **Do not let Veo redraw the screen contents.** If the generation alters the
> receipt text, the category names or the tab bar, discard it and regenerate with
> a shorter action. The UI is rendered, never generated.

## Shot 4 — Proof (14–23s)
**Mode:** Frames-to-Video · **First frame:** `frames/04-sorted.png`

```
Subject: a phone screen showing five labelled category rows with coloured progress bars.
Action: the five bars fill left to right in quick succession, top row first.
Camera: locked-off, 3% push in.
Composition & light: dark navy ground, soft green bloom behind the phone.
Ambiance: resolved, orderly.
Audio: five soft ticks as the bars land, then room tone, no music.
Speaker (warm, calm, mid-30s New Zealand accent): "Every line read and sorted. You typed nothing."
no subtitles, no captions, no on-screen text, no watermark, no logos
```

> The amounts and category names must not change between the first frame and the
> last. They are illustrative figures carrying a chip; a Veo-altered number is an
> unsourced figure.

## Shot 5 — Close (23–28s)
**Mode:** Frames-to-Video · **First frame:** `frames/05-close.png`

```
Subject: a wordmark, a short headline and a green pill button, already composed in frame.
Action: hold. A slow green-to-blue ambient drift crosses behind, the same direction as the leaf split.
Camera: locked-off.
Composition & light: near-black navy, low ambient bloom.
Ambiance: calm, resolved, confident.
Audio: one soft low resolve tone, no music.
no subtitles, no captions, no on-screen text, no watermark, no logos
```

> **Never let Veo redraw the wordmark.** If the letterforms shift at all, discard
> the generation. Compositing the PNG back over the clip in post is the fallback.

---

## Assembly

Scenebuilder, in order: 1 · 2 · (2b) · 3 · 4 · 5.

All on-screen words come from the rendered PNGs, never from Veo. If a claim
changes, re-render the frame and re-cut — that is the whole reason nothing is
burned in by the model.
