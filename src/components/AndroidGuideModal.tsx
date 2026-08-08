import React, { useState } from 'react';
import { X, Smartphone, Download, Layers, CheckCircle2, Copy, Check } from 'lucide-react';

interface AndroidGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidGuideModal: React.FC<AndroidGuideModalProps> = ({ isOpen, onClose }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const appUrl = window.location.href;

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const capCommands = `npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init ChatApp com.chatapp.mobile
npm run build
npx cap add android
npx cap sync android
npx cap open android`;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-gray-100">
        {/* Header */}
        <div className="p-4 bg-[#111b21] text-white flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#00a884] rounded-xl text-white">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">ChatApp on Android</h3>
              <p className="text-xs text-gray-300">Run as PWA or build a native Android APK</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-6 text-gray-800 text-sm">
          {/* Method 1: Instant PWA Install */}
          <div className="p-4 bg-[#f0f2f5] border border-gray-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-[#00a884] font-bold">
              <Download className="w-5 h-5 shrink-0" />
              <span>Option 1: Instant PWA Installation (Recommended)</span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              You can instantly install ChatApp on any Android phone without needing Android Studio!
            </p>
            <ol className="list-decimal list-inside text-xs space-y-2 text-gray-700 font-medium">
              <li>Open Google Chrome or Edge on your Android phone.</li>
              <li>
                Navigate to your app URL:{' '}
                <span className="font-mono text-[11px] bg-gray-200 px-1.5 py-0.5 rounded text-gray-900 break-all">
                  {appUrl}
                </span>
              </li>
              <li>Tap the 3 dots menu (<strong className="text-gray-900">⋮</strong>) in the top right.</li>
              <li>Tap <strong className="text-gray-900">"Add to Home Screen"</strong> or <strong className="text-gray-900">"Install app"</strong>.</li>
            </ol>
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Includes standalone full-screen view, WebRTC voice calling, and microphone access.</span>
            </div>
          </div>

          {/* Method 2: Capacitor Native APK */}
          <div className="p-4 bg-[#f0f2f5] border border-gray-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-[#00a884] font-bold">
              <Layers className="w-5 h-5 shrink-0" />
              <span>Option 2: Native Android APK (Capacitor)</span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Convert ChatApp into a native Android Studio project and generate an APK file:
            </p>

            <div className="relative bg-[#111b21] text-emerald-400 p-3 rounded-lg font-mono text-xs overflow-x-auto border border-gray-800">
              <button
                onClick={() => copyToClipboard(capCommands, 1)}
                className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-white bg-gray-800/80 rounded transition-colors flex items-center gap-1 text-[10px]"
                title="Copy Commands"
              >
                {copiedIndex === 1 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedIndex === 1 ? 'Copied' : 'Copy'}</span>
              </button>
              <pre className="pr-12 whitespace-pre-wrap">{capCommands}</pre>
            </div>

            <p className="text-xs text-gray-500">
              Once opened in Android Studio, click <strong>Build &gt; Build APK</strong> to generate the installable <code className="text-gray-800 font-semibold">.apk</code> file for Android devices.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#f0f2f5] border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#00a884] hover:bg-[#008f70] text-white font-semibold rounded-xl text-xs shadow-md transition-all active:scale-95"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};
