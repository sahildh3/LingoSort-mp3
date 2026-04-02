import { pipeline, env } from '@huggingface/transformers';

// Force local-first behavior
env.allowLocalModels = false;
env.useBrowserCache = true;
// env.useCustomCache = true; // Removed because it requires a custom implementation

export interface AIModels {
  transcriber: any;
  detector: any | null;
}

class AIService {
  private transcriber: any = null;
  private detector: any = null;

  async initModels(
    onWhisperProgress: (p: number) => void,
    onLangProgress: (p: number) => void
  ): Promise<AIModels> {
    if (this.transcriber) {
      return { transcriber: this.transcriber, detector: this.detector };
    }

    try {
      // 1. Load Whisper Model (The main engine)
      if (!this.transcriber) {
        console.log('Loading Whisper Base from local storage/remote...');
        this.transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', {
          device: 'wasm',
          dtype: 'fp32',
          quantized: false,
          progress_callback: (data: any) => {
            if (data.status === 'progress') onWhisperProgress(data.progress);
          },
        } as any);
      }

      // 2. Load Language Detector Model (Optional helper)
      if (!this.detector) {
        console.log('Loading Language Detector...');
        try {
          this.detector = await pipeline('text-classification', 'Xenova/fasttext-language-identification', {
            progress_callback: (data: any) => {
              if (data.status === 'progress') onLangProgress(data.progress);
            },
          } as any);
        } catch (detectorError: any) {
          // If the detector fails (like the Unauthorized error), we don't crash.
          // We just continue with Whisper only.
          console.warn('Language detector failed to load, falling back to Whisper internal detection:', detectorError);
          this.detector = null;
          onLangProgress(100); // Mark as "done" so UI proceeds
        }
      }

      return { transcriber: this.transcriber, detector: this.detector };
    } catch (error: any) {
      console.error('AIService init error:', error);
      throw new Error(`AI Model Download Failed: ${error.message}. Please check your internet connection for the first-time setup.`);
    }
  }

  async deleteModels() {
    this.transcriber = null;
    this.detector = null;
    
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
      }
    }
    
    if ('indexedDB' in window) {
      const dbs = await window.indexedDB.databases?.() || [];
      for (const dbInfo of dbs) {
        if (dbInfo.name) window.indexedDB.deleteDatabase(dbInfo.name);
      }
    }
  }

  get isReady() {
    return !!this.transcriber;
  }
}

export const aiService = new AIService();
