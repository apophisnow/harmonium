import axios from 'axios';

export interface HostConfig {
  defaultTheme: string;
  defaultMode: string;
}

export async function fetchHostConfig(): Promise<HostConfig> {
  const response = await axios.get<HostConfig>('/api/config');
  return response.data;
}
