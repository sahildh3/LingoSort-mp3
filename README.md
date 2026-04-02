# 🎵 LingoSort MP3

**LingoSort MP3** is a professional, local-first web application designed to automatically organize large music libraries by language using state-of-the-art AI. 

Built with privacy and performance in mind, all audio processing happens **entirely in your browser**. No audio data is ever uploaded to a server.

---

## 🚀 Key Features

- **Local AI Processing**: Uses OpenAI's Whisper and Meta's FastText models running locally via Transformers.js.
- **Privacy First**: Zero data transmission. Your music stays on your device.
- **Batch Organization**: Supports processing 100-200+ files in a single session.
- **Smart Sorting**: Automatically detects languages (English, Hindi, etc.) and prepares a structured ZIP for download.
- **PWA Support**: Installable on Desktop and Mobile for a native app experience.
- **Offline Ready**: Once models are cached, the app works without an internet connection.
- **System Health Dashboard**: Real-time checks for WebAssembly, Multi-threading, and Storage support.

---

## 🧠 How It Works

LingoSort MP3 leverages the power of **WebAssembly (WASM)** to run heavy AI models directly in the browser:

1.  **Audio Decoding**: The app uses the Web Audio API to decode your MP3 files into raw waveforms.
2.  **Language Detection**: 
    -   **Primary**: A quantized version of **OpenAI's Whisper** listens to the first few seconds of each track.
    -   **Secondary**: **Meta's FastText** provides high-speed language identification as a backup/helper.
3.  **Local Storage**: Models are downloaded once (~150MB) and stored in your browser's **IndexedDB** using the Cache API.
4.  **ZIP Generation**: Once sorted, the app uses **JSZip** to bundle your files into language-specific folders.

---

## 🛠️ Installation & Setup

### For Users
Simply visit the [Live App](https://ais-dev-dlxcwn36p6bpwalpdyodxh-659025496222.asia-east1.run.app) and click "Download Models" to begin.

### For Developers
If you want to run this project locally:

1.  **Clone the repo**:
    ```bash
    git clone https://github.com/yourusername/lingosort-mp3.git
    cd lingosort-mp3
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Run the development server**:
    ```bash
    npm run dev
    ```

4.  **Build for production**:
    ```bash
    npm run build
    ```

---

## 📜 Credits & Licensing

This project is a collaborative effort between human creativity and artificial intelligence.

### AI Development
- **Programmed By**: Google AI Studio
- **Concept & Idea**: [User]

### Open Source AI Models
- **Whisper (OpenAI)**: [MIT License](https://github.com/openai/whisper/blob/main/LICENSE)
- **FastText (Meta AI)**: [MIT/CC-BY-SA](https://github.com/facebookresearch/fastText/blob/main/LICENSE)
- **Transformers.js (Xenova)**: [Apache 2.0 License](https://github.com/xenova/transformers.js/blob/main/LICENSE)

### Libraries & Assets
- **React & Vite**: Frontend framework and build tool.
- **Lucide React**: Icon library ([ISC License](https://github.com/lucide-icons/lucide/blob/main/LICENSE)).
- **Tailwind CSS**: Styling framework.
- **JSZip**: ZIP compression library.

---

## 🛡️ Privacy & Security

LingoSort MP3 is a **Serverless Application**. 
- **No Database**: We don't store your file names or contents.
- **No Analytics**: No tracking scripts (Google Analytics, Mixpanel, etc.).
- **No Cookies**: We use standard browser storage solely for AI model caching.

---

## ⚖️ License

This project is licensed under the **MIT License**. See the [LICENSE](./LICENSE) file for details.
