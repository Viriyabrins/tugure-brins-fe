import { useEffect, useRef } from 'react';
import { getKeycloakToken } from '@/lib/keycloak';

/**
 * Custom React hook for Server-Sent Events integration with debtor data
 * Connects to /api/db-channel/stream and triggers callback on debtor changes
 * 
 * @param {Function} onDebtorChange - Callback function to execute when debtor data changes
 * @returns {void}
 */
export function useDebtorSSE(onDebtorChange) {
  const eventSourceRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttemptsRef = useRef(5);
  const reconnectDelayRef = useRef(1000); // Start with 1 second

  useEffect(() => {
    const connectSSE = async () => {
      try {
        const token = getKeycloakToken();
        if (!token) {
          console.warn('[useDebtorSSE] No authentication token available');
          return;
        }

        // Use relative path to go through dev proxy (5173 -> 4000)
        // In production, this will use the same domain as the app
        const apiUrl = `/api/db-channel/stream?access_token=${encodeURIComponent(token)}`;
        
        console.log('[useDebtorSSE] Connecting to:', apiUrl);
        const eventSource = new EventSource(apiUrl);

        eventSource.addEventListener('connected', (event) => {
          console.log('[useDebtorSSE] ✅ Connected to SSE stream', event.data);
          reconnectAttemptsRef.current = 0; // Reset on successful connection
          reconnectDelayRef.current = 1000;
        });

        eventSource.addEventListener('message', (event) => {
          console.log('[useDebtorSSE] 📨 Raw message received:', event.data);
          try {
            const payload = JSON.parse(event.data);
            console.log('[useDebtorSSE] 📦 Parsed payload:', payload.table, payload.operation);
            
            // Filter for debtor table changes only
            if (payload.table === 'debtor') {
              console.log('[useDebtorSSE] 🔄 Debtor change detected:', payload.operation, payload.record?.id);
              onDebtorChange(payload);
            } else {
              console.log('[useDebtorSSE] ⏭️  Skipping non-debtor table:', payload.table);
            }
          } catch (error) {
            console.error('[useDebtorSSE] ❌ Parse error:', error, 'Data:', event.data);
          }
        });

        eventSource.onerror = (error) => {
          console.error('[useDebtorSSE] ❌ Connection error:', error);
          eventSource.close();
          
          // Exponential backoff reconnection
          if (reconnectAttemptsRef.current < maxReconnectAttemptsRef.current) {
            reconnectAttemptsRef.current += 1;
            const delay = reconnectDelayRef.current * Math.pow(2, reconnectAttemptsRef.current - 1);
            console.log(`[useDebtorSSE] 🔁 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttemptsRef.current})`);
            
            setTimeout(() => {
              connectSSE();
            }, delay);
          } else {
            console.error('[useDebtorSSE] ❌ Max reconnection attempts reached. SSE connection failed.');
          }
        };

        eventSourceRef.current = eventSource;
      } catch (error) {
        console.error('[useDebtorSSE] ❌ Connection setup error:', error);
      }
    };

    console.log('[useDebtorSSE] Hook mounted, attempting connection');
    connectSSE();

    // Cleanup: close connection on unmount
    return () => {
      if (eventSourceRef.current) {
        console.log('[useDebtorSSE] 🧹 Cleaning up SSE connection');
        eventSourceRef.current.close();
        console.log('[useDebtorSSE] SSE connection closed');
        eventSourceRef.current = null;
      }
    };
  }, []);
}
