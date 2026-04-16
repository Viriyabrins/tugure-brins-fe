import { useEffect, useRef } from 'react';
import { getKeycloakToken } from '@/lib/keycloak';

/**
 * Custom React hook for Server-Sent Events integration with debtor data
 * Connects to /api/db-channel/stream and triggers callback on debtor changes
 * Includes debouncing to batch rapid updates (e.g., bulk operations)
 * 
 * @param {Function} onDebtorChange - Callback function to execute when debtor data changes
 * @returns {void}
 */
export function useDebtorSSE(onDebtorChange) {
  const eventSourceRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttemptsRef = useRef(5);
  const reconnectDelayRef = useRef(1000);
  
  // Debounce state for bulk operations
  const debounceTimerRef = useRef(null);
  const pendingChangesRef = useRef([]);
  const DEBOUNCE_DELAY = 500; // Wait 500ms after last event before refreshing

  // Helper function to execute debounced callback
  const executeDebouncedCallback = () => {
    if (pendingChangesRef.current.length > 0) {
      console.log(`[useDebtorSSE] 🔄 Executing debounced refresh after ${pendingChangesRef.current.length} changes`);
      onDebtorChange(pendingChangesRef.current);
      pendingChangesRef.current = [];
    }
  };

  // Helper function to debounce callback execution
  const debounceCallback = (payload) => {
    pendingChangesRef.current.push(payload);
    
    // Clear existing timer if any
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      console.log('[useDebtorSSE] ⏱️  Debounce reset (more changes incoming)');
    }
    
    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      console.log('[useDebtorSSE] ⏱️  Debounce complete, triggering refresh');
      executeDebouncedCallback();
      debounceTimerRef.current = null;
    }, DEBOUNCE_DELAY);
  };

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
              // Use debounced callback instead of direct call
              debounceCallback(payload);
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
      // Clear any pending debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      if (eventSourceRef.current) {
        console.log('[useDebtorSSE] 🧹 Cleaning up SSE connection');
        eventSourceRef.current.close();
        console.log('[useDebtorSSE] SSE connection closed');
        eventSourceRef.current = null;
      }
    };
  }, []);
}

// ── Claim SSE ─────────────────────────────────────────────────────────────────

export function useClaimSSE(onClaimChange) {
  const eventSourceRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttemptsRef = useRef(5);
  const reconnectDelayRef = useRef(1000);
  const debounceTimerRef = useRef(null);
  const pendingChangesRef = useRef([]);
  const DEBOUNCE_DELAY = 500;

  const executeDebouncedCallback = () => {
    if (pendingChangesRef.current.length > 0) {
      onClaimChange(pendingChangesRef.current);
      pendingChangesRef.current = [];
    }
  };

  const debounceCallback = (payload) => {
    pendingChangesRef.current.push(payload);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      executeDebouncedCallback();
      debounceTimerRef.current = null;
    }, DEBOUNCE_DELAY);
  };

  useEffect(() => {
    const connectSSE = async () => {
      try {
        const token = getKeycloakToken();
        if (!token) return;
        const apiUrl = `/api/db-channel/stream?access_token=${encodeURIComponent(token)}`;
        const eventSource = new EventSource(apiUrl);
        eventSource.addEventListener('connected', () => {
          reconnectAttemptsRef.current = 0;
          reconnectDelayRef.current = 1000;
        });
        eventSource.addEventListener('message', (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.table === 'claim') {
              console.log('[useClaimSSE] 🔄 Claim change:', payload.action);
              debounceCallback(payload);
            }
          } catch (err) {
            console.error('[useClaimSSE] ❌ Parse error:', err);
          }
        });
        eventSource.onerror = () => {
          eventSource.close();
          if (reconnectAttemptsRef.current < maxReconnectAttemptsRef.current) {
            reconnectAttemptsRef.current += 1;
            const delay = reconnectDelayRef.current * Math.pow(2, reconnectAttemptsRef.current - 1);
            setTimeout(() => connectSSE(), delay);
          }
        };
        eventSourceRef.current = eventSource;
      } catch (err) {
        console.error('[useClaimSSE] ❌ Setup error:', err);
      }
    };
    connectSSE();
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
    };
  }, []);
}
