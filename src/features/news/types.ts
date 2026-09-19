export interface NewsArticle {
  id: string;
  category: string;
  date: string;
  description: string;
  imageUrl?: string;
  mediaType: 'image' | 'video';
  published: boolean;
  thumbnailUrl?: string;
  title: string;
  videoUrl?: string;
}

export type ApiNewsItem = Record<string, unknown>;

export interface PaginatedNewsResponse {
  items: NewsArticle[];
  nextCursor?: string | null;
}
