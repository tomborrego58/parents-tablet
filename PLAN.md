# Parents' Tablet: Plan

**Source of truth.** Changes need Tom's agreement.

## What it is
A Samsung Galaxy Tab A11+ for **Gene and Peggy** that shows:
1. **Family photos**, as a slideshow.
2. **Today's medications**, a separate list for each of them, with big check boxes and alarms.
3. **Call Tom** buttons that open Google Meet.

Tom gets an **email** when meds are added, changed or deleted, and when a dose hasn't been ticked off in time.

> This is a reminder aid, not a medical device. The pharmacy label and the doctor's instructions always come first.

## How it works
- **Google Apps Script** is free Google code that runs inside the parents' Google account. It acts as the "brain": it serves the screen, stores the meds and sends emails. There's no server to rent and no monthly fee.
- **Storage** uses Apps Script's built-in storage space (PropertiesService), so there's no spreadsheet. It holds the med schedule, the tick-off log and the change history. Anything older than **90 days** is cleared automatically, because the space is small (about 500 KB).
- **One web page** works on both the tablet and Tom's phone.
- **Photos** come from a **Google Drive folder** that Tom adds to from his phone. (Google Photos stopped letting apps read albums in 2025. Drive still works.)
- **Code** lives in this GitHub repository. It's sent to Apps Script with **clasp**, Google's free upload tool that runs on Node.js, which Tom already has. That way GitHub always holds the real copy.

## Medications
- Each person has **time slots**, for example *Wake up*, *Morning*, *With dinner* and *Bedtime*. Each slot has an alarm time and an optional note.
- Each medication has: name (brand name in brackets), strength, how many to take ("4 tablets = 1000 mg"), an optional note ("take after food"), a slot, and whether it's **daily** or **weekly** (with the day for weekly ones).
- **Warning notes** stand out in red, for example the Abiraterone handling warning.
- **Wait timers:** a slot can say "nothing else for 2 hours". After it's ticked, the next slot shows *"Next meds at 9:12"*.
- **Check boxes:** tapping one marks a dose as taken and records the time. Tapping again undoes it.
- **Edit Meds:** a large button opens a simple form with name, dose, person, and slot or time picked with big tap buttons.
  - **No PIN** (Tom's decision, 22 Nov). Anyone using the tablet can edit; every change still emails Tom and has Undo.
  - Deleting asks "Are you sure?" first.
  - Every add, edit and delete emails Tom and is saved in **change history**, with an **Undo** button.
- **Med lists are never stored in GitHub.** They live only in the parents' Google account. Tom (or Claude, from a list Tom gives) enters them through the Edit Meds form.

## Alarms and alerts
- At each slot time, the tablet plays a chime and shows a big banner ("Gene: Morning meds") until the doses are ticked.
- If a slot isn't fully ticked **30 minutes** after its time, Apps Script emails Tom ("Gene hasn't ticked Morning meds"). Gmail on Tom's phone shows it as a notification.
- The tablet stays plugged in with the screen always on, and the app is pinned to the screen so it can't be closed by accident. These are free, built-in Android settings.

## Calling
- **"Call Tom"** buttons show Tom's photo and open Google Meet.
- Tom calls them from his own Meet app as normal, and it rings on the tablet.
- Before building this, Claude will research the most reliable way to make one tap ring Tom's phone (see Open decisions).

## Removing bloatware and spyware
- A step-by-step guide for Tom's PC using **ADB**, Google's free tool for controlling an Android device over USB.
- Unwanted Samsung, Microsoft and carrier apps are switched off. Nothing is "rooted" (hacked open), so security updates keep coming and anything can be switched back on.
- Turn off ad tracking, diagnostics and "Customization Service" in Settings.

## Roadmap (one step at a time, each its own pull request)
Order changed 2026-11-22: step 2 first, then step 1, then 3 to 6.

- [x] **0. Plan agreed** (merged 2026-11-22)
- [ ] **2. Meds screen** ← **IN PROGRESS**
  - [x] Home screen mockups made (`docs/mockups/`). Tom chose **C+A**: photos full screen most of the day, and the screen switches to the meds lists by itself when meds are due, then back to photos once everything is ticked. **No chime** on the switch unless it's part of the normal alarm.
  - [ ] Build: Apps Script backend, today's lists, check boxes, Edit Meds (no PIN), emails, history with undo, 90-day cleanup
- [ ] **1. Tablet cleanup guide:** debloat with ADB and set privacy settings
- [ ] **3. Alarms and missed-dose emails** (talk with Tom first, see "Alarm options" below)
- [ ] **4. Photo slideshow** from the Drive folder
- [ ] **5. Call buttons** (research, then mockups, then build)
- [ ] **6. Tablet setup and handover:** always-on screen, app pinning, a one-page "how to use it" sheet for Gene and Peggy

## Next steps (where to pick up)
1. Build step 2 (meds screen) using layout C+A from `docs/mockups/`.
2. Then step 1 (tablet cleanup guide), then steps 3 to 6.

## Alarm options: discuss with Tom before step 3
Every option must be easy for older adults. Pick the simplest defaults and keep any controls large and obvious.
- **Type:** gentle chime, louder bell, or a spoken message ("Gene, time for your morning pills")?
- **Duration:** ring once, repeat every few minutes until ticked, or stop after a set time?
- **Volume:** fixed loud volume set by the app, or follow the tablet's volume? Should it get louder if ignored?
- **Mute / snooze:** a big "Snooze 10 min" button? A quiet-hours time (for example overnight)? Who can turn it off?
- The switch to the meds screen itself is silent (Tom, 2026-11-22).

## Notes for building step 2
- Tablet: Galaxy Tab A11+, 1920x1200 screen, about **1280x800 in web page units**. Mockups are drawn at that size.
- Gene's med list came from Tom as a PDF (13 Sept 2026). It is **not** in the repo (health data). Ask Tom to re-share it when entering meds. What it needs from the app:
  - four daily slots (Wake up, Morning, With dinner, After 8 pm / bedtime)
  - a **2-hour "nothing else" wait** after the Wake up dose
  - a **red hazardous-handling warning** on one med
  - notes like "empty stomach", "after food", "may take with snack"
  - doses shown as "4 tablets = 1000 mg"
  - one **weekly injection** (not in the pill box)
- Peggy's list: not received yet. Mockups use example meds.
- The mockup files use example names only. Regenerate the pictures with `node docs/mockups/shot.js`.
- Apps Script pages run inside a frame. Browsers only play sound after one tap, so the tablet will need a one-time "Tap to start" after it restarts.
- Fonts must be bundled with the app (Inter is the mockup font; it's free to use).

## Costs
Everything planned is **free**. An optional paid kiosk app (Fully Kiosk Browser, about US$9 once) would only be suggested if the free screen-pinning proves unreliable, and Tom would be asked first.

## Open decisions / extras
- Peggy's medication list (Tom to send).
- Gene's weekly injection: which day of the week?
- Calling: the best way for one tap to ring Tom (a fixed Meet link plus an alert, or opening Meet straight to Tom).
- Missed-dose alert time: 30 minutes OK? (Asked, not answered yet.)
