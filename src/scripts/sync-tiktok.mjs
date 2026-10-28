// Jalankan secara aman di server/CI dengan access token resmi TikTok yang masih valid.
// Jangan memakai PUBLIC_ untuk token ini.
import { writeFile } from 'node:fs/promises';
const token = process.env.TIKTOK_ACCESS_TOKEN;
if (!token) throw new Error('TIKTOK_ACCESS_TOKEN belum diatur');
const response = await fetch('https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,create_time', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ max_count: 20 }),
});
if (!response.ok) throw new Error(`TikTok API HTTP ${response.status}`);
const json = await response.json();
if (json.error?.code !== 'ok' || !Array.isArray(json.data?.videos)) throw new Error(`TikTok API: ${JSON.stringify(json.error || 'respons tidak valid')}`);
const videos = json.data.videos
  .filter(v => /^\d{15,25}$/.test(String(v.id)))
  .sort((a,b) => Number(b.create_time || 0) - Number(a.create_time || 0))
  .slice(0, 12)
  .map(v => ({ id: String(v.id), title: v.title || v.video_description || 'Video TikTok' }));
await writeFile(new URL('../public/tiktok-latest.json', import.meta.url), JSON.stringify({ updatedAt: new Date().toISOString(), videos }, null, 2) + '\n');
console.log(`Berhasil menyimpan ${videos.length} video TikTok.`);
