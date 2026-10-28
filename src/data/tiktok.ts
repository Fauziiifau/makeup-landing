
export interface TikTokPost {
  id: string;
  title: string;
  type: "video" | "photo";
}

export const featuredVideos: TikTokPost[] = [
  // Masukkan video asli di sini.
  {
    id: "7663416553030995220",
    title: "Makeup Clean look",
    type: "video"
  },
  {
    id: "7700573010083810581",
    title: "Makeup Graduation",
    type: "photo"
  },
];

export const tiktokProfile =
  "https://www.tiktok.com/@auliaas_makeup";
