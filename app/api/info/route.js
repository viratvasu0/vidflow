import { NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';

export async function POST(request) {
  try {
    const { url } = await request.json();
    if (!url || !ytdl.validateURL(url)) {
      return NextResponse.json({ error: 'Please enter a valid YouTube URL.' }, { status: 400 });
    }

    const info = await ytdl.getInfo(url, {
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }
    });

    const formats = info.formats
      .filter(f => f.hasVideo || f.hasAudio)
      .map(f => ({
        itag: f.itag,
        qualityLabel: f.qualityLabel || (f.hasAudio && !f.hasVideo ? `Audio Only (${f.audioBitrate || 128}kbps)` : 'Standard Quality'),
        container: f.container || 'mp4',
        hasVideo: Boolean(f.hasVideo),
        hasAudio: Boolean(f.hasAudio)
      }));

    return NextResponse.json({
      title: info.videoDetails.title,
      thumbnail: info.videoDetails.thumbnails.slice(-1)[0]?.url || '',
      duration: parseInt(info.videoDetails.lengthSeconds || '0', 10),
      author: info.videoDetails.author.name,
      formats
    });
  } catch (err) {
    console.error('YTDL Error:', err);
    return NextResponse.json({ error: 'Failed to extract video details. Try another link.' }, { status: 500 });
  }
}
