import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'Please enter a valid YouTube URL.' }, { status: 400 });
    }

    // Extract 11-character Video ID
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    const videoId = (match && match[2].length === 11) ? match[2] : null;

    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL structure.' }, { status: 400 });
    }

    // List of reliable Piped instances to query for stream metadata
    const instances = [
      'https://pipedapi.kavin.rocks',
      'https://api.piped.privacydev.net',
      'https://pipedapi.lunar.icu'
    ];

    let data = null;
    for (const instance of instances) {
      try {
        const res = await fetch(`${instance}/streams/${videoId}`, { cache: 'no-store' });
        if (res.ok) {
          data = await res.json();
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!data) {
      return NextResponse.json({ error: 'Video streams unavailable right now. Please try again.' }, { status: 500 });
    }

    // Extract available video formats
    const videoStreams = (data.videoStreams || [])
      .filter(s => s.url)
      .map((s, index) => ({
        itag: `piped_${index}`,
        qualityLabel: s.quality || 'Video Stream',
        container: s.format || 'mp4',
        hasVideo: true,
        hasAudio: !s.videoOnly,
        downloadUrl: s.url
      }));

    // Extract available audio streams
    const audioStreams = (data.audioStreams || [])
      .filter(s => s.url)
      .map((s, index) => ({
        itag: `audio_${index}`,
        qualityLabel: `Audio Only (${s.bitrate ? Math.round(s.bitrate / 1000) : 128} kbps)`,
        container: s.format || 'm4a',
        hasVideo: false,
        hasAudio: true,
        downloadUrl: s.url
      }));

    const formats = [...videoStreams, ...audioStreams];

    if (formats.length === 0) {
      return NextResponse.json({ error: 'No downloadable streams found for this video.' }, { status: 500 });
    }

    return NextResponse.json({
      title: data.title || `YouTube Video (${videoId})`,
      thumbnail: data.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: data.duration || 0,
      author: data.uploader || 'YouTube Channel',
      formats
    });
  } catch (err) {
    console.error('Extraction Error:', err);
    return NextResponse.json({ error: 'Failed to process YouTube link. Try another video.' }, { status: 500 });
  }
}
