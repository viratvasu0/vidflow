const fs = require('fs');
const path = require('path');

const files = {
  'vercel.json': `{
  "framework": "nextjs"
}`,

  'package.json': `{
  "name": "vidflow",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@distube/ytdl-core": "^4.15.8",
    "lucide-react": "^0.427.0",
    "next": "^14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.10"
  }
}`,

  'tailwind.config.js': `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};`,

  'postcss.config.js': `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`,

  'next.config.mjs': `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};
export default nextConfig;`,

  'app/globals.css': `@tailwind base;
@tailwind components;
@tailwind utilities;

@keyframes pulse-slow {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
}

.animate-pulse-slow {
  animation: pulse-slow 6s infinite ease-in-out;
}`,

  'app/layout.js': `import './globals.css';

export const metadata = {
  title: 'VidFlow — Next-Gen YouTube Downloader',
  description: 'Download YouTube videos seamlessly in any resolution.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-red-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}`,

  'app/api/info/route.js': `import { NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';

export async function POST(request) {
  try {
    const { url } = await request.json();

    if (!url || !ytdl.validateURL(url)) {
      return NextResponse.json(
        { error: 'Please enter a valid YouTube video URL.' },
        { status: 400 }
      );
    }

    const info = await ytdl.getInfo(url);
    const formats = info.formats
      .filter((f) => f.hasVideo || f.hasAudio)
      .map((f) => ({
        itag: f.itag,
        qualityLabel: f.qualityLabel || (f.hasAudio && !f.hasVideo ? 'Audio Only (' + (f.audioBitrate || 128) + 'kbps)' : 'Standard Quality'),
        container: f.container || 'mp4',
        hasVideo: Boolean(f.hasVideo),
        hasAudio: Boolean(f.hasAudio),
        mimeType: f.mimeType || '',
      }));

    return NextResponse.json({
      title: info.videoDetails.title,
      thumbnail: info.videoDetails.thumbnails.slice(-1)[0]?.url || '',
      duration: parseInt(info.videoDetails.lengthSeconds || '0', 10),
      author: info.videoDetails.author.name,
      formats,
    });
  } catch (err) {
    console.error('Info API Error:', err);
    return NextResponse.json(
      { error: 'Failed to extract video details. Check video privacy or try another link.' },
      { status: 500 }
    );
  }
}`,

  'app/api/download/route.js': `import ytdl from '@distube/ytdl-core';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const itag = searchParams.get('itag');
  const title = searchParams.get('title') || 'VidFlow_Video';

  if (!url || !itag) {
    return new Response('Missing URL or Format ITAG', { status: 400 });
  }

  try {
    const info = await ytdl.getInfo(url);
    const format = info.formats.find((f) => String(f.itag) === String(itag));
    const cleanTitle = title.replace(/[^a-zA-Z0-9 _-]/g, '') || 'download';
    const ext = format?.container || (format?.hasVideo ? 'mp4' : 'mp3');

    const stream = ytdl(url, { quality: parseInt(itag, 10) });

    const headers = new Headers();
    headers.set('Content-Disposition', \`attachment; filename="\${cleanTitle}.\${ext}"\`);
    headers.set('Content-Type', format?.mimeType || 'video/mp4');

    return new Response(stream, { headers });
  } catch (error) {
    console.error('Download Stream Error:', error);
    return new Response('Failed to initiate video stream', { status: 500 });
  }
}`,

  'app/page.js': `'use client';

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
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze video');

      setVideoData(data);
      if (data.formats?.length > 0) {
        setSelectedItag(data.formats[0].itag);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!url || !selectedItag || !videoData) return;
    const downloadUrl = \`/api/download?url=\${encodeURIComponent(url)}&itag=\${selectedItag}&title=\${encodeURIComponent(videoData.title)}\`;
    window.open(downloadUrl, '_blank');
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return \`\${m}:\${s < 10 ? '0' : ''}\${s}\`;
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-between p-4 sm:p-8 overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-600/20 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />

      <header className="w-full max-w-4xl flex items-center justify-between py-4 z-10 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-red-600 to-rose-500 p-2.5 rounded-2xl shadow-lg shadow-red-500/20">
            <Youtube className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            VidFlow
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Vercel Ready
        </span>
      </header>

      <main className="w-full max-w-3xl my-auto py-12 space-y-8 z-10">
        <div className="text-center space-y-4">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
            Download YouTube Videos in{' '}
            <span className="bg-gradient-to-r from-red-500 via-rose-400 to-amber-400 bg-clip-text text-transparent">
              Any Resolution
            </span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto">
            Paste your YouTube link below to extract HD video qualities and audio streams instantly.
          </p>
        </div>

        <form onSubmit={fetchInfo} className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-rose-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
          <div className="relative flex flex-col sm:flex-row gap-2 bg-slate-900/90 border border-slate-800 p-2 rounded-2xl backdrop-blur-xl shadow-2xl">
            <div className="flex-1 flex items-center px-4 gap-3">
              <Youtube className="w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="Paste YouTube Video URL here..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-transparent py-3 text-slate-100 placeholder-slate-500 focus:outline-none text-sm sm:text-base"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold px-8 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 shadow-lg shadow-red-600/30"
            >
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
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
              <div className="relative group rounded-2xl overflow-hidden shadow-lg border border-slate-800 flex-shrink-0 w-full sm:w-56">
                <img src={videoData.thumbnail} alt={videoData.title} className="w-full aspect-video object-cover" />
                <span className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md px-2 py-1 rounded-md text-xs font-medium text-slate-200">
                  {formatTime(videoData.duration)}
                </span>
              </div>
              <div className="space-y-2 text-center sm:text-left flex-1">
                <h2 className="text-lg font-bold text-slate-100 line-clamp-2 leading-snug">{videoData.title}</h2>
                <p className="text-xs font-medium text-slate-400">Channel: {videoData.author}</p>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-800">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Select Resolution / Stream Format
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                {videoData.formats.map((fmt, i) => {
                  const isSelected = String(fmt.itag) === String(selectedItag);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedItag(fmt.itag)}
                      className={\`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all duration-200 \${
                        isSelected
                          ? 'bg-red-600/10 border-red-500 text-white shadow-md shadow-red-500/10'
                          : 'bg-slate-950/50 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }\`}
                    >
                      <div className="flex items-center gap-2.5">
                        {fmt.hasVideo ? <Film className="w-4 h-4 text-rose-400" /> : <Music className="w-4 h-4 text-emerald-400" />}
                        <span className="text-sm font-semibold">{fmt.qualityLabel}</span>
                      </div>
                      <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {fmt.container}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleDownload}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition shadow-xl shadow-emerald-600/20"
            >
              <Download className="w-5 h-5" />
              <span>Download Selected File</span>
            </button>
          </div>
        )}
      </main>

      <footer className="w-full max-w-4xl py-6 text-center text-xs text-slate-600 border-t border-slate-800/50 z-10">
        VidFlow Downloader — Next.js 14 App Router
      </footer>
    </div>
  );
}
`
};

Object.entries(files).forEach(([filepath, content]) => {
  const fullPath = path.join(process.cwd(), filepath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trim(), 'utf8');
  console.log('Created:', filepath);
});

console.log('SUCCESS: Structure created successfully!');