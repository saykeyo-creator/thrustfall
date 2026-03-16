@echo off
setlocal

set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set ANDROID_SDK_ROOT=%ANDROID_HOME%
set PATH=%JAVA_HOME%\bin;%PATH%

echo ============================================
echo  THRUSTFALL DEPLOY (Fly.io + Android)
echo ============================================

:: ---- Auto-increment versionCode in build.gradle ----
echo.
echo [0/4] Incrementing versionCode...
cd /d "C:\Users\Keyos App Development\Thrustfall"
powershell -ExecutionPolicy Bypass -File "increment-version.ps1"
if errorlevel 1 (
    echo ERROR: Failed to increment versionCode.
    pause
    exit /b 1
)

:: ---- Git commit and push ----
echo.
echo [1/4] Committing to GitHub...
cd /d "C:\Users\Keyos App Development\Thrustfall"

git add -A
if "%~1"=="" (
    set /p COMMIT_MSG="Enter commit message: "
) else (
    set COMMIT_MSG=%~1
)
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo Nothing new to commit, continuing...
) else (
    git push origin main
    if errorlevel 1 (
        echo ERROR: Git push failed. Check your connection.
        pause
        exit /b 1
    )
    echo Git push done.
)

:: ---- Deploy server to Fly.io ----
echo.
echo [2/4] Deploying server to Fly.io...
cd /d "C:\Users\Keyos App Development\Thrustfall"
fly deploy
if errorlevel 1 (
    echo ERROR: Fly deploy failed.
    pause
    exit /b 1
)
echo Fly deploy done.

:: ---- Build signed AAB ----
echo.
echo [3/4] Building signed AAB...
cd /d "C:\Users\Keyos App Development\Thrustfall"
node build-mobile.js
if errorlevel 1 (
    echo ERROR: build-mobile.js failed.
    pause
    exit /b 1
)
npx cap sync android
if errorlevel 1 (
    echo ERROR: cap sync failed.
    pause
    exit /b 1
)
cd android
call gradlew.bat clean bundleRelease
if errorlevel 1 (
    echo ERROR: Gradle build failed. See output above.
    pause
    exit /b 1
)
if not exist "app\build\outputs\bundle\release\app-release.aab" (
    echo ERROR: AAB not found after build — unexpected.
    pause
    exit /b 1
)

:: ---- Copy AAB to easy location ----
echo.
echo [4/4] Copying AAB to project root...
copy /Y "app\build\outputs\bundle\release\app-release.aab" "C:\Users\Keyos App Development\Thrustfall\thrustfall-release.aab"
if errorlevel 1 (
    echo ERROR: Failed to copy AAB to project root.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  DONE!
echo  Server: deployed to Fly.io
echo  AAB ready: C:\Users\Keyos App Development\Thrustfall\thrustfall-release.aab
echo  Upload this to Google Play Console.
echo ============================================
pause
