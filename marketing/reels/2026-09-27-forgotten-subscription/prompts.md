# Flow prompts — 2026-09-27-forgotten-subscription

Five shots, Frames-to-Video throughout — every shot carries brand, UI or text,
so Veo animates the rendered PNG rather than inventing it. No text-to-video
b-roll on this one; the mechanism itself is the visual.

Every prompt appends the subtitle suppressor and the negative prompt per
`references/veo-flow.md`. Do not ask Flow to redraw the wordmark, the card or
the figures — Frames-to-Video means it never has to.

---

### Shot 1 — Hook (≈2s)
**Mode:** Frames-to-Video · **First frame:** `frames/01-hook.png`
**Cut to:** on-screen text "You forgot. It didn't." (baked into the frame already)

```
A phone lies face-up on a dark wooden kitchen bench, screen glowing with the
Mintr hook card. A hand rests beside it, still.
Camera: locked-off, slight handheld drift.
Light: near-black room, single soft mint-green glow from the screen, cool
grey coastal window light falling off to the left.
Ambiance: quiet, slightly uneasy — the moment before you notice something.
Audio: soft room tone, no music.
no subtitles, no captions, no on-screen text, no watermark, no logos
```

**Negative:** text, captions, watermarks, distorted hands, extra fingers, warped faces, cluttered background, oversaturated colours, stock-photo smiling

---

### Shot 2 — Ache (≈4s)
**Mode:** Frames-to-Video · **First frame:** `frames/02-ache.png`
**Cut to:** on-screen text "Buried in a wall of charges"

```
Same kitchen bench, the phone now held loosely in one hand, thumb pausing
mid-scroll over the glowing screen showing the Mintr ache card.
Camera: slow 85mm push in from three-quarter high, shallow depth of field.
Light: near-black room, single soft mint-green practical from the screen,
cool coastal window light.
Ambiance: mild frustration, searching, unhurried documentary.
Audio: quiet room tone, a single soft scroll/tap sound, no music.
no subtitles, no captions, no on-screen text, no watermark, no logos
```

**Negative:** text, captions, watermarks, distorted hands, extra fingers, warped faces, cluttered background, oversaturated colours, stock-photo smiling

---

### Shot 3 — Reveal (≈7s)
**Mode:** Frames-to-Video · **First frame:** `frames/03-reveal.png`
**Cut to:** on-screen text "Groups the charge under one name" + the illustrative card (baked into the frame)

```
The phone screen fills more of the frame, showing the Mintr reveal card with
the recurring-bill detail. A thumb taps once near the card, then lifts.
Camera: slow 50mm push in, locked-off, shallow depth of field.
Light: near-black room, single soft mint-green practical from the screen.
Ambiance: calm, quiet relief — the moment of recognition.
Audio: quiet room tone, a soft single haptic buzz, no music.
no subtitles, no captions, no on-screen text, no watermark, no logos
```

**Negative:** text, captions, watermarks, distorted hands, extra fingers, warped faces, cluttered background, oversaturated colours, stock-photo smiling
**Note:** never ask Flow to render its own version of the card, the merchant
name or the figures — the PNG anchor already carries them correctly, and a
Veo-generated card would be a fabricated claim with the Mintr wordmark on it.

---

### Shot 4 — Proof (≈7s)
**Mode:** Frames-to-Video · **First frame:** `frames/04-proof.png`
**Cut to:** on-screen text "Same biller, steady gap, flagged"

```
Wide-ish shot pulling back slightly from the phone, kitchen bench and window
light visible at the edges, phone screen showing the Mintr proof card.
Camera: slow pull-back, locked-off, shallow depth of field.
Light: near-black room, single soft mint-green practical, cool coastal window
light falling off to the left.
Ambiance: settled, matter-of-fact, unhurried documentary.
Audio: quiet room tone, no music.
no subtitles, no captions, no on-screen text, no watermark, no logos
```

**Negative:** text, captions, watermarks, distorted hands, extra fingers, warped faces, cluttered background, oversaturated colours, stock-photo smiling

---

### Shot 5 — Close (≈4s)
**Mode:** Frames-to-Video · **First frame:** `frames/05-close.png`
**Cut to:** on-screen text "See what's on repeat" + `mintraiq.com/go` (baked into the frame)

```
Phone screen shows the Mintr close card, wordmark centred, held steady in
frame. No hand movement — the frame settles.
Camera: locked-off, no movement.
Light: near-black room, single soft mint-green glow from the screen.
Ambiance: calm, resolved, quiet confidence.
Audio: soft room tone fading to silence, no music.
no subtitles, no captions, no on-screen text, no watermark, no logos
```

**Negative:** text, captions, watermarks, distorted hands, extra fingers, warped faces, cluttered background, oversaturated colours, stock-photo smiling

---

## Assembly (Scenebuilder)

Cut in order 1 → 2 → 3 → 4 → 5, hard cuts (no crossfade — the product is calm,
not slick). Total runtime ≈24s, inside the 20–30s reel target from
`marketing-reel`'s beat sheet. If shot 3 or 4 runs short, use **Extend** rather
than regenerating — the first-frame anchor is what keeps the mint colour and
the card content correct; a fresh generation risks drifting off-brand or
re-inventing the figures on the card.

## When a shot comes back wrong

Per `references/veo-flow.md`: garbled on-screen text means the suppressor was
dropped or a noun referred to text/UI — re-anchor with Frames-to-Video and
strip any wording that names the screen content. Wrong colour means
text-to-video was used somewhere by mistake — every shot here should be
Frames-to-Video, no exceptions.
