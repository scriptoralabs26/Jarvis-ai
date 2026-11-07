# JARVIS AI — Mobile-first hybrid assistant

JARVIS is a Hindi/English assistant with a mobile-first interface, on-device chat history, optional speech input/output, and a FastAPI cloud backend.

## Current mobile features
- Responsive dark JARVIS interface for Android-sized screens.
- Chat history and session identifier saved in the device browser/app storage (last 100 messages).
- Hindi speech input where the Android WebView/browser supports SpeechRecognition.
- Optional spoken replies using device text-to-speech.
- Backend URL can be set from the gear button in the app.
- Chat history can be cleared from the app.

**Privacy:** chat history is saved locally on the device. Messages typed or spoken and sent to JARVIS are transmitted to the configured backend for an AI response. Do not send private information unless you want the AI service to process it. Phone storage is not uploaded as a whole.

## Build Android APK without a personal computer
The GitHub Actions workflow `.github/workflows/build-android-apk.yml` builds a debug APK on GitHub's hosted runner.

1. Open the repository's **Actions** tab.
2. Select **Build JARVIS Android APK**.
3. Open the latest successful run.
4. Under **Artifacts**, download `JARVIS-AI-debug-APK`.
5. Extract the ZIP and install `app-debug.apk` on Android. Android may ask you to allow installation from that browser/file manager.

The workflow also runs automatically when app or backend source files change on the `jarvis/android-app` branch.

## Deploy the cloud backend
1. Create a Render account and choose **New + → Blueprint**.
2. Connect this GitHub repository and select branch `jarvis/android-app`.
3. Render reads `render.yaml` and creates the `jarvis-ai` web service.
4. In the service's Environment settings, set `OPENAI_API_KEY` to your own API key. Never commit this secret to GitHub or send it in chat.
5. Wait until the service is live. Copy its public HTTPS URL.
6. In the JARVIS app, tap the gear icon and save that URL. The app will then send chat prompts to that backend.

The AI backend requires a separately billed API key. A ChatGPT subscription does not include API usage.

## Local development
### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Project layout
- `frontend/`: React/Vite mobile UI and Capacitor Android wrapper.
- `backend/`: FastAPI chat API.
- `Dockerfile`, `render.yaml`: one-service cloud deployment.
- `.github/workflows/build-android-apk.yml`: cloud APK build.
