// @ts-nocheck
import { useMemo, useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { checkNodeCredentials } from '@/utils/credentials'

const DESCRIPTIONS: Record<string, string> = {
  'trigger.facebook.comment': 'Start when a Facebook comment matches keywords',
  'trigger.webhook.inbound': 'Start from an inbound webhook request',
  'trigger.scheduler.cron': 'Start on a schedule (cron)',
  'trigger.sheets.newRow': 'Start when a new row is added to Google Sheets',
  'trigger.sheets.update': 'Start when Google Sheets is updated',
  'logic.filter': 'Branch or continue based on a condition',
  'ai.guard': 'Validate inputs or content with AI',
  'ai.generate': 'Generate content using AI',
  'action.facebook.reply': 'Reply to a Facebook comment',
  'action.facebook.dm': 'Send a direct message on Facebook',
  'action.telegram.sendMessage': 'Send message to Telegram chat',
  'action.telegram.sendPhoto': 'Send photo to Telegram chat',
  'action.telegram.sendDocument': 'Send document to Telegram chat',
  'action.telegram.sendLocation': 'Send location to Telegram chat',
  'action.telegram.sendPoll': 'Send poll to Telegram chat',
  'action.telegram.editMessage': 'Edit a Telegram message',
  'action.telegram.deleteMessage': 'Delete a Telegram message',
  'action.telegram.sendVideo': 'Send video to Telegram chat',
  'action.telegram.sendAudio': 'Send audio to Telegram chat',
  'action.telegram.sendSticker': 'Send sticker to Telegram chat',
  'action.telegram.sendVenue': 'Send venue to Telegram chat',
  'action.telegram.sendContact': 'Send contact to Telegram chat',
  'action.telegram.getUpdates': 'Get updates from Telegram bot',
  'action.email.send': 'Send an email message',
  'action.sheets.appendRow': 'Append a row to Google Sheets',
  'action.sheets.readRows': 'Read rows from Google Sheets',
  'action.sheets.updateCell': 'Update a cell in Google Sheets',
  'action.sheets.clearRange': 'Clear a range in Google Sheets',
  'action.http.request': 'HTTP request to external service',
}

const DEFAULT_CONFIGS: Record<string, any> = {
  'trigger.facebook.comment': { match: 'price|menu' },
  'trigger.webhook.inbound': { path: '/hook', secret: '' },
  'trigger.scheduler.cron': { cron: '0 9 * * *' },
  'trigger.sheets.newRow': { spreadsheetId: '', sheetName: 'Sheet1' },
  'trigger.sheets.update': { spreadsheetId: '', sheetName: 'Sheet1' },
  'logic.filter': { expression: 'payload.total > 0' },
  'ai.guard': { policy: 'no pii' },
  'ai.generate': { prompt: 'Write a short summary' },
  'action.facebook.reply': { replyTemplate: 'Thanks for your comment!' },
  'action.facebook.dm': { message: 'Hello! How can we help?' },
  'action.telegram.sendMessage': { chatId: '', message: 'Hello from workflow' },
  'action.telegram.sendPhoto': { chatId: '', photo: '', caption: '' },
  'action.telegram.sendDocument': { chatId: '', document: '', caption: '' },
  'action.telegram.sendLocation': { chatId: '', latitude: 0, longitude: 0 },
  'action.telegram.sendPoll': { chatId: '', question: 'Poll Question', options: ['Option 1', 'Option 2'] },
  'action.telegram.editMessage': { chatId: '', messageId: '', text: '' },
  'action.telegram.deleteMessage': { chatId: '', messageId: '' },
  'action.telegram.sendVideo': { chatId: '', video: '', caption: '' },
  'action.telegram.sendAudio': { chatId: '', audio: '', caption: '' },
  'action.telegram.sendSticker': { chatId: '', sticker: '' },
  'action.telegram.sendVenue': { chatId: '', latitude: 0, longitude: 0, title: '', address: '' },
  'action.telegram.sendContact': { chatId: '', phoneNumber: '', firstName: '' },
  'action.telegram.getUpdates': { offset: 0, limit: 100 },
  'action.email.send': { to: '', subject: 'Hello', body: 'Message' },
  'action.sheets.appendRow': { spreadsheetId: '', range: 'Sheet1!A1', values: [] },
  'action.sheets.readRows': { spreadsheetId: '', range: 'Sheet1!A1:Z1000' },
  'action.sheets.updateCell': { spreadsheetId: '', range: 'Sheet1!A1', value: '' },
  'action.sheets.clearRange': { spreadsheetId: '', range: 'Sheet1!A1:Z1000' },
  'action.http.request': { url: 'https://api.example.com', method: 'POST', headers: {}, body: {} },
}

const GROUPS: { title: string; items: { kind: string; label: string }[] }[] = [
  {
    title: 'Triggers',
    items: [
      { kind: 'trigger.facebook.comment', label: 'Facebook Comment' },
      { kind: 'trigger.webhook.inbound', label: 'Webhook' },
      { kind: 'trigger.scheduler.cron', label: 'Schedule' },
      { kind: 'trigger.sheets.newRow', label: 'Sheets: New Row' },
      { kind: 'trigger.sheets.update', label: 'Sheets: Update' },
    ],
  },
  {
    title: 'Logic / AI',
    items: [
      { kind: 'logic.filter', label: 'Filter' },
      { kind: 'ai.guard', label: 'AI Guard' },
      { kind: 'ai.generate', label: 'AI Generate' },
    ],
  },
  {
    title: 'Telegram Actions',
    items: [
      { kind: 'action.telegram.sendMessage', label: 'Send Message' },
      { kind: 'action.telegram.sendPhoto', label: 'Send Photo' },
      { kind: 'action.telegram.sendVideo', label: 'Send Video' },
      { kind: 'action.telegram.sendAudio', label: 'Send Audio' },
      { kind: 'action.telegram.sendDocument', label: 'Send Document' },
      { kind: 'action.telegram.sendLocation', label: 'Send Location' },
      { kind: 'action.telegram.sendVenue', label: 'Send Venue' },
      { kind: 'action.telegram.sendContact', label: 'Send Contact' },
      { kind: 'action.telegram.sendPoll', label: 'Send Poll' },
      { kind: 'action.telegram.sendSticker', label: 'Send Sticker' },
      { kind: 'action.telegram.editMessage', label: 'Edit Message' },
      { kind: 'action.telegram.deleteMessage', label: 'Delete Message' },
      { kind: 'action.telegram.getUpdates', label: 'Get Updates' },
    ],
  },
  {
    title: 'Google Sheets Actions',
    items: [
      { kind: 'action.sheets.appendRow', label: 'Append Row' },
      { kind: 'action.sheets.readRows', label: 'Read Rows' },
      { kind: 'action.sheets.updateCell', label: 'Update Cell' },
      { kind: 'action.sheets.clearRange', label: 'Clear Range' },
    ],
  },
  {
    title: 'Other Actions',
    items: [
      { kind: 'action.facebook.reply', label: 'Facebook Reply' },
      { kind: 'action.facebook.dm', label: 'Facebook DM' },
      { kind: 'action.email.send', label: 'Email: Send' },
      { kind: 'action.http.request', label: 'HTTP Request' },
    ],
  },
]

export default function NodeCatalog() {
  const [query, setQuery] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  
  // Refresh when secrets are updated
  useEffect(() => {
    const handleSecretsUpdate = () => {
      setRefreshKey(prev => prev + 1)
    }
    window.addEventListener('secrets-updated', handleSecretsUpdate)
    window.addEventListener('storage', handleSecretsUpdate)
    return () => {
      window.removeEventListener('secrets-updated', handleSecretsUpdate)
      window.removeEventListener('storage', handleSecretsUpdate)
    }
  }, [])
  
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return GROUPS
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((it) => it.label.toLowerCase().includes(q) || it.kind.toLowerCase().includes(q)),
    }))
  }, [query, refreshKey])

  const onDragStart = (event: React.DragEvent, kind: string) => {
    const payload = JSON.stringify({ kind, config: DEFAULT_CONFIGS[kind] || {} })
    event.dataTransfer.setData('application/reactflow', payload)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nodes..."
        />
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {filtered.map((group) => (
          <div key={group.title}>
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">{group.title}</div>
            <div className="grid grid-cols-1 gap-2">
              {group.items.map((it) => {
                const credStatus = checkNodeCredentials(it.kind)
                return (
                  <Card
                    key={it.kind}
                    className="p-3 cursor-grab active:cursor-grabbing"
                    draggable
                    onDragStart={(e) => onDragStart(e, it.kind)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium flex-1">{it.label}</div>
                      {credStatus.requires && (
                        <Badge 
                          variant={credStatus.has ? "default" : "destructive"} 
                          className="text-xs shrink-0"
                        >
                          {credStatus.has ? "✓" : "🔑"}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{DESCRIPTIONS[it.kind]}</div>
                    {credStatus.requires && !credStatus.has && (
                      <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        Requires {credStatus.typeName}
                      </div>
                    )}
                  </Card>
                )
              })}
              {group.items.length === 0 && (
                <div className="text-xs text-muted-foreground">No matches</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


