import ytdl from '@distube/ytdl-core';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const itag = searchParams.get('itag');
  const title = searchParams.get('title') || 'video';

  if (!url || !itag) {
    return new Response('Missing parameters', { status: 400 });
  }

  try {
    const stream = ytdl(url, { quality: parseInt(itag, 10) });
    const sanitized = title.replace(/[^a-zA-Z0-9 _-]/g, '');
    return new Response(stream, {
      headers: {
        'Content-Disposition': `attachment; filename="${sanitized}.mp4"`,
        'Content-Type': 'video/mp4'
      }
    });
  } catch (err) {
    return new Response('Download failed', { status: 500 });
  }
}
