import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/ToastProvider"

const SECRETS_STORAGE_KEY = 'workflow_secrets'

export function SecretsManager({ open, onOpenChange }) {
  const { showToast } = useToast()
  const [secrets, setSecrets] = useState([])
  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState({
    label: '',
    value: '',
    scope: 'workspace',
    nodeKinds: []
  })

  useEffect(() => {
    const saved = localStorage.getItem(SECRETS_STORAGE_KEY)
    if (saved) {
      try {
        setSecrets(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to load secrets', e)
      }
    }
  }, [])

  const saveSecrets = (updated) => {
    setSecrets(updated)
    localStorage.setItem(SECRETS_STORAGE_KEY, JSON.stringify(updated))
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('secrets-updated'))
  }

  const handleAdd = () => {
    if (!formData.label || !formData.value) {
      showToast('Please fill in both label and value', 'error')
      return
    }

    const newSecret = {
      id: Date.now().toString(),
      label: formData.label,
      value: formData.value, // In real app, encrypt this
      scope: formData.scope,
      nodeKinds: formData.nodeKinds,
      createdAt: new Date().toISOString()
    }

    saveSecrets([...secrets, newSecret])
    setFormData({ label: '', value: '', scope: 'workspace', nodeKinds: [] })
    setIsAdding(false)
    showToast('Secret saved successfully', 'success')
  }

  const handleDelete = (id) => {
    if (window.confirm('Delete this secret? This cannot be undone.')) {
      const updated = secrets.filter(s => s.id !== id)
      saveSecrets(updated)
      showToast('Secret deleted', 'default')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Secrets Manager</DialogTitle>
          <DialogDescription>
            Store API keys, tokens, and credentials for your workflows. Secrets are scoped per workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Add Secret Form */}
          {isAdding && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input
                    placeholder="e.g., Facebook API Key"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Value</Label>
                  <Textarea
                    placeholder="Enter your API key or token"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Scope</Label>
                  <select
                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground [&>option]:bg-background [&>option]:text-foreground"
                    value={formData.scope}
                    onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                  >
                    <option value="workspace">Workspace</option>
                    <option value="node">Specific Node</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAdd}>Save Secret</Button>
                  <Button variant="outline" onClick={() => {
                    setIsAdding(false)
                    setFormData({ label: '', value: '', scope: 'workspace', nodeKinds: [] })
                  }}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Add Button */}
          {!isAdding && (
            <Button onClick={() => setIsAdding(true)}>+ Add Secret</Button>
          )}

          {/* Secrets List */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {secrets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No secrets stored. Add one to get started.
              </div>
            ) : (
              secrets.map((secret) => (
                <Card key={secret.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{secret.label}</span>
                          <Badge variant="outline" className="text-xs">{secret.scope}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Created: {new Date(secret.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Value: {'•'.repeat(20)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(secret.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

