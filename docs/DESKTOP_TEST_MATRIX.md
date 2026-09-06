# Desktop test matrix (V4.1)

Mark a cell only after running it on that OS. This file is a plan, not evidence.

| Step | Windows NSIS | macOS DMG | Linux AppImage | Linux DEB |
| --- | --- | --- | --- | --- |
| Installer file exists and size > 1 MB | | | | |
| SHA-256 matches `SHA256SUMS.txt` | | | | |
| Install / mount / chmod | | | | |
| App launches without `tauri dev` | | | | |
| First-run: empty inventory, add server | | | | |
| Password stored in OS vault (if used) | | | | |
| Host fingerprint prompt | | | | |
| Connect + probe | | | | |
| Dashboard / processes / storage | | | | |
| Disconnect, quit, relaunch, profile remains | | | | |
| Uninstall leaves `kyvon.db` or documents data path | | | | |
| Unsigned Gatekeeper / SmartScreen warning documented | | | | |

SSH negatives (any platform with a test host):

- wrong password
- wrong user
- closed port / timeout
- host-key change refused until Trust

Updater: skip until updater artifacts are enabled.
