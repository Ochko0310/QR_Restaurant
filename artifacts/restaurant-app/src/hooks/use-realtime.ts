import { useEffect, useState } from 'react';
import { socket } from '@/lib/socket';
import { useStore } from '@/hooks/use-store';
import { useQueryClient } from '@tanstack/react-query';
import { getGetTableOrdersQueryKey, getGetOrdersQueryKey } from '@workspace/api-client-react';

const STAFF_ROOM = (import.meta.env.VITE_STAFF_ROOM as string | undefined) ?? 'restaurant_1';

export function useGuestRealtime(tableToken?: string) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!tableToken) return;

    socket.auth = { tableToken };
    socket.connect();
    
    const onConnect = () => {
      setConnected(true);
      socket.emit('join', `session_${tableToken}`);
    };
    const onDisconnect = () => setConnected(false);
    
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: getGetTableOrdersQueryKey(tableToken) });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('order:updated', handleUpdate);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('order:updated', handleUpdate);
      socket.disconnect();
    };
  }, [tableToken, queryClient]);

  return { connected };
}

export function useStaffRealtime() {
  const queryClient = useQueryClient();
  const token = useStore((s) => s.token);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    socket.auth = { token };
    socket.connect();
    
    const onConnect = () => {
      setConnected(true);
      socket.emit('join', STAFF_ROOM);
    };
    const onDisconnect = () => setConnected(false);

    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: getGetOrdersQueryKey() });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('order:new', handleUpdate);
    socket.on('order:updated', handleUpdate);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('order:new', handleUpdate);
      socket.off('order:updated', handleUpdate);
      socket.disconnect();
    };
  }, [queryClient, token]);

  return { connected };
}
