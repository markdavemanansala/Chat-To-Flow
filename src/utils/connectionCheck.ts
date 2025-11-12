/**
 * @fileoverview Utility functions for checking node credential requirements
 */

import { getManifestForNodeKind, getProvidersForNodeKind } from '@/config/connectors';
import { useConnectionStore } from '@/store/connectionStore';
import type { GraphPatch } from '@/types/graph';

/**
 * Check if a node kind requires credentials and if they are connected
 */
export function checkNodeCredentials(nodeKind: string): {
  requires: boolean;
  connected: boolean;
  providerId?: string;
  providerName?: string;
} {
  const manifest = getManifestForNodeKind(nodeKind);
  if (!manifest) {
    return { requires: false, connected: true };
  }

  const isConnected = useConnectionStore.getState().isProviderConnected(manifest.id);
  return {
    requires: true,
    connected: isConnected,
    providerId: manifest.id,
    providerName: manifest.name,
  };
}

/**
 * Extract node kinds from a patch that require credentials
 */
export function getNodesRequiringCredentials(patch: GraphPatch): Array<{
  nodeKind: string;
  providerId: string;
  providerName: string;
}> {
  const result: Array<{ nodeKind: string; providerId: string; providerName: string }> = [];

  if (patch.op === 'ADD_NODE' && patch.node?.data?.kind) {
    const check = checkNodeCredentials(patch.node.data.kind);
    if (check.requires && !check.connected && check.providerId && check.providerName) {
      result.push({
        nodeKind: patch.node.data.kind,
        providerId: check.providerId,
        providerName: check.providerName,
      });
    }
  } else if (patch.op === 'BULK' && patch.ops) {
    for (const op of patch.ops) {
      if (op.op === 'ADD_NODE' && op.node?.data?.kind) {
        const check = checkNodeCredentials(op.node.data.kind);
        if (check.requires && !check.connected && check.providerId && check.providerName) {
          result.push({
            nodeKind: op.node.data.kind,
            providerId: check.providerId,
            providerName: check.providerName,
          });
        }
      }
    }
  }

  return result;
}

/**
 * Get unique providers that need to be connected for a set of node kinds
 */
export function getRequiredProviders(nodeKinds: string[]): Array<{
  providerId: string;
  providerName: string;
  nodeKinds: string[];
}> {
  const providerMap = new Map<string, { providerName: string; nodeKinds: Set<string> }>();

  for (const nodeKind of nodeKinds) {
    const providers = getProvidersForNodeKind(nodeKind);
    for (const provider of providers) {
      const isConnected = useConnectionStore.getState().isProviderConnected(provider.id);
      if (!isConnected) {
        if (!providerMap.has(provider.id)) {
          providerMap.set(provider.id, {
            providerName: provider.name,
            nodeKinds: new Set(),
          });
        }
        providerMap.get(provider.id)!.nodeKinds.add(nodeKind);
      }
    }
  }

  return Array.from(providerMap.entries()).map(([providerId, data]) => ({
    providerId,
    providerName: data.providerName,
    nodeKinds: Array.from(data.nodeKinds),
  }));
}

