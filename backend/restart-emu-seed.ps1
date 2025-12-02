cd backend ^
&& taskkill /IM node.exe /F >nul 2>&1 ^
&& npm run build ^
&& start "" cmd /C "npm run firebase emulators:start --only functions" ^
&& timeout /t 5 >nul ^
&& node scripts\seed-local.js
