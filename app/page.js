'use client';
import { useState } from 'react';
import { Youtube, Download, Sparkles, Loader2, PlayCircle, Film, ShieldAlert } from 'lucide-react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [videoData, setVideoData] = useState(null);

  const fetchInfo = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true); setError(''); setVideoData(null);
    try {
      const res = await fetch('/api/info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze video');
      setVideoData(data);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleDownload = () => {
    if (!videoData?.formats?.[0]?.downloadUrl) return;
    window.open(videoData.formats[0].downloadUrl, '_blank');
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-between p-4 sm:p-8 overflow-hidden bg-slate-950 text-slate-100">
      <header className="w-full max-w-4xl flex items-center justify-between py-4 z-10 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-red-600 to-rose-500 p-2.5 rounded-2xl shadow-lg shadow-red-500/20">
            <Youtube className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">VidFlow</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Pro UI Enabled
        </span>
      </header>

      <main className="w-full max-w-3xl my-auto py-12 space-y-8 z-10">
        <div className="text-center space-y-4">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
            Download YouTube Videos in <span className="bg-gradient-to-r from-red-500 via-rose-400 to-amber-400 bg-clip-text text-transparent">Any Resolution</span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto">Paste your YouTube link below to extract HD video qualities instantly.</p>
        </div>

        <form onSubmit={fetchInfo} className="relative group">
          <div className="relative flex flex-col sm:flex-row gap-2 bg-slate-900/90 border border-slate-800 p-2 rounded-2xl backdrop-blur-xl shadow-2xl">
            <div className="flex-1 flex items-center px-4 gap-3">
              <Youtube className="w-5 h-5 text-slate-500" />
              <input type="text" placeholder="Paste YouTube Video URL here..." value={url} onChange={(e) => setUrl(e.target.value)} className="w-full bg-transparent py-3 text-slate-100 placeholder-slate-500 focus:outline-none text-sm sm:text-base" />
            </div>
            <button type="submit" disabled={loading} className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold px-8 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 shadow-lg shadow-red-600/30">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
              <span>{loading ? 'Analyzing...' : 'Fetch Options'}</span>
            </button>
          </div>
        </form>

        {error && (
          <div className="flex items-center gap-3 bg-red-950/40 border border-red-800/80 text-red-300 p-4 rounded-xl backdrop-blur-md text-sm">
            <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {videoData && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
              <img src={videoData.thumbnail} alt={videoData.title} className="w-full sm:w-56 aspect-video object-cover rounded-2xl shadow-lg border border-slate-800" />
              <div className="space-y-2 text-center sm:text-left flex-1">
                <h2 className="text-lg font-bold text-slate-100 line-clamp-2">{videoData.title}</h2>
                <p className="text-xs font-medium text-slate-400">Stream Source Ready</p>
              </div>
            </div>

            <button onClick={handleDownload} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition shadow-xl shadow-emerald-600/20">
              <Download className="w-5 h-5" />
              <span>Download HD File</span>
            </button>
          </div>
        )}
      </main>

      <footer className="w-full max-w-4xl py-6 text-center text-xs text-slate-600 border-t border-slate-800/50 z-10">VidFlow Downloader — Next.js 14 App Router</footer>
    </div>
  );
}
