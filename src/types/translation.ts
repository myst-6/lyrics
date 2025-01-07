export interface Section {
  type: string;
  original: string;
  translation: string;
  analysis: string;
}

export interface SavedTranslation {
  id: string;
  userId: string;
  title: string;
  timestamp: number; // Unix timestamp in milliseconds
  lyrics: string;
  sections: Section[];
} 