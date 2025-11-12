/**
 * @fileoverview Secrets Vault Panel - Unified view of all provider connections
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useConnectionStore, useConnectionStatus } from '@/store/connectionStore';
import { CONNECTOR_MANIFESTS } from '@/config/connectors';
import { useAddToast } from '@/store/uiStore';
import { getCurrentLocale, getT } from '@/i18n';
import { ConnectModal } from '@/components/connect/ConnectModal';

export function SecretsVault() {
  const { connections, testConnection, disconnectProvider } = useConnectionStore();
  const addToast = useAddToast();
  const locale = getCurrentLocale();
  const t = getT(locale);

  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  const handleTest = async (providerId: string) => {
    setTestingProvider(providerId);
    addToast({ type: 'ok', text: t('connect.test.testing', 'Testing connection...') });
    
    const success = await testConnection(providerId);
    
    if (success) {
      addToast({ type: 'ok', text: t('connect.test.success', 'Connection test successful!') });
    } else {
      const status = useConnectionStore.getState().getConnectionStatus(providerId);
      const error = status?.testError || 'Unknown error';
      addToast({ 
        type: 'error', 
        text: t('connect.test.failed', 'Connection test failed: {error}').replace('{error}', error) 
      });
    }
    
    setTestingProvider(null);
  };

  const handleDisconnect = (providerId: string) => {
    if (window.confirm(`Disconnect ${CONNECTOR_MANIFESTS.find(m => m.id === providerId)?.name || providerId}?`)) {
      disconnectProvider(providerId);
      addToast({ type: 'ok', text: t('connect.disconnect', 'Disconnected') });
    }
  };

  const getStatusBadge = (status: ReturnType<typeof useConnectionStatus>) => {
    if (!status?.connected) {
      return <Badge variant="outline">{t('secrets.notConnected', 'Not connected')}</Badge>;
    }

    if (status.testStatus === 'pending' || testingProvider === status.providerId) {
      return <Badge variant="outline" className="animate-pulse">{t('secrets.testing', 'Testing...')}</Badge>;
    }

    if (status.testStatus === 'failed') {
      return <Badge variant="destructive">{t('secrets.testFailed', 'Test failed')}</Badge>;
    }

    // Check if token expires soon
    if (status.expiresAt) {
      const expiresAt = new Date(status.expiresAt);
      const daysUntilExpiry = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const manifest = CONNECTOR_MANIFESTS.find(m => m.id === status.providerId);
      
      if (daysUntilExpiry > 0 && daysUntilExpiry <= (manifest?.tokenExpiryWarningDays || 7)) {
        return (
          <Badge variant="outline" className="border-yellow-500 text-yellow-700 dark:text-yellow-400">
            {t('connect.expiresSoon', 'Expires in {days} days').replace('{days}', daysUntilExpiry.toString())}
          </Badge>
        );
      }
    }

    return <Badge variant="default" className="bg-green-500">{t('secrets.connected', 'Connected ✓')}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{t('secrets.title', 'Secrets Vault')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('secrets.description', 'Manage your API keys and credentials')}
          </p>
        </div>
      </div>

      <ConnectModal />

      <div className="grid gap-4">
        {CONNECTOR_MANIFESTS.map((manifest) => {
          const status = useConnectionStore.getState().getConnectionStatus(manifest.id);
          const isConnected = status?.connected === true;

          return (
            <Card key={manifest.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center gap-2 flex-wrap">
                      {manifest.icon && <span>{manifest.icon}</span>}
                      <span className="break-words">{manifest.name}</span>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1 break-words">{manifest.description}</p>
                  </div>
                  <div className="flex-shrink-0">
                    {getStatusBadge(status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1 flex-shrink-0">
                    {status?.lastTested && (
                      <p className="text-xs text-muted-foreground">
                        {t('secrets.lastTested', 'Last Tested')}:{' '}
                        {new Date(status.lastTested).toLocaleString()}
                      </p>
                    )}
                    {status?.connectedAt && (
                      <p className="text-xs text-muted-foreground">
                        {t('connect.connected', 'Connected')}:{' '}
                        {new Date(status.connectedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                    {isConnected && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTest(manifest.id);
                          }}
                          disabled={testingProvider === manifest.id}
                          aria-label={t('secrets.test', 'Test')}
                          className="flex-shrink-0"
                        >
                          {testingProvider === manifest.id
                            ? t('secrets.testing', 'Testing...')
                            : t('secrets.test', 'Test')}
                        </Button>
                        {status?.expiresAt && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              useConnectionStore.getState().setConnectModalOpen(true, manifest.id);
                            }}
                            aria-label={t('connect.reauthorize', 'Reauthorize')}
                            className="flex-shrink-0"
                          >
                            {t('connect.reauthorize', 'Reauthorize')}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDisconnect(manifest.id);
                          }}
                          aria-label={t('secrets.disconnect', 'Disconnect')}
                          className="flex-shrink-0"
                        >
                          {t('secrets.disconnect', 'Disconnect')}
                        </Button>
                      </>
                    )}
                    {!isConnected && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={(e) => {
                          e.stopPropagation();
                          useConnectionStore.getState().setConnectModalOpen(true, manifest.id);
                        }}
                        aria-label={`Connect ${manifest.name}`}
                        className="flex-shrink-0"
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {CONNECTOR_MANIFESTS.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          {t('secrets.noSecrets', 'No secrets stored')}
        </div>
      )}
    </div>
  );
}

