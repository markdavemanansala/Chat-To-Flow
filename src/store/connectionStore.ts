/**
 * @fileoverview Connection store - Manages provider connections and credentials
 */

import { create } from 'zustand';
import { useMemo, useCallback } from 'react';
import { ConnectionStatus, OAuthHandshakeStatus } from '@/types/connector';
import { getConnectorManifest } from '@/config/connectors';

const CONNECTIONS_STORAGE_KEY = 'workflow_connections';
const OAUTH_HANDSHAKE_STORAGE_KEY = 'oauth_handshakes';

interface ConnectionStore {
  // State
  connections: Record<string, ConnectionStatus>;
  oauthHandshakes: Record<string, OAuthHandshakeStatus>;
  connectModalOpen: boolean;
  connectModalProviderId?: string;
  connectModalNodeKind?: string; // If opened from a node that needs credentials

  // Actions
  setConnectModalOpen: (open: boolean, providerId?: string, nodeKind?: string) => void;
  setConnectionStatus: (providerId: string, status: Partial<ConnectionStatus>) => void;
  getConnectionStatus: (providerId: string) => ConnectionStatus | undefined;
  isProviderConnected: (providerId: string) => boolean;
  testConnection: (providerId: string) => Promise<boolean>;
  disconnectProvider: (providerId: string) => void;
  setOAuthHandshake: (providerId: string, status: OAuthHandshakeStatus) => void;
  getOAuthHandshake: (providerId: string) => OAuthHandshakeStatus | undefined;
  clearOAuthHandshake: (providerId: string) => void;
  loadConnections: () => void;
  saveConnections: () => void;
}

export const useConnectionStore = create<ConnectionStore>((set, get) => {
  // Load connections from localStorage on init
  const loadFromStorage = () => {
    try {
      const stored = localStorage.getItem(CONNECTIONS_STORAGE_KEY);
      if (stored) {
        const connections = JSON.parse(stored);
        return connections;
      }
    } catch (e) {
      console.error('Failed to load connections:', e);
    }
    return {};
  };

  const loadHandshakes = () => {
    try {
      const stored = localStorage.getItem(OAUTH_HANDSHAKE_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load OAuth handshakes:', e);
    }
    return {};
  };

  return {
    // Initial state
    connections: loadFromStorage(),
    oauthHandshakes: loadHandshakes(),
    connectModalOpen: false,
    connectModalProviderId: undefined,
    connectModalNodeKind: undefined,

    // Actions
    setConnectModalOpen: (open, providerId, nodeKind) =>
      set({
        connectModalOpen: open,
        connectModalProviderId: providerId,
        connectModalNodeKind: nodeKind,
      }),

    setConnectionStatus: (providerId, status) => {
      const current = get().connections[providerId] || {
        providerId,
        connected: false,
      };
      const updated = {
        ...current,
        ...status,
      };
      set((state) => ({
        connections: {
          ...state.connections,
          [providerId]: updated,
        },
      }));
      get().saveConnections();
    },

    getConnectionStatus: (providerId) => {
      return get().connections[providerId];
    },

    isProviderConnected: (providerId) => {
      const status = get().connections[providerId];
      return status?.connected === true;
    },

    testConnection: async (providerId) => {
      const manifest = getConnectorManifest(providerId);
      if (!manifest?.testEndpoint) {
        return false;
      }

      // Update status to testing
      get().setConnectionStatus(providerId, {
        testStatus: 'pending',
      });

      try {
        // Call test endpoint
        const response = await fetch(`/api/integrations/${providerId}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const success = response.ok;
        const data = await response.json().catch(() => ({}));

        get().setConnectionStatus(providerId, {
          testStatus: success ? 'success' : 'failed',
          testError: data.error || (success ? undefined : 'Test failed'),
          lastTested: new Date().toISOString(),
        });

        return success;
      } catch (error: any) {
        get().setConnectionStatus(providerId, {
          testStatus: 'failed',
          testError: error.message || 'Connection test failed',
          lastTested: new Date().toISOString(),
        });
        return false;
      }
    },

    disconnectProvider: (providerId) => {
      set((state) => {
        const { [providerId]: removed, ...rest } = state.connections;
        return { connections: rest };
      });
      get().saveConnections();
      // Also clear from secrets storage
      try {
        const secrets = JSON.parse(localStorage.getItem('workflow_secrets') || '[]');
        const manifest = getConnectorManifest(providerId);
        if (manifest) {
          const filtered = secrets.filter(
            (s: any) => !s.nodeKinds?.some((k: string) => manifest.nodeKinds.includes(k))
          );
          localStorage.setItem('workflow_secrets', JSON.stringify(filtered));
          window.dispatchEvent(new CustomEvent('secrets-updated'));
        }
      } catch (e) {
        console.error('Failed to clear secrets:', e);
      }
    },

    setOAuthHandshake: (providerId, status) => {
      set((state) => ({
        oauthHandshakes: {
          ...state.oauthHandshakes,
          [providerId]: status,
        },
      }));
      try {
        const handshakes = { ...get().oauthHandshakes, [providerId]: status };
        localStorage.setItem(OAUTH_HANDSHAKE_STORAGE_KEY, JSON.stringify(handshakes));
      } catch (e) {
        console.error('Failed to save OAuth handshake:', e);
      }
    },

    getOAuthHandshake: (providerId) => {
      return get().oauthHandshakes[providerId];
    },

    clearOAuthHandshake: (providerId) => {
      set((state) => {
        const { [providerId]: removed, ...rest } = state.oauthHandshakes;
        return { oauthHandshakes: rest };
      });
      try {
        const handshakes = { ...get().oauthHandshakes };
        delete handshakes[providerId];
        localStorage.setItem(OAUTH_HANDSHAKE_STORAGE_KEY, JSON.stringify(handshakes));
      } catch (e) {
        console.error('Failed to clear OAuth handshake:', e);
      }
    },

    loadConnections: () => {
      set({ connections: loadFromStorage() });
    },

    saveConnections: () => {
      try {
        localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(get().connections));
      } catch (e) {
        console.error('Failed to save connections:', e);
      }
    },
  };
});

// Convenience hooks
export const useConnectModal = () => {
  const open = useConnectionStore((state) => state.connectModalOpen);
  const providerId = useConnectionStore((state) => state.connectModalProviderId);
  const nodeKind = useConnectionStore((state) => state.connectModalNodeKind);
  const setConnectModalOpen = useConnectionStore((state) => state.setConnectModalOpen);
  
  const openModal = useCallback((pId?: string, nKind?: string) => {
    setConnectModalOpen(true, pId, nKind);
  }, [setConnectModalOpen]);
  
  const closeModal = useCallback(() => {
    setConnectModalOpen(false);
  }, [setConnectModalOpen]);
  
  return useMemo(() => ({
    open,
    providerId,
    nodeKind,
    openModal,
    closeModal,
  }), [open, providerId, nodeKind, openModal, closeModal]);
};

export const useConnectionStatus = (providerId: string) =>
  useConnectionStore((state) => state.getConnectionStatus(providerId));

export const useIsProviderConnected = (providerId: string) =>
  useConnectionStore((state) => state.isProviderConnected(providerId));

