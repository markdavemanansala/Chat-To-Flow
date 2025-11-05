import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/ToastProvider"

const INTEGRATIONS_STORAGE_KEY = 'workflow_integrations'

const defaultIntegrations = [
  { id: 'facebook', name: 'Facebook', icon: '📘', connected: false, lastTested: null },
  { id: 'telegram', name: 'Telegram', icon: '✈️', connected: false, lastTested: null },
  { id: 'email', name: 'Email/SMTP', icon: '📧', connected: false, lastTested: null },
  { id: 'sheets', name: 'Google Sheets', icon: '📊', connected: false, lastTested: null },
]

export function IntegrationsDrawer({ open, onOpenChange }) {
  const { showToast } = useToast()
  const [integrations, setIntegrations] = useState(defaultIntegrations)
  const [testing, setTesting] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem(INTEGRATIONS_STORAGE_KEY)
    if (saved) {
      try {
        setIntegrations(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to load integrations', e)
      }
    }
  }, [])

  const saveIntegrations = (updated) => {
    setIntegrations(updated)
    localStorage.setItem(INTEGRATIONS_STORAGE_KEY, JSON.stringify(updated))
  }

  const handleConnect = async (integration) => {
    // Mock OAuth flow
    showToast(`Connecting to ${integration.name}...`, 'default')
    
    setTimeout(() => {
      const updated = integrations.map(i => 
        i.id === integration.id 
          ? { ...i, connected: true, lastTested: new Date().toISOString() }
          : i
      )
      saveIntegrations(updated)
      showToast(`${integration.name} connected successfully!`, 'success')
    }, 1500)
  }

  const handleDisconnect = (integration) => {
    if (window.confirm(`Disconnect from ${integration.name}?`)) {
      const updated = integrations.map(i => 
        i.id === integration.id 
          ? { ...i, connected: false, lastTested: null }
          : i
      )
      saveIntegrations(updated)
      showToast(`${integration.name} disconnected`, 'default')
    }
  }

  const handleTest = async (integration) => {
    setTesting(integration.id)
    showToast(`Testing ${integration.name} connection...`, 'default')
    
    // Mock test
    setTimeout(() => {
      const updated = integrations.map(i => 
        i.id === integration.id 
          ? { ...i, lastTested: new Date().toISOString() }
          : i
      )
      saveIntegrations(updated)
      setTesting(null)
      showToast(`${integration.name} connection test successful!`, 'success')
    }, 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Connect Accounts</DialogTitle>
          <DialogDescription>
            Connect your accounts to use them in your workflows. All connections are securely stored.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[500px] overflow-y-auto py-4">
          {integrations.map((integration) => (
            <Card key={integration.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{integration.icon}</span>
                    <div>
                      <div className="font-medium">{integration.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {integration.connected ? (
                          integration.lastTested ? (
                            `Last tested: ${new Date(integration.lastTested).toLocaleString()}`
                          ) : (
                            'Connected'
                          )
                        ) : (
                          'Not connected'
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {integration.connected && (
                      <Badge variant="default" className="bg-primary/80">
                        ✓ Connected
                      </Badge>
                    )}
                    {integration.connected && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTest(integration)}
                        disabled={testing === integration.id}
                      >
                        {testing === integration.id ? 'Testing...' : 'Test'}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={integration.connected ? "destructive" : "default"}
                      onClick={() => 
                        integration.connected 
                          ? handleDisconnect(integration)
                          : handleConnect(integration)
                      }
                      disabled={testing === integration.id}
                    >
                      {integration.connected ? 'Disconnect' : 'Connect'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

