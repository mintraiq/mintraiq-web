# WhatsApp templates

Meta Business Message Template format — paste into WhatsApp Manager for approval.
Variables are `{{1}}`; a sample is required at submission.

---

## 1 · Survey invite

**Name** `survey_invite_v1` · **Category** MARKETING · **Language** en

**Header** (TEXT)
```
Two minutes, and it shapes what we build
```

**Body**
```
Hi {{1}}, it's Ram from MintrAIQ.

You're using a product that's still being built, and the survey is where you get to push it around. It asks how you actually manage money right now — what you track, what you gave up on, what you wish existed.

About two minutes, and no question about your balances or your bank.

Your answers decide what we build next. That's not a figure of speech — the last three things we shipped came straight off it.
```

**Footer**
```
Reply STOP to stop these messages
```

**Buttons**
| Type | Text | Action |
|---|---|---|
| URL | `Take the survey` | `https://survey.mintraiq.com` |
| QUICK_REPLY | `Stop these messages` | — |

**Sample** `{{1}}` = `Sarah`

---

## 2 · Categorisation feedback

**Name** `categorisation_feedback_v1` · **Category** MARKETING · **Language** en

**Header** (TEXT)
```
The categories it gets wrong
```

**Body**
```
Hi {{1}}, it's Ram from MintrAIQ.

MintrAIQ sorts your transactions into categories on its own, and it doesn't always get it right — NZ merchant names are messy and it has to guess.

When you correct one in the app, we keep the corrected description and the category you chose. Nothing that identifies you goes with it: card and reference numbers are stripped, and your account ID isn't stored alongside it.

If you've got five minutes, going through a month and fixing what's wrong is the single most useful thing you can do for the product right now.
```

**Footer**
```
Reply STOP to stop these messages
```

**Buttons**
| Type | Text | Action |
|---|---|---|
| URL | `Open MintrAIQ` | `https://mintraiq.com/go` |
| QUICK_REPLY | `Stop these messages` | — |

**Sample** `{{1}}` = `Sarah`

---

## Counts

| | Meta max | 1 | 2 |
|---|---|---|---|
| Header | 60 | 40 | 28 |
| Body | 1024 | 442 | 552 |
| Footer | 60 | 33 | 33 |
| Button text | 25 | 15 / 19 | 13 / 19 |

Neither body starts or ends with a variable, and there are no consecutive
variables — both are rejection reasons at review.

## Two things that are deliberate

**Template 2 says the correction is *kept*, not that it retrains anything.**
Whether a correction feeds a retrain is unverified — `saveTransactionCategory.ts`
PATCHes the category and returns, and no retrain endpoint appears in
`docs/openapi.json`. What the copy claims is the Privacy Policy's own wording
(section 2). Add a training claim only once that is established.

**Neither template makes a data-sharing, encryption, model-training or savings
claim**, and neither shows a figure about the recipient. Those omissions are
what `scripts/social-copy-rules.mjs` exists to enforce; run it against the
template text rather than trusting this paragraph.

> Checked: the gate passes over the sendable header/body/footer of both
> templates. Note it scans whole files, so quoting a blocked phrase *here* —
> even to say the copy avoids it — fails the file. That is why this section
> describes the omissions instead of naming them.
