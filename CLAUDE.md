# Parents' Tablet

## About the user
- Tom has **no coding experience**. Explain in plain language, define jargon, and make the technical choices and say why.
- Plan first: no development until the step is agreed in `PLAN.md`. Keep a visible checklist.
- For anything visual, show mockups or screenshots first (send with SendUserFile) and let Tom choose.
- When asking Tom to merge, give the full PR link (https://github.com/tomborrego58/parents-tablet/pull/N). He often merges from his phone. Squash-merge.
- Keep replies short. Decisions go in `docs/DECISIONS.md`, one dated line each.

## The project
A Galaxy Tab A11+ for Gene and Peggy (Tom's parents): photo slideshow, daily med lists with alarms, check boxes and missed-dose emails to Tom, and Google Meet call buttons. See `PLAN.md`.
Separate from the family calendar (`tomborrego58/family-calendar`) and Mise. Don't mix them.

## Rules
- Never commit to `main`; one branch + PR per step.
- **No secrets or health data in the repo:** no PINs, emails, Meet links or medication lists. These go in Apps Script properties.
- Big text, big tap targets, high contrast; users are older adults. Keep on-screen wording short and plain.
- Free only; flag anything that costs money first. Never root the tablet.
- Build only the current roadmap step; new ideas go in PLAN.md "Open decisions / extras".
