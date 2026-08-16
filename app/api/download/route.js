import ytdl from '@distube/ytdl-core';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const itag = searchParams.get('itag');
  const title = searchParams.get('title') || 'VidFlow_Video';
  if (!url || !itag) return new Response('Missing parameters', { status: 400 });
  try {
    const info = await ytdl.getInfo(url);
    const format = info.formats.find(f => String(f.itag) === String(itag));
    const cleanTitle = title.replace(/[^a-zA-Z0-9 _-]/g, '') || 'download';
    const ext = format?.container || (format?.hasVideo ? 'mp4' : 'mp3');
    const stream = ytdl(url, { quality: parseInt(itag, 10) });
    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="${cleanTitle}.${ext}"`);
    headers.set('Content-Type', format?.mimeType || 'video/mp4');
    return new Response(stream, { headers });
  } catch (err) {
    return new Response('Download stream failed', { status: 500 });
  }
}
