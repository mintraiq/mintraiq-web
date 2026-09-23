# WhatsApp templates

Built for **Brevo** → Marketing > Templates > WhatsApp > Create a template.

Brevo's editor has three parts — **Header** (optional), **Body**, **Buttons**
(optional). There is no footer field, so the opt-out line sits at the end of the
body instead. Category is **Marketing** for both (Brevo offers Marketing or
Utility only).

Variables below are written as Meta's `{{1}}`. In Brevo you insert a **contact
attribute** instead — pick `FIRSTNAME` where `{{1}}` appears.

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

Don't want these? Tap "Stop these messages" below.
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

Don't want these? Tap "Stop these messages" below.
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
| Body | 1024 | 494 | 604 |
| Button text | 25 | 15 / 19 | 13 / 19 |
| Template name | 60 (Brevo) | 16 | 26 |

Neither body starts or ends with a variable, and there are no consecutive
variables — both are rejection reasons at review.

## Before you can send these from Brevo

1. **Link a WhatsApp Business account** to Brevo and connect the number. Once
   Meta approves a template, only the number it was submitted under can send it.
2. **Build them inside Brevo.** Templates created directly in your WhatsApp
   Business account cannot be migrated across — Brevo can only send what Brevo
   created.
3. **Get the WABA verified**, otherwise there is a daily sending limit.
4. **Fill the `WHATSAPP` contact attribute.** Brevo will not deliver to a
   contact without it, and MintrAIQ does not collect phone numbers today.
5. **Check NZ in Brevo's supported-countries and pricing list** at the time you
   set this up. Unrelated but worth knowing: Meta suspended marketing templates
   to US numbers from 1 April 2025, so that list does move.
6. Approval is usually minutes, up to 24 hours if a human reviews it. An
   unapproved template cannot be scheduled.

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
