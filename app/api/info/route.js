import { NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';

export async function POST(request) {
  try {
    const { url } = await request.json();
    if (!url || !ytdl.validateURL(url)) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }
    const info = await ytdl.getInfo(url);
    const formats = info.formats
      .filter((f) => f.hasVideo || f.hasAudio)
      .map((f) => ({
        itag: f.itag,
        qualityLabel: f.qualityLabel || (f.hasAudio ? 'Audio Only' : 'Unknown'),
        container: f.container || 'mp4',
        hasVideo: Boolean(f.hasVideo),
        hasAudio: Boolean(f.hasAudio)
      }));
    return NextResponse.json({
      title: info.videoDetails.title,
      thumbnail: info.videoDetails.thumbnails.slice( -1 )[0]?.url,
      duration: parseInt(info.videoDetails.lengthSeconds || '0', 10),
      author: info.videoDetails.author.name,
      formats
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch details' }, { status: 500 });
  }
}
