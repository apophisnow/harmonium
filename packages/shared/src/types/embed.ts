export interface Embed {
  id: string;
  url: string;
  type: 'link' | 'image' | 'video' | 'rich';
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  color: string | null;
}
