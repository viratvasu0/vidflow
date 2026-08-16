'use client';
import { useState } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [data, setData] = useState(null);
  const [selectedItag, setSelectedItag] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchInfo = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const result = await res.json();
    setLoading(false);
    if (res.ok) {
      setData(result);
      if (result.formats.length > 0) setSelectedItag(result.formats[0].itag);
    } else {
      alert(result.error);
    }
  };

  const handleDownload = () => {
    const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&itag=${selectedItag}&title=${encodeURIComponent(data.title)}`;
    window.open(downloadUrl, '_blank');
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1>VidFlow - YouTube Downloader</h1>
      <form onSubmit={fetchInfo}>
        <input type="text" placeholder="Paste YouTube Link" value={url} onChange={(e) => setUrl(e.target.value)} style={{ width: '70%%', padding: '8px' }} />
        <button type="submit" disabled={loading} style={{ padding: '8px 16px', marginLeft: '8px' }}>{loading ? 'Fetching...' : 'Get Resolutions'}</button>
      </form>
      {data && (
        <div style={{ marginTop: '20px' }}>
          <h3>{data.title}</h3>
          <img src={data.thumbnail} alt={data.title} width="300" />
          <div style={{ marginTop: '10px' }}>
            <label>Select Resolution: </label>
            <select value={selectedItag} onChange={(e) => setSelectedItag(e.target.value)}>
              {data.formats.map((f, i) => (
                <option key={i} value={f.itag}>
                  {f.qualityLabel} ({f.container}) {f.hasVideo && f.hasAudio ? '[Video+Audio]' : '[Video Only]'}
                </option>
              ))}
            </select>
          </div>
          <button onClick={handleDownload} style={{ marginTop: '10px', padding: '10px 20px', backgroundColor: 'green', color: 'white', border: 'none' }}>Download</button>
        </div>
      )}
    </div>
  );
}
