import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Music, FileArchive, CheckCircle2, Loader2, X, AlertCircle, Shield, Scale, Info, Trash2, ListFilter, Download } from 'lucide-react';
import JSZip from 'jszip';
import { motion, AnimatePresence } from 'motion/react';
import { aiService } from './lib/aiService';

interface FileStatus {
  file: File;
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  language?: string;
  error?: string;
}

export default function App() {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [modelProgress, setModelProgress] = useState(0);
  const [langModelProgress, setLangModelProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [systemCheck, setSystemCheck] = useState<{
    webAssembly: boolean;
    sharedArrayBuffer: boolean;
    indexedDB: boolean;
  } | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debug log for state changes
  useEffect(() => {
    console.log('Current files in state:', files.length);
  }, [files]);

  // Auto-clear errors
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Perform system check on mount
    setSystemCheck({
      webAssembly: typeof WebAssembly === 'object',
      sharedArrayBuffer: typeof SharedArrayBuffer === 'function',
      indexedDB: !!window.indexedDB
    });

    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [error]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Ultra-safe ID generation
  const generateId = () => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  };

  // Initialize the model
  const initModel = async () => {
    setModelStatus('loading');
    setModelProgress(0);
    setLangModelProgress(0);
    setError(null);

    try {
      const models = await aiService.initModels(
        (p) => setModelProgress(p),
        (p) => setLangModelProgress(p)
      );
      setModelStatus('ready');
      return models;
    } catch (err: any) {
      console.error('Failed to load models:', err);
      setError(`Failed to load AI models: ${err.message || 'Unknown error'}. This usually happens due to network restrictions or temporary service issues.`);
      setModelStatus('error');
      throw err;
    }
  };

  const getAudioContext = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const addFiles = (newFiles: File[]) => {
    console.log('Adding files:', newFiles.length);
    if (newFiles.length === 0) {
      setError('No valid files selected. Please ensure you are selecting audio files.');
      return;
    }
    
    const newFileStatuses: FileStatus[] = newFiles.map(file => ({
      file,
      id: generateId(),
      status: 'pending',
      progress: 0,
    }));
    
    setFiles(prev => {
      const updated = [...prev, ...newFileStatuses];
      console.log('Updated state length:', updated.length);
      return updated;
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Files dropped');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files) as File[];
      addFiles(droppedFiles);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input changed');
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files) as File[];
      console.log('Selected from input:', selectedFiles.length);
      addFiles(selectedFiles);
      e.target.value = ''; 
    } else {
      console.log('No files in input');
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAll = () => {
    if (isProcessing) return;
    setFiles([]);
    setError(null);
  };

  const resetApp = async () => {
    try {
      // Clear state first
      setFiles([]);
      setError(null);
      await aiService.deleteModels();

      // Clear all browser storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Force a hard reload
      window.location.href = window.location.href;
    } catch (e) {
      console.error('Reset failed:', e);
      window.location.reload();
    }
  };

  const deleteModel = async () => {
    try {
      setModelStatus('idle');
      await aiService.deleteModels();
      setModelProgress(0);
      setLangModelProgress(0);
    } catch (e) {
      console.error('Delete failed:', e);
    }
  };

  const stopProcessing = () => {
    setIsStopping(true);
  };

  const processFiles = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'error');
    if (pendingFiles.length === 0) return;
    
    setIsProcessing(true);
    setIsStopping(false);
    setError(null);

    try {
      console.log('Starting processing...');
      const { transcriber, detector } = await initModel();
      
      const audioContext = await getAudioContext();
      
      for (const fileStatus of pendingFiles) {
        if (isStopping) break;

        await new Promise(resolve => setTimeout(resolve, 100));
        setFiles(prev => prev.map(f => f.id === fileStatus.id ? { ...f, status: 'processing', progress: 5 } : f));

        try {
          // Filename Analysis (Pre-AI)
          const fileName = fileStatus.file.name.toLowerCase();
          const hindiKeywords = [
            'hai', 'mein', 'bhi', 'aur', 'tha', 'thi', 'raha', 'rahi', 'rahe', 
            'ka', 'ki', 'ke', 'ko', 'se', 'par', 'toh', 'jo', 'kya', 'kyun', 'kaise', 
            'kab', 'kahan', 'dil', 'pyar', 'ishq', 'zindagi', 'mohabbat', 'khubsurat', 
            'bahut', 'meray', 'mere', 'tujhe', 'mujhko', 'jaan', 'sanam', 'yaar', 'dost', 'zindgi',
            'kaha', 'dhoond', 'laana', 'vadh', 'khoobsurat', 'payalon', 'chan', 'unko',
            'mohabbat', 'apne', 'dekhta', 'apko', 'bachcha', 'kantara'
          ];
          
          const hasHindiScriptInName = /[\u0900-\u097F]/.test(fileName);
          const nameWords = fileName.split(/[^a-z0-9]/);
          const hindiWordsInName = nameWords.filter(w => hindiKeywords.includes(w)).length;
          
          // Yield to UI thread before heavy decoding
          await new Promise(resolve => setTimeout(resolve, 50));
          
          const arrayBuffer = await fileStatus.file.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          setFiles(prev => prev.map(f => f.id === fileStatus.id ? { ...f, progress: 20 } : f));
          await new Promise(resolve => setTimeout(resolve, 50));

          const sampleDuration = 120;
          const startTime = Math.min(60, Math.max(0, audioBuffer.duration / 2 - 60));
          const sampleRate = 16000;
          
          const offlineCtx = new OfflineAudioContext(1, sampleDuration * sampleRate, sampleRate);
          const filter = offlineCtx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.value = 1850;
          filter.Q.value = 0.5;

          const source = offlineCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(filter);
          filter.connect(offlineCtx.destination);
          source.start(0, startTime, sampleDuration);
          
          const renderedBuffer = await offlineCtx.startRendering();
          let audioData = renderedBuffer.getChannelData(0);

          // Normalization
          let maxVal = 0;
          for (let j = 0; j < audioData.length; j++) {
            const abs = Math.abs(audioData[j]);
            if (abs > maxVal) maxVal = abs;
          }
          if (maxVal > 0) {
            for (let j = 0; j < audioData.length; j++) {
              audioData[j] = audioData[j] / maxVal;
            }
          }

          setFiles(prev => prev.map(f => f.id === fileStatus.id ? { ...f, progress: 50 } : f));
          await new Promise(resolve => setTimeout(resolve, 50));

          const result = await transcriber(audioData, {
            chunk_length_s: 30,
            stride_length_s: 5,
            language: null,
            task: 'transcribe',
            return_timestamps: false,
          });

          const transcription = ((result as any).text || '').toLowerCase();
          let detectedLanguage = (result as any).language || 'en';
          
          // Use Text Detection Model for verification if available
          let langModelResult = detectedLanguage;
          if (detector && transcription.trim().length > 10) {
            try {
              const langOutput = await detector(transcription);
              // FastText labels are like 'hin_Deva' or 'eng_Latn'
              const topLabel = langOutput[0].label;
              if (topLabel.includes('hin')) langModelResult = 'hi';
              else if (topLabel.includes('eng')) langModelResult = 'en';
              else langModelResult = topLabel.split('_')[0];
            } catch (e) {
              console.error('Lang detection failed:', e);
            }
          }

          const hasHindiScriptInAudio = /[\u0900-\u097F]/.test(transcription);
          const audioWords = transcription.split(/\s+/);
          const hindiWordsInAudio = audioWords.filter(w => hindiKeywords.includes(w)).length;
          
          // Combined Scoring Logic
          // Priority: 1. Script, 2. Lang Model, 3. Keywords, 4. AI Guess
          let finalLang = detectedLanguage;
          
          if (hasHindiScriptInAudio || hasHindiScriptInName) {
            finalLang = 'hi';
          } else if (langModelResult === 'hi') {
            finalLang = 'hi';
          } else if (hindiWordsInName + hindiWordsInAudio >= 2) {
            finalLang = 'hi';
          } else if (langModelResult !== detectedLanguage) {
            finalLang = langModelResult; // Trust the detector over the transcriber's guess
          }
          
          const isHindi = finalLang === 'hi';
          detectedLanguage = finalLang;

          let langName = 'Unknown';
          if (transcription.trim().length < 5 && !isHindi) {
            langName = 'Instrumental';
          } else {
            try {
              const langMap: Record<string, string> = {
                'hi': 'Hindi', 'en': 'English', 'es': 'Spanish', 'fr': 'French',
                'de': 'German', 'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian',
                'ja': 'Japanese', 'ko': 'Korean', 'zh': 'Chinese', 'ar': 'Arabic',
                'bn': 'Bengali', 'pa': 'Punjabi', 'ta': 'Tamil', 'te': 'Telugu', 'mr': 'Marathi'
              };

              if (langMap[detectedLanguage]) {
                langName = langMap[detectedLanguage];
              } else {
                langName = new Intl.DisplayNames(['en'], { type: 'language' }).of(detectedLanguage) || detectedLanguage;
                langName = langName.charAt(0).toUpperCase() + langName.slice(1);
              }
            } catch (e) {
              langName = detectedLanguage.toUpperCase();
            }
          }

          setFiles(prev => prev.map(f => f.id === fileStatus.id ? { 
            ...f, status: 'completed', progress: 100, language: langName 
          } : f));

        } catch (err: any) {
          console.error(`Error processing ${fileStatus.file.name}:`, err);
          setFiles(prev => prev.map(f => f.id === fileStatus.id ? { 
            ...f, status: 'error', error: err.message || 'Analysis failed'
          } : f));
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (err: any) {
      console.error('Critical processing error:', err);
      setError(prev => prev || `Processing failed: ${err.message || 'Unknown error'}. Try refreshing.`);
    } finally {
      setIsProcessing(false);
      setIsStopping(false);
    }
  };

  const generateZip = async () => {
    const completedFiles = files.filter(f => f.status === 'completed' && f.language);
    if (completedFiles.length === 0) return;

    setIsZipping(true);
    const zip = new JSZip();

    try {
      for (const f of completedFiles) {
        const folder = zip.folder(f.language!);
        if (folder) {
          folder.file(f.file.name, f.file);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `LingoSort_${new Date().getTime()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to generate ZIP file.');
    } finally {
      setIsZipping(false);
    }
  };

  const Modal = ({ title, isOpen, onClose, children }: { title: string, isOpen: boolean, onClose: () => void, children: React.ReactNode }) => (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">{title}</h3>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-slate-600 leading-relaxed space-y-4">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  const completedCount = files.filter(f => f.status === 'completed').length;
  const pendingCount = files.filter(f => f.status === 'pending' || f.status === 'error').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8 text-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center mb-4"
          >
            <img src="logo.svg" alt="LingoSort Logo" className="w-16 h-16 shadow-lg shadow-blue-200 rounded-2xl" />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">LingoSort MP3</h1>
          <p className="text-slate-500 mb-4">Organize 100+ files locally with AI. No data leaves your device.</p>
          
          {deferredPrompt && (
            <button 
              onClick={handleInstall}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-xs font-bold hover:bg-blue-100 transition-colors"
            >
              <Upload className="w-4 h-4" /> Install App for Offline Use
            </button>
          )}
        </header>

        {/* Model Status Card */}
        <div className="mb-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          {systemCheck && modelStatus !== 'ready' && (
            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className={`p-2 rounded-xl border text-[10px] font-bold text-center flex flex-col items-center gap-1 ${systemCheck.webAssembly ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
                <CheckCircle2 className={`w-3 h-3 ${systemCheck.webAssembly ? 'text-emerald-500' : 'text-red-500'}`} />
                WASM {systemCheck.webAssembly ? 'OK' : 'FAIL'}
              </div>
              <div className={`p-2 rounded-xl border text-[10px] font-bold text-center flex flex-col items-center gap-1 ${systemCheck.sharedArrayBuffer ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>
                <CheckCircle2 className={`w-3 h-3 ${systemCheck.sharedArrayBuffer ? 'text-emerald-500' : 'text-amber-500'}`} />
                THREADS {systemCheck.sharedArrayBuffer ? 'OPTIMIZED' : 'LEGACY'}
              </div>
              <div className={`p-2 rounded-xl border text-[10px] font-bold text-center flex flex-col items-center gap-1 ${systemCheck.indexedDB ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
                <CheckCircle2 className={`w-3 h-3 ${systemCheck.indexedDB ? 'text-emerald-500' : 'text-red-500'}`} />
                STORAGE {systemCheck.indexedDB ? 'OK' : 'FAIL'}
              </div>
            </div>
          )}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4">
            <div className="flex items-center gap-3">
              {modelStatus === 'ready' ? (
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
              ) : modelStatus === 'loading' ? (
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
              ) : (
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-slate-400" />
                </div>
              )}
              <div>
                <h3 className="font-bold text-slate-900">
                  {modelStatus === 'ready' ? 'AI Models Ready' : 
                   modelStatus === 'loading' ? 'Downloading AI Models...' : 
                   'AI Models Offline'}
                </h3>
                <p className="text-xs text-slate-500">
                  {modelStatus === 'ready' ? 'Whisper Base & Lang-Detector are loaded for 2-min analysis.' : 
                   modelStatus === 'loading' ? 'Downloading Whisper Base and FastText Detector...' : 
                   'Click below to download the AI models for local analysis.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {modelStatus === 'ready' && (
                <button 
                  onClick={deleteModel}
                  className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-all border border-red-100 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Delete Models
                </button>
              )}
              {modelStatus !== 'ready' && modelStatus !== 'loading' && (
                <button 
                  onClick={initModel}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-100 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Download Models (~152MB)
                </button>
              )}
            </div>
          </div>
          
          {modelStatus === 'loading' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>Whisper Model</span>
                  <span>{Math.round(modelProgress)}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${modelProgress}%` }}
                    className="h-full bg-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>Lang Detector</span>
                  <span>{Math.round(langModelProgress)}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${langModelProgress}%` }}
                    className="h-full bg-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 bg-red-50 border border-red-100 p-4 rounded-xl flex flex-col gap-3 text-red-700"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex justify-end">
              <button 
                onClick={resetApp}
                className="text-xs font-bold bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3 h-3" /> Reset App Cache
              </button>
            </div>
          </motion.div>
        )}

        {/* Dropzone */}
        <div 
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={onDrop}
          className="relative group mb-8"
        >
          <input 
            ref={inputRef}
            type="file" 
            multiple 
            accept="audio/*" 
            onChange={onFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="border-2 border-dashed border-slate-300 group-hover:border-blue-500 group-hover:bg-blue-50/50 transition-all duration-300 rounded-3xl p-10 text-center bg-white shadow-sm">
            <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
              <Upload className="w-7 h-7 text-slate-400 group-hover:text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Drop 100+ Music Files</h3>
            <p className="text-slate-500 text-sm mb-4">or click to browse multiple MP3s</p>
            <button 
              onClick={() => inputRef.current?.click()}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors relative z-20"
            >
              Select Files
            </button>
          </div>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-8">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
              <div className="flex items-center gap-4">
                <h2 className="font-semibold flex items-center gap-2">
                  Queue <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full font-bold">{files.length}</span>
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> {completedCount} Done</span>
                  <span className="flex items-center gap-1"><Loader2 className={`w-3 h-3 ${isProcessing ? 'animate-spin text-blue-500' : ''}`} /> {pendingCount} Pending</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={clearAll}
                  disabled={isProcessing}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  title="Clear All"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                {isProcessing ? (
                  <button 
                    onClick={stopProcessing}
                    disabled={isStopping}
                    className="px-5 py-2 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 disabled:opacity-50 transition-all shadow-md shadow-red-100 flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    {isStopping ? 'Stopping...' : 'Stop Analysis'}
                  </button>
                ) : (
                  <button 
                    onClick={processFiles}
                    disabled={modelStatus === 'loading' || pendingCount === 0}
                    className="px-5 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-100 flex items-center gap-2"
                  >
                    <ListFilter className="w-4 h-4" />
                    Analyze All
                  </button>
                )}
                <button 
                  onClick={generateZip}
                  disabled={isZipping || completedCount === 0}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-emerald-100 flex items-center gap-2"
                >
                  {isZipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4" />}
                  Download ZIP
                </button>
              </div>
            </div>
            
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {files.map((fileStatus) => (
                <div key={fileStatus.id} className="p-3 hover:bg-slate-50 transition-colors flex items-center gap-4">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Music className={`w-4 h-4 ${fileStatus.status === 'completed' ? 'text-emerald-500' : 'text-slate-400'}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-xs truncate pr-4 text-slate-700">{fileStatus.file.name}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {fileStatus.language && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-bold uppercase rounded tracking-wider border border-emerald-100">
                            {fileStatus.language}
                          </span>
                        )}
                        <button 
                          onClick={() => removeFile(fileStatus.id)}
                          disabled={isProcessing}
                          className="text-slate-300 hover:text-red-500 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {fileStatus.status !== 'pending' && (
                      <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                        <motion.div 
                          className={`h-full ${fileStatus.status === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${fileStatus.progress}%` }}
                        />
                      </div>
                    )}
                    {fileStatus.error && <p className="mt-1 text-[9px] text-red-500 font-medium">{fileStatus.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {files.length === 0 && modelStatus !== 'loading' && (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 border-dashed">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-xs font-bold mb-6">
              <Info className="w-4 h-4" />
              Supports 100-200 files in one go
            </div>
            <p className="text-slate-400 text-sm">No files in queue. Drag your music library here.</p>
          </div>
        )}

        {/* Footer Info */}
        <footer className="mt-12 text-center space-y-6">
          <div className="flex items-center justify-center gap-6 text-slate-400">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium">Offline Ready</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs font-medium">Local AI</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-slate-300" />
              <span className="text-xs font-medium">Privacy First</span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button onClick={() => setShowPrivacy(true)} className="text-xs text-slate-400 hover:text-blue-500 underline flex items-center gap-1">
              <Shield className="w-3 h-3" /> Privacy Policy
            </button>
            <button onClick={() => setShowTerms(true)} className="text-xs text-slate-400 hover:text-blue-500 underline flex items-center gap-1">
              <Scale className="w-3 h-3" /> Terms & Conditions
            </button>
            <button onClick={() => setShowCredits(true)} className="text-xs text-slate-400 hover:text-blue-500 underline flex items-center gap-1">
              <Info className="w-3 h-3" /> Credits & License
            </button>
            <button onClick={resetApp} className="text-xs text-slate-400 hover:text-red-500 underline flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Reset App Cache
            </button>
          </div>

          <p className="text-[10px] text-slate-300 max-w-md mx-auto leading-relaxed">
            LingoSort MP3 uses Transformers.js v3. All processing occurs locally. 
            No audio data is uploaded.
          </p>
        </footer>
      </div>

      {/* Privacy Policy Modal */}
      <Modal title="Privacy Policy" isOpen={showPrivacy} onClose={() => setShowPrivacy(false)}>
        <div className="space-y-4 text-sm text-slate-600">
          <p>Your privacy is our top priority. LingoSort MP3 is designed as a <strong>local-first</strong> application. This means your data never leaves your device.</p>
          
          <section>
            <h4 className="font-bold text-slate-900">1. Zero Data Transmission</h4>
            <p>We do not collect, store, or transmit any personal information, audio data, or metadata. All processing, including language detection and ZIP generation, happens entirely within your browser's memory (RAM).</p>
          </section>

          <section>
            <h4 className="font-bold text-slate-900">2. Local Model Storage</h4>
            <p>The AI models are downloaded from Hugging Face and stored in your browser's <strong>IndexedDB</strong>. This allows the app to work offline. You can clear this data at any time using the "Reset App Cache" button.</p>
          </section>

          <section>
            <h4 className="font-bold text-slate-900">3. No Tracking or Analytics</h4>
            <p>We do not use Google Analytics, cookies, or any third-party tracking scripts. Your usage of this tool is completely anonymous and private.</p>
          </section>

          <section>
            <h4 className="font-bold text-slate-900">4. Security</h4>
            <p>Because there is no backend server, there is no database that can be hacked to steal your files. Your files are as secure as your own computer.</p>
          </section>
        </div>
      </Modal>

      {/* Terms & Conditions Modal */}
      <Modal title="Terms & Conditions" isOpen={showTerms} onClose={() => setShowTerms(false)}>
        <div className="space-y-4 text-sm text-slate-600">
          <p>By using LingoSort MP3, you agree to the following legally binding terms:</p>
          
          <section>
            <h4 className="font-bold text-slate-900">1. License & Use</h4>
            <p>We grant you a personal, non-exclusive, non-transferable license to use this tool for organizing your personal audio library. You may not use this tool for any illegal purposes.</p>
          </section>

          <section>
            <h4 className="font-bold text-slate-900">2. Disclaimer of Warranties</h4>
            <p>This tool is provided "AS IS" and "AS AVAILABLE" without any warranties of any kind, express or implied. We do not guarantee that the language detection will be 100% accurate.</p>
          </section>

          <section>
            <h4 className="font-bold text-slate-900">3. Limitation of Liability</h4>
            <p>To the maximum extent permitted by law, the developers shall not be liable for any direct, indirect, incidental, or consequential damages, including but not limited to loss of data, hardware failure, or legal issues arising from the content of your files.</p>
          </section>

          <section>
            <h4 className="font-bold text-slate-900">4. Intellectual Property</h4>
            <p>You retain full ownership of all audio files processed. The software itself is built using open-source components (Whisper, FastText, Transformers.js) which are subject to their own respective licenses (MIT/Apache 2.0).</p>
          </section>

          <section>
            <h4 className="font-bold text-slate-900">5. User Responsibility</h4>
            <p>You are solely responsible for ensuring that your use of this tool complies with your local copyright laws. Do not process files that you do not have the legal right to possess or modify.</p>
          </section>
        </div>
      </Modal>

      {/* Credits & License Modal */}
      <Modal title="Credits & License" isOpen={showCredits} onClose={() => setShowCredits(false)}>
        <p>LingoSort MP3 is built using world-class open-source AI technology. We gratefully acknowledge the following projects:</p>
        
        <div className="space-y-4 mt-4">
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
            <h5 className="font-bold text-blue-900 text-sm">AI Development (Google AI Studio)</h5>
            <p className="text-xs text-blue-700 mt-1">This project was programmed and developed using <strong>Google AI Studio</strong>, based on the original concept and idea by the user.</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <h5 className="font-bold text-slate-900 text-sm">Whisper (OpenAI)</h5>
            <p className="text-xs text-slate-500 mt-1">The primary speech-to-text engine. Released under the <strong>MIT License</strong>. Free for commercial and private use.</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <h5 className="font-bold text-slate-900 text-sm">FastText (Meta AI)</h5>
            <p className="text-xs text-slate-500 mt-1">Used for high-speed language identification. Released under the <strong>MIT/CC-BY-SA</strong> licenses.</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <h5 className="font-bold text-slate-900 text-sm">Transformers.js (Xenova)</h5>
            <p className="text-xs text-slate-500 mt-1">The library that allows these models to run directly in your browser. Released under the <strong>Apache 2.0 License</strong>.</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <h5 className="font-bold text-slate-900 text-sm">Lucide Icons</h5>
            <p className="text-xs text-slate-500 mt-1">Beautiful, consistent icons used throughout the app. Released under the <strong>ISC License</strong>.</p>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 mt-6 italic">
          This application is an independent tool and is not affiliated with OpenAI, Meta, or Hugging Face.
        </p>
      </Modal>
    </div>
  );
}
