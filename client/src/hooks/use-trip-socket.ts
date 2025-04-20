
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

export function useTripSocket(tripId: number) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const socket = io();

    socket.emit('join-trip', tripId);

    socket.on('trip-update', ({ type, data }) => {
      // Invalidate relevant queries based on update type
      queryClient.invalidateQueries([`/api/trips/${tripId}`]);
      
      if (type.includes('participant')) {
        queryClient.invalidateQueries([`/api/trips/${tripId}/participants`]);
      }
      // Add other update types as needed
    });

    return () => {
      socket.emit('leave-trip', tripId);
      socket.disconnect();
    };
  }, [tripId, queryClient]);
}
