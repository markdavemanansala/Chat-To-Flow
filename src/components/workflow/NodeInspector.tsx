// @ts-nocheck
import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useUpsertNode } from '@/store/app'
import { useToast } from '@/components/ToastProvider'
import { checkNodeCredentials } from '@/utils/credentials'
import type { Node } from 'reactflow'

interface NodeInspectorProps {
  selectedNode: Node | null
}

interface NodeInspectorWithSecretsProps extends NodeInspectorProps {
  onOpenSecrets?: () => void
}

export default function NodeInspector({ selectedNode, onOpenSecrets }: NodeInspectorWithSecretsProps) {
  const upsertNode = useUpsertNode()
  const { showToast } = useToast()
  const [config, setConfig] = useState<any>({})
  const [label, setLabel] = useState('')
  const [credStatus, setCredStatus] = useState<{ requires: boolean; has: boolean; typeName: string } | null>(null)

  useEffect(() => {
    if (selectedNode) {
      setConfig(selectedNode.data?.config || {})
      setLabel(selectedNode.data?.label || '')
      
      // Check credentials status
      const kind = selectedNode.data?.kind || ''
      const status = checkNodeCredentials(kind)
      setCredStatus(status)
      
      // Alert user if credentials are missing when node is first selected
      if (status.requires && !status.has) {
        setTimeout(() => {
          showToast(
            `⚠️ This node requires ${status.typeName}. Click "Manage Secrets" to add credentials.`,
            'warning',
            5000
          )
        }, 300)
      }
    }
  }, [selectedNode, showToast])

  if (!selectedNode) {
    return (
      <Card className="border-t">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground text-center">Select a node to edit its configuration</p>
        </CardContent>
      </Card>
    )
  }

  const kind = selectedNode.data?.kind || ''
  const updateNode = (updates: { config?: any; label?: string }) => {
    if (!selectedNode) return
    const updated = {
      ...selectedNode,
      data: {
        ...selectedNode.data,
        label: updates.label !== undefined ? updates.label : selectedNode.data?.label,
        config: { ...config, ...updates.config },
      },
    }
    upsertNode(updated)
    if (updates.config) {
      setConfig({ ...config, ...updates.config })
    }
    if (updates.label !== undefined) {
      setLabel(updates.label)
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
            <div className="space-y-2">
              <Label htmlFor="pageId">Page ID</Label>
              <Input
                id="pageId"
                value={config.pageId || ''}
                onChange={(e) => updateConfig('pageId', e.target.value)}
                placeholder="Facebook Page ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="matchContains">Match Contains</Label>
              <Input
                id="matchContains"
                value={config.match?.contains || ''}
                onChange={(e) => updateConfig('match', { ...config.match, contains: e.target.value })}
                placeholder="price|menu"
              />
            </div>
          </>
        )

      case 'action.facebook.reply':
        return (
          <div className="space-y-2">
            <Label htmlFor="replyTemplate">Reply Template</Label>
            <Textarea
              id="replyTemplate"
              value={config.replyTemplate || ''}
              onChange={(e) => updateConfig('replyTemplate', e.target.value)}
              placeholder="Thanks for your comment!"
              rows={3}
            />
          </div>
        )

      case 'action.sheets.appendRow':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="spreadsheetId">Spreadsheet ID</Label>
              <Input
                id="spreadsheetId"
                value={config.spreadsheetId || ''}
                onChange={(e) => updateConfig('spreadsheetId', e.target.value)}
                placeholder="988123abc..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="range">Range</Label>
              <Input
                id="range"
                value={config.range || ''}
                onChange={(e) => updateConfig('range', e.target.value)}
                placeholder="Sheet1!A1"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Map (Key → Expression)</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newMap = { ...(config.map || {}), '': '' }
                    updateConfig('map', newMap)
                  }}
                >
                  + Add
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                {Object.entries(config.map || {}).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No mappings yet</p>
                ) : (
                  Object.entries(config.map || {}).map(([key, val], idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={key}
                        onChange={(e) => {
                          const newMap = { ...(config.map || {}) }
                          delete newMap[key]
                          newMap[e.target.value] = val
                          updateConfig('map', newMap)
                        }}
                        placeholder="Column/Key"
                        className="text-xs"
                      />
                      <Input
                        value={val || ''}
                        onChange={(e) => {
                          const newMap = { ...(config.map || {}), [key]: e.target.value }
                          updateConfig('map', newMap)
                        }}
                        placeholder="Expression"
                        className="text-xs"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const newMap = { ...(config.map || {}) }
                          delete newMap[key]
                          updateConfig('map', newMap)
                        }}
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
            <div className="space-y-2">
              <Label htmlFor="toExpr">To (Expression)</Label>
              <Input
                id="toExpr"
                value={config.toExpr || ''}
                onChange={(e) => updateConfig('toExpr', e.target.value)}
                placeholder="payload.email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subjectTpl">Subject Template</Label>
              <Input
                id="subjectTpl"
                value={config.subjectTpl || ''}
                onChange={(e) => updateConfig('subjectTpl', e.target.value)}
                placeholder="Hello {{name}}"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bodyTpl">Body Template</Label>
              <Textarea
                id="bodyTpl"
                value={config.bodyTpl || ''}
                onChange={(e) => updateConfig('bodyTpl', e.target.value)}
                placeholder="Message body..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="html"
                  checked={config.html || false}
                  onChange={(e) => updateConfig('html', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="html" className="cursor-pointer">HTML Email</Label>
              </div>
            </div>
          </>
        )

      case 'action.http.request':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="method">Method</Label>
              <select
                id="method"
                value={config.method || 'POST'}
                onChange={(e) => updateConfig('method', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm [&>option]:bg-background [&>option]:text-foreground"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                type="url"
                value={config.url || ''}
                onChange={(e) => updateConfig('url', e.target.value)}
                placeholder="https://api.ba.com/endpoint"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="headers">Headers (JSON)</Label>
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
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Body (JSON)</Label>
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
                className="font-mono text-xs"
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
    <Card className="border-t">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">Node Configuration</CardTitle>
            <CardDescription className="text-xs">{kind}</CardDescription>
          </div>
          {credStatus?.requires && !credStatus.has && (
            <Badge variant="destructive" className="text-xs">
              ⚠️ Missing {credStatus.typeName}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {credStatus?.requires && !credStatus.has && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-1">
                  ⚠️ Credentials Required
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-500">
                  This node requires {credStatus.typeName} to function. Add your credentials in the Secrets Manager.
                </p>
              </div>
              {onOpenSecrets && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onOpenSecrets}
                  className="shrink-0 text-xs"
                >
                  Manage Secrets
                </Button>
              )}
            </div>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="nodeLabel">Label</Label>
          <Input
            id="nodeLabel"
            value={label}
            onChange={(e) => updateLabel(e.target.value)}
            placeholder="Node label"
          />
        </div>
        {renderForm()}
      </CardContent>
    </Card>
  )
}

