'use client';
import { useState } from 'react';
import { Youtube, Download, Sparkles, Loader2, PlayCircle, Film, Music, ShieldAlert } from 'lucide-react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [videoData, setVideoData] = useState(null);
  const [selectedItag, setSelectedItag] = useState('');

  const fetchInfo = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setVideoData(null);
    try {
      const res = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze video');
      setVideoData(data);
      if (data.formats?.length > 0) setSelectedItag(data.formats[0].itag);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!url || !selectedItag || !videoData) return;
    const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&itag=${selectedItag}&title=${encodeURIComponent(videoData.title)}`;
    window.open(downloadUrl, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-4 sm:p-8 bg-slate-950 text-slate-100">
      <header className="w-full max-w-4xl flex items-center justify-between py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 p-2.5 rounded-2xl shadow-lg shadow-red-500/20">
            <Youtube className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">VidFlow</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Next.js App
        </span>
      </header>
      <main className="w-full max-w-3xl my-auto py-12 space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
            Download YouTube Videos in <span className="text-red-500">Any Resolution</span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto">
            Paste your YouTube link below to extract HD video qualities and audio streams.
          </p>
        </div>
        <form onSubmit={fetchInfo} className="relative flex flex-col sm:flex-row gap-2 bg-slate-900 border border-slate-800 p-2 rounded-2xl shadow-2xl">
          <div className="flex-1 flex items-center px-4 gap-3">
            <Youtube className="w-5 h-5 text-slate-500" />
            <input type="text" placeholder="Paste YouTube Video URL here..." value={url} onChange={(e) => setUrl(e.target.value)} className="w-full bg-transparent py-3 text-slate-100 placeholder-slate-500 focus:outline-none text-sm sm:text-base" />
          </div>
          <button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-500 text-white font-semibold px-8 py-3.5 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
            <span>{loading ? 'Analyzing...' : 'Fetch Options'}</span>
          </button>
        </form>
        {error && (
          <div className="flex items-center gap-3 bg-red-950/40 border border-red-800 text-red-300 p-4 rounded-xl text-sm">
            <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {videoData && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
              <img src={videoData.thumbnail} alt={videoData.title} className="w-full sm:w-56 aspect-video object-cover rounded-2xl border border-slate-800" />
              <div className="space-y-2 text-center sm:text-left flex-1">
                <h2 className="text-lg font-bold text-slate-100 line-clamp-2">{videoData.title}</h2>
                <p className="text-xs font-medium text-slate-400">Channel: {videoData.author}</p>
              </div>
            </div>
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Select Format / Resolution</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                {videoData.formats.map((fmt, i) => (
                  <button key={i} type="button" onClick={() => setSelectedItag(fmt.itag)} className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition ${String(fmt.itag) === String(selectedItag) ? 'bg-red-600/10 border-red-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                    <div className="flex items-center gap-2.5">
                      {fmt.hasVideo ? <Film className="w-4 h-4 text-rose-400" /> : <Music className="w-4 h-4 text-emerald-400" />}
                      <span className="text-sm font-semibold">{fmt.qualityLabel}</span>
                    </div>
                    <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">{fmt.container}</span>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleDownload} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition shadow-xl shadow-emerald-600/20">
              <Download className="w-5 h-5" />
              <span>Download Selected File</span>
            </button>
          </div>
        )}
      </main>
      <footer className="w-full max-w-4xl py-6 text-center text-xs text-slate-600 border-t border-slate-800">
        VidFlow Downloader - Next.js 14
      </footer>
    </div>
  );
}
