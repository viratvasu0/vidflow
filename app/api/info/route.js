import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'Please enter a valid YouTube URL.' }, { status: 400 });
    }

    // Extract Video ID
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    const videoId = (match && match[2].length === 11) ? match[2] : null;

    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL structure.' }, { status: 400 });
    }

    // Request stream data via public proxy API
    const response = await fetch(`https://api.cobalt.tools/api/json`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        videoQuality: 'max'
      })
    });

    const data = await response.json();

    if (data.status === 'error' || data.status === 'picker') {
      throw new Error(data.text || 'Extraction failed');
    }

    // Build standard format response
    return NextResponse.json({
      title: `YouTube Video (${videoId})`,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: 0,
      author: 'YouTube Content',
      formats: [
        {
          itag: 'cobalt_video',
          qualityLabel: 'Best Quality Available (HD)',
          container: 'mp4',
          hasVideo: true,
          hasAudio: true,
          downloadUrl: data.url
        }
      ]
    });
  } catch (err) {
    console.error('Extraction Error:', err);
    return NextResponse.json({ error: 'Unable to process video link right now. Please verify the URL.' }, { status: 500 });
  }
}
