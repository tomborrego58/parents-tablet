# Tablet Setup & Handover Guide

## Part 1: Tom's Final Setup Checklist (10 minutes)

1. **Deploy the Apps Script Web App (one-time):**
   - Open the Apps Script editor (`npx @google/clasp open-script` or from `script.google.com` in the tablet's Google account).
   - Run **`installTriggers`** once (click Run → approve permissions). This turns on:
     - 15-minute missed-dose checks (2-hour delay, quiet hours 9 pm – 8 am)
     - 9:00 pm daily summary email
     - 90-day automatic cleanup
     - 15-minute email-to-Drive photo import
   - Click **Deploy → New deployment → Web app**:
     - Execute as: **Me**
     - Who has access: **Anyone** *(required so both the tablet and Tom's phone can open the link cleanly)*
   - Copy the **Web app URL** and bookmark it on your phone + open it in Chrome on the tablet.

2. **Fill in 3 items in `Edit Meds → Settings` on the web app:**
   - **Drive Photo Folder URL:** Create a folder in Google Drive, share it with the tablet's Google account (Editor), and paste the folder URL into Settings.
   - **Google Meet URLs:** Create two permanent Meet links (at `meet.google.com` → *New meeting → Create a meeting for later*) — one for **Tom**, one for **Katie** — and paste them into Settings.
   - **Optional Text Alerts:** If you want free text messages in addition to emails, enter your carrier's email-to-SMS address (e.g. `1234567890@vtext.com` for Verizon, `@txt.att.net` for AT&T, `@tmomail.net` for T-Mobile).

3. **Tablet Always-On & Screen Pinning (Galaxy Tab A11+):**
   - Keep the tablet plugged into its charger on a stand.
   - **Settings → Developer options → Stay awake** → **On** *(keeps screen on while charging)*.
   - **Settings → Display → Screen timeout** → **30 minutes** (backup).
   - **Settings → Security and privacy → More security settings → Pin app** → **On**.
   - **Google Meet incoming calls:** Add Tom's and Katie's emails to the tablet account's Google Contacts (and add the tablet's Google account to Tom's & Katie's phone Contacts) so Google Meet calls ring through on the tablet.
   - Open Chrome to the Web App URL → tap **Add to Home screen** (opens full-screen without address bar).
   - Tap the **🔊 Tap once to enable sound** button on the photo screen after any tablet restart.
   - Open Recents → tap the app icon → **Pin this app** so Gene & Peggy can't close it by accident.

---

## Part 2: Printable Sheet for Gene & Peggy

> ### How to Use Your Family Tablet
>
> - **Most of the day:** Enjoy family photos!
> - **When it's time for pills:** The screen will switch to your medication lists by itself and play a gentle chime.
> - **Checking off pills:** Tap the **big square box** next to each pill you take. It turns **green ✓**.
>   - *Gene's morning wait:* After your **Wake up** pill, wait **2 hours** before taking Morning pills (the yellow box tells you the exact time).
> - **Snooze:** Need 10 more minutes? Tap **Snooze 10 min** at the top.
> - **Want to see photos?** Tap **Photos** at the bottom.
> - **Calling Tom or Katie:** Tap the green **📞 Call Tom** or **📞 Call Katie** button anytime. It opens video chat and sends them a ping to join.
> - **Changing pill times or meds:** Tap **Edit Meds** at the bottom right (Tom gets an email copy of every change).
>
> *Reminder aid only — always follow your pharmacy labels and doctor's instructions first.*
