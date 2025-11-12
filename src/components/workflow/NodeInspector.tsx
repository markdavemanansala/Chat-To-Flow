// @ts-nocheck
import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useApplyPatch } from '@/store/graphStore'
import { useAddToast } from '@/store/uiStore'
import { generateNodeLabel } from '@/workflow/labeler'
import { checkNodeCredentials, getCredentialTypeName, getApiKeyUrl, getServiceName } from '@/utils/credentials'
import type { Node } from 'reactflow'

interface NodeInspectorProps {
  selectedNode: Node | null
}

interface NodeInspectorWithSecretsProps extends NodeInspectorProps {
  onOpenSecrets?: () => void
}

export default function NodeInspector({ selectedNode, onOpenSecrets }: NodeInspectorWithSecretsProps) {
  const applyPatch = useApplyPatch()
  const addToast = useAddToast()
  const [config, setConfig] = useState<any>({})
  const [label, setLabel] = useState('')
  const [credStatus, setCredStatus] = useState<{ requires: boolean; has: boolean; typeName: string } | null>(null)
  const [showCredentialInput, setShowCredentialInput] = useState(false)
  const [credentialValue, setCredentialValue] = useState('')
  const [isSavingCredential, setIsSavingCredential] = useState(false)

  // Save credential function
  const handleSaveCredential = () => {
    if (!credentialValue.trim()) {
      addToast({ type: 'error', text: 'Please enter a credential value' })
      return
    }

    setIsSavingCredential(true)
    try {
      const SECRETS_STORAGE_KEY = 'workflow_secrets'
      const existingSecrets = JSON.parse(localStorage.getItem(SECRETS_STORAGE_KEY) || '[]')
      const kind = selectedNode?.data?.kind || ''
      const typeName = getCredentialTypeName(kind)
      
      // Check if a secret for this node kind already exists
      const existingIndex = existingSecrets.findIndex((s: any) => 
        s.nodeKinds && s.nodeKinds.includes(kind)
      )
      
      const newSecret = {
        id: existingIndex >= 0 ? existingSecrets[existingIndex].id : Date.now().toString(),
        label: typeName,
        value: credentialValue.trim(),
        scope: 'workspace',
        nodeKinds: [kind],
        createdAt: existingIndex >= 0 ? existingSecrets[existingIndex].createdAt : new Date().toISOString()
      }
      
      if (existingIndex >= 0) {
        existingSecrets[existingIndex] = newSecret
      } else {
        existingSecrets.push(newSecret)
      }
      
      localStorage.setItem(SECRETS_STORAGE_KEY, JSON.stringify(existingSecrets))
      window.dispatchEvent(new CustomEvent('secrets-updated'))
      
      // Refresh credential status
      const status = checkNodeCredentials(kind)
      setCredStatus(status)
      setShowCredentialInput(false)
      setCredentialValue('')
      
      addToast({ type: 'ok', text: `${typeName} saved successfully!` })
    } catch (error: any) {
      console.error('Failed to save credential:', error)
      addToast({ type: 'error', text: `Failed to save credential: ${error.message}` })
    } finally {
      setIsSavingCredential(false)
    }
  }

  useEffect(() => {
    if (selectedNode) {
      setConfig(selectedNode.data?.config || {})
      setLabel(selectedNode.data?.label || '')
      setShowCredentialInput(false)
      setCredentialValue('')
      
      // Check credentials status
      const kind = selectedNode.data?.kind || ''
      const status = checkNodeCredentials(kind)
      setCredStatus(status)
    }
  }, [selectedNode])
  
  // Listen for credential updates
  useEffect(() => {
    const handleCredentialUpdate = () => {
      if (selectedNode) {
        const kind = selectedNode.data?.kind || ''
        const status = checkNodeCredentials(kind)
        setCredStatus(status)
      }
    }
    
    window.addEventListener('secrets-updated', handleCredentialUpdate)
    return () => window.removeEventListener('secrets-updated', handleCredentialUpdate)
  }, [selectedNode])

  if (!selectedNode) {
    return (
      <Card className="border-t h-full flex flex-col">
        <CardContent className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <p className="text-xs sm:text-sm text-muted-foreground text-center">Select a node to edit its configuration</p>
        </CardContent>
      </Card>
    )
  }

  const kind = selectedNode.data?.kind || ''
  const updateNode = (updates: { config?: any; label?: string }) => {
    if (!selectedNode) return
    const newConfig = updates.config ? { ...config, ...updates.config } : config
    const newLabel = updates.label !== undefined ? updates.label : selectedNode.data?.label
    
    // Recompute label if config changed
    const finalLabel = updates.config && kind
      ? generateNodeLabel(kind, newConfig)
      : newLabel
    
    applyPatch({
      op: 'UPDATE_NODE',
      id: selectedNode.id,
      data: {
        config: newConfig,
        label: finalLabel,
      },
    })
    
    if (updates.config) {
      setConfig(newConfig)
    }
    if (updates.label !== undefined || updates.config) {
      setLabel(finalLabel)
    }
  }

  const updateConfig = (key: string, value: any) => {
    updateNode({ config: { [key]: value } })
  }

  const updateLabel = (value: string) => {
    updateNode({ label: value })
  }

  // Render form based on node kind
  const renderForm = () => {
    switch (kind) {
      case 'trigger.facebook.comment':
        return (
          <>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="pageId" className="text-xs sm:text-sm">Page ID</Label>
              <Input
                id="pageId"
                value={config.pageId || ''}
                onChange={(e) => updateConfig('pageId', e.target.value)}
                placeholder="Facebook Page ID"
                className="text-xs sm:text-sm h-8 sm:h-10"
              />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="matchContains" className="text-xs sm:text-sm">Match Contains</Label>
              <Input
                id="matchContains"
                value={config.match?.contains || ''}
                onChange={(e) => updateConfig('match', { ...config.match, contains: e.target.value })}
                placeholder="price|menu"
                className="text-xs sm:text-sm h-8 sm:h-10"
              />
            </div>
          </>
        )

      case 'action.facebook.reply':
        return (
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="replyTemplate" className="text-xs sm:text-sm">Reply Template</Label>
            <Textarea
              id="replyTemplate"
              value={config.replyTemplate || ''}
              onChange={(e) => updateConfig('replyTemplate', e.target.value)}
              placeholder="Thanks for your comment!"
              rows={3}
              className="text-xs sm:text-sm min-h-[60px] sm:min-h-[80px] resize-none"
            />
          </div>
        )

      case 'action.sheets.appendRow':
        return (
          <>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="spreadsheetId" className="text-xs sm:text-sm">Spreadsheet ID</Label>
              <Input
                id="spreadsheetId"
                value={config.spreadsheetId || ''}
                onChange={(e) => updateConfig('spreadsheetId', e.target.value)}
                placeholder="988123abc..."
                className="text-xs sm:text-sm h-8 sm:h-10"
              />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="range" className="text-xs sm:text-sm">Range</Label>
              <Input
                id="range"
                value={config.range || ''}
                onChange={(e) => updateConfig('range', e.target.value)}
                placeholder="Sheet1!A1"
                className="text-xs sm:text-sm h-8 sm:h-10"
              />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs sm:text-sm">Map (Key → Expression)</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newMap = { ...(config.map || {}), '': '' }
                    updateConfig('map', newMap)
                  }}
                  className="text-[10px] sm:text-xs h-6 sm:h-8 px-2 sm:px-3"
                >
                  + Add
                </Button>
              </div>
              <div className="space-y-1.5 sm:space-y-2 max-h-32 sm:max-h-48 overflow-y-auto border rounded-md p-1.5 sm:p-2 scrollbar-hide">
                {Object.entries(config.map || {}).length === 0 ? (
                  <p className="text-[10px] sm:text-xs text-muted-foreground text-center py-2">No mappings yet</p>
                ) : (
                  Object.entries(config.map || {}).map(([key, val], idx) => (
                    <div key={idx} className="flex gap-1 sm:gap-2">
                      <Input
                        value={key}
                        onChange={(e) => {
                          const newMap = { ...(config.map || {}) }
                          delete newMap[key]
                          newMap[e.target.value] = val
                          updateConfig('map', newMap)
                        }}
                        placeholder="Column/Key"
                        className="text-[10px] sm:text-xs h-7 sm:h-9"
                      />
                      <Input
                        value={val || ''}
                        onChange={(e) => {
                          const newMap = { ...(config.map || {}), [key]: e.target.value }
                          updateConfig('map', newMap)
                        }}
                        placeholder="Expression"
                        className="text-[10px] sm:text-xs h-7 sm:h-9"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const newMap = { ...(config.map || {}) }
                          delete newMap[key]
                          updateConfig('map', newMap)
                        }}
                        className="h-7 sm:h-9 w-7 sm:w-9 p-0"
                      >
                        ×
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )

      case 'action.email.send':
        return (
          <>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="toExpr" className="text-xs sm:text-sm">To (Expression)</Label>
              <Input
                id="toExpr"
                value={config.toExpr || ''}
                onChange={(e) => updateConfig('toExpr', e.target.value)}
                placeholder="payload.email"
                className="text-xs sm:text-sm h-8 sm:h-10"
              />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="subjectTpl" className="text-xs sm:text-sm">Subject Template</Label>
              <Input
                id="subjectTpl"
                value={config.subjectTpl || ''}
                onChange={(e) => updateConfig('subjectTpl', e.target.value)}
                placeholder="Hello {{name}}"
                className="text-xs sm:text-sm h-8 sm:h-10"
              />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="bodyTpl" className="text-xs sm:text-sm">Body Template</Label>
              <Textarea
                id="bodyTpl"
                value={config.bodyTpl || ''}
                onChange={(e) => updateConfig('bodyTpl', e.target.value)}
                placeholder="Message body..."
                rows={4}
                className="text-xs sm:text-sm min-h-[80px] sm:min-h-[100px] resize-none"
              />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="html"
                  checked={config.html || false}
                  onChange={(e) => updateConfig('html', e.target.checked)}
                  className="rounded border-gray-300 w-4 h-4 sm:w-5 sm:h-5"
                />
                <Label htmlFor="html" className="cursor-pointer text-xs sm:text-sm">HTML Email</Label>
              </div>
            </div>
          </>
        )

      case 'action.http.request':
        return (
          <>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="method" className="text-xs sm:text-sm">Method</Label>
              <select
                id="method"
                value={config.method || 'POST'}
                onChange={(e) => updateConfig('method', e.target.value)}
                className="flex h-8 sm:h-10 w-full rounded-md border border-input bg-background text-foreground px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm [&>option]:bg-background [&>option]:text-foreground"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="url" className="text-xs sm:text-sm">URL</Label>
              <Input
                id="url"
                type="url"
                value={config.url || ''}
                onChange={(e) => updateConfig('url', e.target.value)}
                placeholder="https://api.example.com/endpoint"
                className="text-xs sm:text-sm h-8 sm:h-10"
              />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="headers" className="text-xs sm:text-sm">Headers (JSON)</Label>
              <Textarea
                id="headers"
                value={typeof config.headers === 'string' ? config.headers : JSON.stringify(config.headers || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value)
                    updateConfig('headers', parsed)
                  } catch {
                    updateConfig('headers', e.target.value)
                  }
                }}
                placeholder='{"Content-Type": "application/json"}'
                rows={3}
                className="font-mono text-[10px] sm:text-xs min-h-[60px] sm:min-h-[80px] resize-none"
              />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="body" className="text-xs sm:text-sm">Body (JSON)</Label>
              <Textarea
                id="body"
                value={typeof config.body === 'string' ? config.body : JSON.stringify(config.body || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value)
                    updateConfig('body', parsed)
                  } catch {
                    updateConfig('body', e.target.value)
                  }
                }}
                placeholder='{"key": "value"}'
                rows={4}
                className="font-mono text-[10px] sm:text-xs min-h-[80px] sm:min-h-[120px] resize-none"
              />
            </div>
          </>
        )

      default:
        return (
          <div className="space-y-2">
            <Label>Configuration (JSON)</Label>
            <Textarea
              value={JSON.stringify(config, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value)
                  updateConfig('__raw', parsed)
                  Object.keys(config).forEach((k) => {
                    if (k !== '__raw') updateConfig(k, undefined)
                  })
                  setConfig(parsed)
                } catch {
                  // ignore invalid JSON
                }
              }}
              rows={6}
              className="font-mono text-xs"
            />
          </div>
        )
    }
  }

  return (
    <Card className="border-t h-full flex flex-col">
      <CardHeader className="pb-2 sm:pb-3 shrink-0 px-3 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-xs sm:text-sm truncate">Node Configuration</CardTitle>
            <CardDescription className="text-[10px] sm:text-xs truncate">{kind}</CardDescription>
          </div>
          {credStatus?.requires && !credStatus.has && (
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0" title={`Requires ${credStatus.typeName}`}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-blue-600 dark:text-blue-400 sm:w-[14px] sm:h-[14px]">
                <path d="M8 1C4.13 1 1 4.13 1 8s3.13 7 7 7 7-3.13 7-7-3.13-7-7-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" fill="currentColor"/>
                <path d="M8 4.5c-.28 0-.5.22-.5.5v3c0 .28.22.5.5.5s.5-.22.5-.5V5c0-.28-.22-.5-.5-.5zM8 11c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5z" fill="currentColor"/>
              </svg>
              <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">API Key</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 space-y-3 sm:space-y-4 min-h-0 scrollbar-hide">
        {credStatus?.requires && !credStatus.has && (
          <div className="p-2.5 sm:p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-blue-600 dark:text-blue-400 sm:w-4 sm:h-4">
                  <path d="M8 1C4.13 1 1 4.13 1 8s3.13 7 7 7 7-3.13 7-7-3.13-7-7-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" fill="currentColor"/>
                  <path d="M8 4.5c-.28 0-.5.22-.5.5v3c0 .28.22.5.5.5s.5-.22.5-.5V5c0-.28-.22-.5-.5-.5zM8 11c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5z" fill="currentColor"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] sm:text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                  Requires {getServiceName(selectedNode?.data?.kind)} connection
                </p>
                <p className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-500 mb-2">
                  Connect your {getServiceName(selectedNode?.data?.kind)} account to use this node.
                </p>
                {!showCredentialInput ? (
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {getApiKeyUrl(selectedNode?.data?.kind) && (
                      <Button
                        size="sm"
                        onClick={() => window.open(getApiKeyUrl(selectedNode?.data?.kind), '_blank')}
                        className="text-[10px] sm:text-xs bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 px-2 sm:px-3 py-1 sm:py-1.5"
                      >
                        <span className="hidden sm:inline">🔗 </span>Get API Key
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowCredentialInput(true)}
                      className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5"
                    >
                      Add Key
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label htmlFor="credentialInput" className="text-[10px] sm:text-xs font-medium">
                        {credStatus.typeName}
                      </Label>
                      <Input
                        id="credentialInput"
                        type="password"
                        value={credentialValue}
                        onChange={(e) => setCredentialValue(e.target.value)}
                        placeholder={`Paste your ${credStatus.typeName} here`}
                        className="text-xs sm:text-sm h-8 sm:h-10"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-1.5 sm:gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveCredential}
                        disabled={isSavingCredential || !credentialValue.trim()}
                        className="flex-1 text-[10px] sm:text-xs bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 h-7 sm:h-8"
                      >
                        {isSavingCredential ? 'Saving...' : 'Connect'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowCredentialInput(false)
                          setCredentialValue('')
                        }}
                        disabled={isSavingCredential}
                        className="text-[10px] sm:text-xs h-7 sm:h-8"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {credStatus?.requires && credStatus.has && (
          <div className="p-2 sm:p-3 bg-green-500/10 border border-green-500/20 rounded-md">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-green-600 dark:text-green-400 text-xs sm:text-sm">✓</span>
              <p className="text-[10px] sm:text-xs text-green-700 dark:text-green-400 font-medium">
                {credStatus.typeName} configured
              </p>
            </div>
          </div>
        )}
        <div className="space-y-1.5 sm:space-y-2">
          <Label htmlFor="nodeLabel" className="text-xs sm:text-sm">Label</Label>
          <Input
            id="nodeLabel"
            value={label}
            onChange={(e) => updateLabel(e.target.value)}
            placeholder="Node label"
            className="text-xs sm:text-sm h-8 sm:h-10"
          />
        </div>
        {renderForm()}
      </CardContent>
    </Card>
  )
}

