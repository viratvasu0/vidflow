import { NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';

export async function POST(request) {
  try {
    const { url } = await request.json();
    if (!url || !ytdl.validateURL(url)) {
      return NextResponse.json({ error: 'Please enter a valid YouTube URL.' }, { status: 400 });
    }

    // Pass custom agent options to bypass serverless IP blocks
    const agent = ytdl.createAgent([]);
    const info = await ytdl.getInfo(url, { agent });

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
    console.error('YTDL Fetch Error:', err);
    return NextResponse.json({ error: 'YouTube blocked serverless request. Try again or check URL.' }, { status: 500 });
  }
}
