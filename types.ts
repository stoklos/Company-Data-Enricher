
export interface Contact {
  name: string;
  title: string;
  email?: string;
  phone?: string;
}

export interface Laboratories {
  confirmed: string[];
  presumed: string[];
}

export interface EnrichedData {
  website: string;
  description: string;
  revenue: string;
  laboratories: Laboratories;
  contacts: Contact[];
}

export interface Company {
  id: number;
  name: string;
  data?: EnrichedData;
  sources?: { uri: string; title: string; }[];
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}
