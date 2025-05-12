export interface Section {
  id: string;
  title: string;
  description: string;
  articlesCount?: number;
  articles?: any;
  created_at: Date;
  updated_at: Date;
}
