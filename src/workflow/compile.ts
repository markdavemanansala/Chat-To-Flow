import type { Edge, Node } from 'reactflow'
import { createNode, connect } from './utils'

type NodeKind =
  | 'trigger.facebook.comment'
  | 'trigger.webhook.inbound'
  | 'trigger.scheduler.cron'
  | 'trigger.sheets.newRow'
  | 'trigger.sheets.update'
  | 'logic.filter'
  | 'ai.guard'
  | 'ai.generate'
  | 'action.facebook.reply'
  | 'action.facebook.dm'
  | 'action.telegram.sendMessage'
  | 'action.telegram.sendPhoto'
  | 'action.telegram.sendVideo'
  | 'action.telegram.sendAudio'
  | 'action.telegram.sendDocument'
  | 'action.telegram.sendLocation'
  | 'action.telegram.sendVenue'
  | 'action.telegram.sendContact'
  | 'action.telegram.sendPoll'
  | 'action.telegram.sendSticker'
  | 'action.telegram.editMessage'
  | 'action.telegram.deleteMessage'
  | 'action.telegram.getUpdates'
  | 'action.email.send'
  | 'action.sheets.appendRow'
  | 'action.sheets.readRows'
  | 'action.sheets.updateCell'
  | 'action.sheets.clearRange'
  | 'action.http.request'

type NodeConfig = Record<string, any>

export type RfNodeData = { kind: NodeKind; label: string; config: NodeConfig }
export type RfEdgeData = { label?: string }

export type WorkflowSummary = {
  name: string
  trigger: string
  steps: string[]
  integrations: string[]
  notes?: string
  source: 'template' | 'chat'
}

function titleCaseWords(words: string): string {
  return words
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function integrationsFromKinds(kinds: string[]): string[] {
  const map: Record<string, string> = {
    'trigger.facebook.comment': 'Facebook',
    'trigger.sheets.newRow': 'Google Sheets',
    'trigger.sheets.update': 'Google Sheets',
    'action.facebook.reply': 'Facebook',
    'action.facebook.dm': 'Facebook',
    'action.telegram.sendMessage': 'Telegram',
    'action.telegram.sendPhoto': 'Telegram',
    'action.telegram.sendVideo': 'Telegram',
    'action.telegram.sendAudio': 'Telegram',
    'action.telegram.sendDocument': 'Telegram',
    'action.telegram.sendLocation': 'Telegram',
    'action.telegram.sendVenue': 'Telegram',
    'action.telegram.sendContact': 'Telegram',
    'action.telegram.sendPoll': 'Telegram',
    'action.telegram.sendSticker': 'Telegram',
    'action.telegram.editMessage': 'Telegram',
    'action.telegram.deleteMessage': 'Telegram',
    'action.telegram.getUpdates': 'Telegram',
    'action.sheets.appendRow': 'Google Sheets',
    'action.sheets.readRows': 'Google Sheets',
    'action.sheets.updateCell': 'Google Sheets',
    'action.sheets.clearRange': 'Google Sheets',
    'action.email.send': 'Email',
    'action.http.request': 'HTTP',
  }
  const set = new Set<string>()
  kinds.forEach((k) => map[k] && set.add(map[k]))
  return Array.from(set)
}

export function compileIntentToFlow(intent: string): {
  nodes: Node<RfNodeData>[]
  edges: Edge<RfEdgeData>[]
  summary: WorkflowSummary
} {
  const text = intent.toLowerCase()
  const nodes: Node<RfNodeData>[] = []
  const edges: Edge<RfEdgeData>[] = []

  let cursorX = 100
  const y = 100

  // Trigger
  let triggerLabel = 'Manual trigger'
  if (text.includes('facebook') || text.includes('comment')) {
    const trig = createNode('trigger.facebook.comment', {
      id: 'trigger_0',
      position: { x: cursorX, y },
    }) as Node<RfNodeData>
    nodes.push(trig)
    triggerLabel = 'Facebook Comment (with keyword)'
    cursorX += 250
  }

  // Actions
  const actionKinds: NodeKind[] = []
  if (text.includes('facebook') || text.includes('comment')) {
    actionKinds.push('action.facebook.reply')
  }
  if (text.includes('dm')) {
    actionKinds.push('action.facebook.dm')
  }
  if (text.includes('sheet') || text.includes('google')) {
    actionKinds.push('action.sheets.appendRow')
  }
  if (text.includes('email')) {
    actionKinds.push('action.email.send')
  }
  // Always add placeholder http request
  actionKinds.push('action.http.request')

  const startIndex = nodes.length
  actionKinds.forEach((kind, i) => {
    const node = createNode(kind, {
      position: { x: cursorX + i * 250, y },
    }) as Node<RfNodeData>
    nodes.push(node)
  })

  // Chain edges linearly
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push(connect(nodes[i].id, nodes[i + 1].id))
  }

  const kinds = nodes.map((n) => n.data.kind)
  const integrations = integrationsFromKinds(kinds)

  const name = titleCaseWords(intent.split(' ').slice(0, 6).join(' ')) || 'New Workflow'
  const steps = nodes
    .map((n) => n.data)
    .filter((d) => !d.kind.startsWith('trigger'))
    .map((d) => d.label)

  const summary: WorkflowSummary = {
    name,
    trigger: triggerLabel,
    steps,
    integrations,
    notes: `Generated from: "${intent}"`,
    source: 'chat',
  }

  return { nodes, edges, summary }
}


