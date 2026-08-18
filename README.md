#  README preserved for firmware-only branch

This branch keeps only the ESP32 firmware and CI configuration for automated builds.

Kept:
- StairsEsp/ (firmware source)
- platformio.ini
- .github/workflows/ (CI)
- flash_windows.bat
- terminal.bat
- README.md (this file)
- CHANGELOG.md
- LICENSE
- .gitignore
- version.json
- StairsEsp/config.h

Removed frontend/web UI and related files: src/, package.json, tsconfig.json, vite.config.ts, bun.lock, index.html, assets/, metadata.json
