import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'Please enter a valid YouTube URL.' }, { status: 400 });
    }

    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    const videoId = (match && match[2].length === 11) ? match[2] : null;

    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL structure.' }, { status: 400 });
    }

    // Reliable Invidious public API instances
    const invidiousInstances = [
      'https://invidious.nerdvpn.de',
      'https://inv.tux.restaurant',
      'https://invidious.drgns.space',
      'https://invidious.projectsegfau.lt'
    ];

    let streamData = null;
    for (const instance of invidiousInstances) {
      try {
        const res = await fetch(`${instance}/api/v1/videos/${videoId}`, { 
          headers: { 'User-Agent': 'Mozilla/5.0' },
          cache: 'no-store'
        });
        if (res.ok) {
          streamData = await res.json();
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // Fallback: Fetch basic video details via YouTube oEmbed if Invidious instances are busy
    if (!streamData) {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        return NextResponse.json({
          title: oembedData.title,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          duration: 0,
          author: oembedData.author_name,
          formats: [
            {
              itag: 'direct_stream',
              qualityLabel: 'HD Video Stream (Direct)',
              container: 'mp4',
              hasVideo: true,
              hasAudio: true,
              downloadUrl: `https://yewtu.be/latest_version?id=${videoId}&itag=22`
            }
          ]
        });
      }
      return NextResponse.json({ error: 'Video streams unavailable right now. Please try again.' }, { status: 500 });
    }

    // Map Invidious streams
    const formats = (streamData.adaptiveFormats || [])
      .filter(f => f.url)
      .map((f, idx) => ({
        itag: `inv_${idx}`,
        qualityLabel: f.qualityLabel || (f.type?.includes('audio') ? `Audio Only (${Math.round((f.bitrate || 128000) / 1000)} kbps)` : 'Standard Quality'),
        container: f.container || 'mp4',
        hasVideo: Boolean(f.type?.includes('video')),
        hasAudio: Boolean(f.type?.includes('audio')),
        downloadUrl: f.url
      }));

    return NextResponse.json({
      title: streamData.title || `YouTube Video (${videoId})`,
      thumbnail: streamData.videoThumbnails?.find(t => t.quality === 'high')?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: streamData.lengthSeconds || 0,
      author: streamData.author || 'YouTube Content',
      formats: formats.length > 0 ? formats : [
        {
          itag: 'fallback_stream',
          qualityLabel: 'Best Available HD Stream',
          container: 'mp4',
          hasVideo: true,
          hasAudio: true,
          downloadUrl: `https://yewtu.be/latest_version?id=${videoId}&itag=22`
        }
      ]
    });
  } catch (err) {
    console.error('Extraction Error:', err);
    return NextResponse.json({ error: 'Failed to process YouTube link. Try another video.' }, { status: 500 });
  }
}
