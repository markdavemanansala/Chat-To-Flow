/**
 * @fileoverview Unified Connect Modal - Supports OAuth2, API Key, Service Account, and Webhook
 */

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useConnectModal, useConnectionStore } from '@/store/connectionStore';
import { getConnectorManifest } from '@/config/connectors';
import { useAddToast } from '@/store/uiStore';
import { getCurrentLocale, getT } from '@/i18n';
import { saveWorkflowDraft } from '@/lib/storage';
import { useNodes, useEdges } from '@/store/graphStore';

const POLL_INTERVAL = 2000; // 2 seconds
const POLL_TIMEOUT = 300000; // 5 minutes

export function ConnectModal() {
  const { open, providerId, nodeKind, closeModal } = useConnectModal();
  const { setConnectionStatus, testConnection, setOAuthHandshake, getOAuthHandshake } = useConnectionStore();
  const addToast = useAddToast();
  const nodes = useNodes();
  const edges = useEdges();
  
  const locale = getCurrentLocale();
  const t = getT(locale);

  const manifest = providerId ? getConnectorManifest(providerId) : null;
  const providerName = manifest?.name || providerId || 'Provider';

  // Form state
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [fileData, setFileData] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [oauthWindow, setOauthWindow] = useState<Window | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Initialize form data from manifest
  useEffect(() => {
    if (!manifest) return;

    const initialData: Record<string, string> = {};
    if (manifest.authType === 'api_key' && manifest.apiKey) {
      manifest.apiKey.fields.forEach((field) => {
        initialData[field.name] = '';
      });
    } else if (manifest.authType === 'oauth2' && manifest.oauth2) {
      // Initialize OAuth credential fields if configurable
      if (manifest.oauth2.configurable && manifest.oauth2.fields) {
        manifest.oauth2.fields.forEach((field) => {
          initialData[field.name] = manifest.oauth2?.[field.name as keyof typeof manifest.oauth2] || '';
        });
      }
    } else if (manifest.authType === 'webhook' && manifest.webhook) {
      initialData.url = manifest.webhook.url || '';
      initialData.secret = manifest.webhook.secret || '';
    }
    setFormData(initialData);
    setFileData(null);
  }, [manifest]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      if (oauthWindow) {
        oauthWindow.close();
      }
    };
  }, [pollingInterval, oauthWindow]);

  // OAuth polling handler
  const pollOAuthStatus = useCallback(async (providerId: string) => {
    const startTime = Date.now();
    
    const poll = async () => {
      if (Date.now() - startTime > POLL_TIMEOUT) {
        if (pollingInterval) clearInterval(pollingInterval);
        setPollingInterval(null);
        setIsConnecting(false);
        addToast({ type: 'error', text: t('connect.oauth.failed', 'Connection timeout') });
        return;
      }

      try {
        const { checkOAuthStatus } = await import('@/lib/connectionApi');
        const handshake = getOAuthHandshake(providerId);
        if (!handshake?.handshakeId) {
          if (pollingInterval) clearInterval(pollingInterval);
          setPollingInterval(null);
          setIsConnecting(false);
          addToast({ type: 'error', text: t('connect.oauth.failed', 'No OAuth handshake found') });
          return;
        }
        const data = await checkOAuthStatus(handshake.handshakeId);

        if (data.status === 'completed') {
          if (pollingInterval) clearInterval(pollingInterval);
          setPollingInterval(null);
          setIsConnecting(false);
          
          // Save connection
          setConnectionStatus(providerId, {
            connected: true,
            connectedAt: new Date().toISOString(),
            expiresAt: data.expiresAt,
            credentials: data.credentials,
          });

          // Auto-test connection
          const testSuccess = await testConnection(providerId);
          if (testSuccess) {
            addToast({ type: 'ok', text: t('connect.oauth.success', 'Connected successfully!') });
            // Save workflow draft if we have nodes
            if (nodes.length > 0) {
              saveWorkflowDraft({ name: 'Draft', nodes, edges });
            }
            closeModal();
          } else {
            addToast({ type: 'warn', text: t('connect.test.failed', 'Connected but test failed') });
          }
        } else if (data.status === 'failed') {
          if (pollingInterval) clearInterval(pollingInterval);
          setPollingInterval(null);
          setIsConnecting(false);
          addToast({ type: 'error', text: data.error || t('connect.oauth.failed', 'Connection failed') });
        }
      } catch (error: any) {
        console.error('OAuth polling error:', error);
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL);
    setPollingInterval(interval);
    poll(); // Initial poll
  }, [pollingInterval, addToast, t, providerId, setConnectionStatus, testConnection, nodes, edges, closeModal, getOAuthHandshake]);

  // Handle OAuth2 connection
  const handleOAuthConnect = async () => {
    if (!manifest?.oauth2) return;

    setIsConnecting(true);
    addToast({ type: 'ok', text: t('connect.oauth.connecting', 'Connecting...') });

    try {
      // Start OAuth flow
      const { startOAuthFlow } = await import('@/lib/connectionApi');
      
      // Prepare OAuth config if user provided credentials
      const oauthConfig = manifest.oauth2.configurable && formData.clientId && formData.clientSecret
        ? {
            clientId: formData.clientId,
            clientSecret: formData.clientSecret,
          }
        : undefined;
      
      const data = await startOAuthFlow(providerId, manifest.oauth2.redirectUri, oauthConfig);
      
      // Store handshake ID for polling
      setOAuthHandshake(providerId, { handshakeId: data.handshakeId, status: 'pending' });
      
      // Open OAuth window
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const windowFeatures = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
      const authWindow = window.open(data.authUrl, 'oauth', windowFeatures);
      
      if (!authWindow) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      setOauthWindow(authWindow);
      addToast({ type: 'ok', text: t('connect.oauth.openWindow', 'A new window will open for authorization') });

      // Start polling for completion
      await pollOAuthStatus(providerId);
    } catch (error: any) {
      setIsConnecting(false);
      addToast({ type: 'error', text: error.message || t('connect.oauth.failed', 'Connection failed') });
    }
  };

  // Handle API Key validation
  const handleApiKeyValidate = async () => {
    if (!manifest?.apiKey) return;

    // Validate required fields
    const requiredFields = manifest.apiKey.fields.filter((f) => f.required);
    for (const field of requiredFields) {
      if (!formData[field.name]?.trim()) {
        addToast({ type: 'error', text: `${field.label} is required` });
        return;
      }
    }

    setIsValidating(true);
    addToast({ type: 'ok', text: t('connect.apiKey.validating', 'Validating...') });

    try {
      const { testProviderConnection } = await import('@/lib/connectionApi');
      const data = await testProviderConnection(providerId, formData);

      if (data.success) {
        // Save credentials
        const secrets = JSON.parse(localStorage.getItem('workflow_secrets') || '[]');
        const secretValue = manifest.apiKey.fields.length === 1
          ? formData[manifest.apiKey.fields[0].name]
          : JSON.stringify(formData);

        const newSecret = {
          id: Date.now().toString(),
          label: `${providerName} API Key`,
          value: secretValue,
          scope: 'workspace',
          nodeKinds: manifest.nodeKinds,
          createdAt: new Date().toISOString(),
        };

        // Remove existing secrets for this provider
        const filtered = secrets.filter(
          (s: any) => !s.nodeKinds?.some((k: string) => manifest.nodeKinds.includes(k))
        );
        filtered.push(newSecret);
        localStorage.setItem('workflow_secrets', JSON.stringify(filtered));
        window.dispatchEvent(new CustomEvent('secrets-updated'));

        // Update connection status
        setConnectionStatus(providerId, {
          connected: true,
          connectedAt: new Date().toISOString(),
          credentials: formData,
        });

        addToast({ type: 'ok', text: t('connect.apiKey.success', 'API key validated successfully!') });
        if (nodes.length > 0) {
          saveWorkflowDraft({ name: 'Draft', nodes, edges });
        }
        closeModal();
      } else {
        addToast({ type: 'error', text: data.error || t('connect.apiKey.failed', 'Validation failed') });
      }
    } catch (error: any) {
      addToast({ type: 'error', text: error.message || t('connect.apiKey.failed', 'Validation failed') });
    } finally {
      setIsValidating(false);
    }
  };

  // Handle Service Account file upload
  const handleServiceAccountValidate = async () => {
    if (!manifest?.serviceAccount || !fileData) {
      addToast({ type: 'error', text: 'Please select a JSON file' });
      return;
    }

    setIsValidating(true);
    addToast({ type: 'ok', text: t('connect.serviceAccount.validating', 'Validating...') });

    try {
      const fileText = await fileData.text();
      const jsonData = JSON.parse(fileText);

      const { testProviderConnection } = await import('@/lib/connectionApi');
      const data = await testProviderConnection(providerId, { serviceAccountJson: jsonData });

      if (data.success) {
        // Save credentials
        const secrets = JSON.parse(localStorage.getItem('workflow_secrets') || '[]');
        const newSecret = {
          id: Date.now().toString(),
          label: `${providerName} Service Account`,
          value: fileText,
          scope: 'workspace',
          nodeKinds: manifest.nodeKinds,
          createdAt: new Date().toISOString(),
        };

        const filtered = secrets.filter(
          (s: any) => !s.nodeKinds?.some((k: string) => manifest.nodeKinds.includes(k))
        );
        filtered.push(newSecret);
        localStorage.setItem('workflow_secrets', JSON.stringify(filtered));
        window.dispatchEvent(new CustomEvent('secrets-updated'));

        // Update connection status
        setConnectionStatus(providerId, {
          connected: true,
          connectedAt: new Date().toISOString(),
          credentials: { serviceAccountJson: jsonData },
        });

        addToast({ type: 'ok', text: t('connect.serviceAccount.success', 'Service account validated successfully!') });
        if (nodes.length > 0) {
          saveWorkflowDraft({ name: 'Draft', nodes, edges });
        }
        closeModal();
      } else {
        addToast({ type: 'error', text: data.error || t('connect.serviceAccount.failed', 'Validation failed') });
      }
    } catch (error: any) {
      addToast({ type: 'error', text: error.message || t('connect.serviceAccount.failed', 'Validation failed') });
    } finally {
      setIsValidating(false);
    }
  };

  // Handle Webhook verification
  const handleWebhookVerify = async () => {
    if (!manifest?.webhook) return;

    if (!formData.url?.trim()) {
      addToast({ type: 'error', text: 'Webhook URL is required' });
      return;
    }

    setIsValidating(true);
    addToast({ type: 'ok', text: t('connect.webhook.verifying', 'Verifying...') });

    try {
      const { testProviderConnection } = await import('@/lib/connectionApi');
      const data = await testProviderConnection(providerId, { url: formData.url, secret: formData.secret });

      if (data.success) {
        setConnectionStatus(providerId, {
          connected: true,
          connectedAt: new Date().toISOString(),
          credentials: { url: formData.url, secret: formData.secret },
        });

        addToast({ type: 'ok', text: t('connect.webhook.success', 'Webhook verified successfully!') });
        closeModal();
      } else {
        addToast({ type: 'error', text: data.error || t('connect.webhook.failed', 'Verification failed') });
      }
    } catch (error: any) {
      addToast({ type: 'error', text: error.message || t('connect.webhook.failed', 'Verification failed') });
    } finally {
      setIsValidating(false);
    }
  };

  if (!manifest) return null;

  return (
    <Dialog open={open} onOpenChange={closeModal}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {manifest.icon && <span className="mr-2">{manifest.icon}</span>}
            {t('connect.title', 'Connect {provider}').replace('{provider}', providerName)}
          </DialogTitle>
          <DialogDescription>
            {manifest.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* OAuth2 Flow */}
          {manifest.authType === 'oauth2' && manifest.oauth2 && (
            <div className="space-y-4">
              {/* OAuth Credential Fields (if configurable) */}
              {manifest.oauth2.configurable && manifest.oauth2.fields && (
                <div className="space-y-4 border rounded-lg p-4">
                  <h3 className="font-semibold text-sm">
                    {t('connect.oauth.credentials', 'OAuth Credentials')}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t('connect.oauth.credentialsHelp', 'Enter your OAuth app credentials to connect')}
                  </p>
                  {manifest.oauth2.fields.map((field) => (
                    <div key={field.name} className="space-y-2">
                      <Label htmlFor={field.name}>
                        {field.label}
                        {field.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      <Input
                        id={field.name}
                        type={field.type}
                        placeholder={field.placeholder}
                        value={formData[field.name] || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, [field.name]: e.target.value })
                        }
                        required={field.required}
                      />
                      {field.helpText && (
                        <p className="text-xs text-muted-foreground">{field.helpText}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              <p className="text-sm text-muted-foreground">
                {t('connect.oauth.openWindow', 'A new window will open for authorization')}
              </p>
              <Button
                onClick={handleOAuthConnect}
                disabled={isConnecting || (manifest.oauth2.configurable && (!formData.clientId || !formData.clientSecret))}
                className="w-full"
                aria-label={t('connect.oauth.connectButton', 'Connect {provider}').replace('{provider}', providerName)}
              >
                {isConnecting
                  ? t('connect.oauth.connecting', 'Connecting...')
                  : t('connect.oauth.connectButton', 'Connect {provider}').replace('{provider}', providerName)}
              </Button>
              {isConnecting && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-spin">⏳</div>
                  {t('connect.oauth.polling', 'Checking authorization status...')}
                </div>
              )}
            </div>
          )}

          {/* API Key Flow */}
          {manifest.authType === 'api_key' && manifest.apiKey && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">{t('connect.apiKey.title', 'Enter API Key')}</h3>
                {manifest.id === 'telegram' && (
                  <p className="text-sm text-muted-foreground mt-1">
                    To get your bot token:
                    <ol className="list-decimal list-inside mt-2 space-y-1 ml-2">
                      <li>Open Telegram and search for <strong>@BotFather</strong></li>
                      <li>Send the <code className="bg-muted px-1 rounded">/newbot</code> command</li>
                      <li>Follow the instructions to create your bot</li>
                      <li>Copy the bot token you receive</li>
                      <li>Paste it in the field below</li>
                    </ol>
                  </p>
                )}
                {manifest.id === 'facebook' && (
                  <p className="text-sm text-muted-foreground mt-1">
                    To get your Facebook App credentials:
                    <ol className="list-decimal list-inside mt-2 space-y-1 ml-2">
                      <li>Go to <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Facebook Developers</a></li>
                      <li>Create a new app or select an existing one</li>
                      <li>Go to <strong>Settings &gt; Basic</strong> to find your <strong>App ID</strong> and <strong>App Secret</strong></li>
                      <li>For posting/reply actions, get a <strong>Page Access Token</strong> from Graph API Explorer or Page Settings</li>
                      <li>Enter all credentials in the fields below</li>
                    </ol>
                  </p>
                )}
              </div>
              {manifest.apiKey.fields.map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={field.name}>
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {field.type === 'textarea' ? (
                    <Textarea
                      id={field.name}
                      value={formData[field.name] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      placeholder={field.placeholder}
                      required={field.required}
                      className={field.type === 'password' ? 'font-mono' : ''}
                    />
                  ) : (
                    <Input
                      id={field.name}
                      type={field.type}
                      value={formData[field.name] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      placeholder={field.placeholder}
                      required={field.required}
                      className={field.type === 'password' ? 'font-mono' : ''}
                    />
                  )}
                  {field.helpText && (
                    <p className="text-xs text-muted-foreground">{field.helpText}</p>
                  )}
                  {field.apiKeyUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(field.apiKeyUrl, '_blank', 'noopener,noreferrer')}
                      className="mt-1"
                      type="button"
                    >
                      {field.apiKeyUrl.includes('t.me') 
                        ? 'Open @BotFather on Telegram'
                        : t('connect.apiKey.openApiKeys', 'Open API Keys page')}
                    </Button>
                  )}
                </div>
              ))}
              <Button
                onClick={handleApiKeyValidate}
                disabled={isValidating}
                className="w-full"
                aria-label={t('connect.apiKey.validate', 'Validate')}
              >
                {isValidating
                  ? t('connect.apiKey.validating', 'Validating...')
                  : t('connect.apiKey.validate', 'Validate')}
              </Button>
            </div>
          )}

          {/* Service Account Flow */}
          {manifest.authType === 'service_account' && manifest.serviceAccount && (
            <div className="space-y-4">
              <h3 className="font-semibold">{t('connect.serviceAccount.title', 'Upload Service Account')}</h3>
              <div className="space-y-2">
                <Label htmlFor="serviceAccountFile">JSON File</Label>
                <Input
                  id="serviceAccountFile"
                  type="file"
                  accept={manifest.serviceAccount.acceptFileTypes?.join(',') || '.json'}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFileData(file);
                    }
                  }}
                />
                {fileData && (
                  <p className="text-sm text-muted-foreground">
                    {t('connect.serviceAccount.fileSelected', 'File selected: {filename}').replace('{filename}', fileData.name)}
                  </p>
                )}
              </div>
              <Button
                onClick={handleServiceAccountValidate}
                disabled={isValidating || !fileData}
                className="w-full"
                aria-label={t('connect.serviceAccount.validate', 'Validate')}
              >
                {isValidating
                  ? t('connect.serviceAccount.validating', 'Validating...')
                  : t('connect.serviceAccount.validate', 'Validate')}
              </Button>
            </div>
          )}

          {/* Webhook Flow */}
          {manifest.authType === 'webhook' && manifest.webhook && (
            <div className="space-y-4">
              <h3 className="font-semibold">{t('connect.webhook.title', 'Configure Webhook')}</h3>
              <div className="space-y-2">
                <Label htmlFor="webhookUrl">
                  {t('connect.webhook.url', 'Webhook URL')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="webhookUrl"
                  type="url"
                  value={formData.url || ''}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://your-domain.com/webhook"
                  required
                />
              </div>
              {manifest.webhook.verifySecret && (
                <div className="space-y-2">
                  <Label htmlFor="webhookSecret">{t('connect.webhook.secret', 'Webhook Secret')}</Label>
                  <Input
                    id="webhookSecret"
                    type="password"
                    value={formData.secret || ''}
                    onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                    placeholder="Optional secret for verification"
                  />
                </div>
              )}
              <Button
                onClick={handleWebhookVerify}
                disabled={isValidating}
                className="w-full"
                aria-label={t('connect.webhook.verify', 'Verify')}
              >
                {isValidating
                  ? t('connect.webhook.verifying', 'Verifying...')
                  : t('connect.webhook.verify', 'Verify')}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeModal}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

