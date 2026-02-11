import { useWebSocket } from '../hooks/useWebSocket.js';
import { AppLayout } from '../components/layout/AppLayout.js';

export function AppPage() {
  const { sendEvent, isConnected } = useWebSocket();

  return <AppLayout sendEvent={sendEvent} isConnected={isConnected} />;
}
