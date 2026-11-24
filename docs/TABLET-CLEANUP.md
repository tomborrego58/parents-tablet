# Tablet Cleanup Guide (Samsung Galaxy Tab A11+)

No rooting required. Every change here can be undone, and Android security updates keep working.

---

## Part 1: Privacy Settings (on the tablet)

1. **Settings → Security and privacy → More privacy settings**
   - Turn **off** *Send diagnostic data*.
   - Turn **off** *Ads → Delete advertising ID*.
   - Turn **off** *Personalize using shared data* / *Customization Service*.
2. **Settings → Samsung account**
   - Skip signing into a Samsung account (or turn off Samsung Cloud sync & marketing).
3. **Settings → Notifications → App notifications**
   - Turn off notifications for Samsung Store, Game Launcher, Tips, and Weather so nothing pops up over the slideshow.

---

## Part 2: Remove Bloatware with ADB (from your Windows PC)

**ADB** (Android Debug Bridge) is Google's free tool to turn off unwanted pre-installed apps without rooting.

### 1. Turn on USB Debugging on the tablet
1. Open **Settings → About tablet → Software information**.
2. Tap **Build number** 7 times until it says *"Developer mode has been turned on"*.
3. Go back to **Settings → Developer options** and turn **USB debugging** **On**.
4. Plug the tablet into your PC with a USB cable and tap **Allow** on the tablet's *"Allow USB debugging?"* popup.

### 2. Install ADB on Windows
In PowerShell:
```powershell
winget install Google.PlatformTools
```
Verify it sees the tablet:
```powershell
adb devices
```
*(Should list one device ID followed by `device`.)*

### 3. Disable unwanted Samsung, Microsoft & carrier bloatware
Run these safe `pm disable-user` commands (they only hide/disable apps for user 0; nothing is permanently erased and Google Play / Chrome / Meet keep working):

```powershell
# Samsung bloat & adware
adb shell pm disable-user --user 0 com.samsung.android.app.tips
adb shell pm disable-user --user 0 com.samsung.android.bixby.agent
adb shell pm disable-user --user 0 com.samsung.android.app.spage
adb shell pm disable-user --user 0 com.samsung.android.game.gamehome
adb shell pm disable-user --user 0 com.samsung.android.game.gametools
adb shell pm disable-user --user 0 com.samsung.android.aremoji
adb shell pm disable-user --user 0 com.samsung.android.kidsinstaller
adb shell pm disable-user --user 0 com.sec.android.app.samsungapps

# Microsoft / Meta pre-installs (if present; ignore "Unknown package" errors)
adb shell pm disable-user --user 0 com.microsoft.office.officehubrow
adb shell pm disable-user --user 0 com.microsoft.skydrive
adb shell pm disable-user --user 0 com.facebook.katana
adb shell pm disable-user --user 0 com.facebook.system
adb shell pm disable-user --user 0 com.facebook.appmanager
```

*(To re-enable any app later: `adb shell pm enable <package.name>`.)*

### 4. Turn off USB Debugging when finished
Go to **Settings → Developer options → USB debugging → Off**.
