import { useEffect, useRef } from 'react';
import { getKeycloakToken } from '@/lib/keycloak';

/**
 * Custom React hook for Server-Sent Events integration with master contract data
 * Connects to /api/db-channel/stream and triggers callback on mastercontract changes
 * Includes debouncing to batch rapid updates (e.g., bulk operations)
 * 
 * @param {Function} onMasterContractChange - Callback function to execute when mastercontract data changes
 * @returns {void}
 */
export function useMasterContractSSE(onMasterContractChange) {
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
      console.log(`[useMasterContractSSE] 🔄 Executing debounced refresh after ${pendingChangesRef.current.length} changes`);
      onMasterContractChange(pendingChangesRef.current);
      pendingChangesRef.current = [];
    }
  };

  // Helper function to debounce callback execution
  const debounceCallback = (payload) => {
    pendingChangesRef.current.push(payload);
    
    // Clear existing timer if any
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      console.log('[useMasterContractSSE] ⏱️  Debounce reset (more changes incoming)');
    }
    
    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      console.log('[useMasterContractSSE] ⏱️  Debounce complete, triggering refresh');
      executeDebouncedCallback();
      debounceTimerRef.current = null;
    }, DEBOUNCE_DELAY);
  };

  useEffect(() => {
    const connectSSE = async () => {
      try {
        const token = getKeycloakToken();
        if (!token) {
          console.warn('[useMasterContractSSE] No authentication token available');
          return;
        }

        const apiUrl = `/api/db-channel/stream?access_token=${encodeURIComponent(token)}`;
        
        console.log('[useMasterContractSSE] Connecting to:', apiUrl);
        const eventSource = new EventSource(apiUrl);

        eventSource.addEventListener('connected', (event) => {
          console.log('[useMasterContractSSE] ✅ Connected to SSE stream', event.data);
          reconnectAttemptsRef.current = 0;
          reconnectDelayRef.current = 1000;
        });

        eventSource.addEventListener('message', (event) => {
          console.log('[useMasterContractSSE] 📨 Raw message received:', event.data);
          try {
            const payload = JSON.parse(event.data);
            console.log('[useMasterContractSSE] 📦 Parsed payload:', payload.table, payload.operation);
            
            // Filter for mastercontract table changes only
            if (payload.table === 'mastercontract') {
              console.log('[useMasterContractSSE] 🔄 MasterContract change detected:', payload.operation, payload.record?.id);
              debounceCallback(payload);
            } else {
              console.log('[useMasterContractSSE] ⏭️  Skipping non-mastercontract table:', payload.table);
            }
          } catch (error) {
            console.error('[useMasterContractSSE] ❌ Parse error:', error, 'Data:', event.data);
          }
        });

        eventSource.onerror = (error) => {
          console.error('[useMasterContractSSE] ❌ Connection error:', error);
          eventSource.close();
          
          if (reconnectAttemptsRef.current < maxReconnectAttemptsRef.current) {
            reconnectAttemptsRef.current += 1;
            const delay = reconnectDelayRef.current * Math.pow(2, reconnectAttemptsRef.current - 1);
            console.log(`[useMasterContractSSE] 🔁 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttemptsRef.current})`);
            
            setTimeout(() => {
              connectSSE();
            }, delay);
          } else {
            console.error('[useMasterContractSSE] ❌ Max reconnection attempts reached. SSE connection failed.');
          }
        };

        eventSourceRef.current = eventSource;
      } catch (error) {
        console.error('[useMasterContractSSE] ❌ Connection setup error:', error);
      }
    };

    console.log('[useMasterContractSSE] Hook mounted, attempting connection');
    connectSSE();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      if (eventSourceRef.current) {
        console.log('[useMasterContractSSE] 🧹 Cleaning up SSE connection');
        eventSourceRef.current.close();
        console.log('[useMasterContractSSE] SSE connection closed');
        eventSourceRef.current = null;
      }
    };
  }, []);
}
