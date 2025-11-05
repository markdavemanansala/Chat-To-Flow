import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useNodes } from "@/store/app"
import { useToast } from "@/components/ToastProvider"

export function ValidationHealthBar({ onValidate }) {
  const nodes = useNodes()
  const { showToast } = useToast()

  const healthStatus = useMemo(() => {
    const triggers = nodes.filter(n => n.data?.kind?.startsWith('trigger'))
    const hasTrigger = triggers.length === 1
    
    // Check for missing credentials
    let missingCredsCount = 0
    try {
      const secrets = JSON.parse(localStorage.getItem('workflow_secrets') || '[]')
      missingCredsCount = nodes.filter(n => {
        const requiresCreds = n.data?.kind && (
          n.data.kind.includes('facebook') ||
          n.data.kind.includes('telegram') ||
          n.data.kind.includes('email') ||
          n.data.kind.includes('sheets') ||
          n.data.kind.includes('api')
        )
        if (!requiresCreds) return false
        
        const hasSecret = secrets.some(secret => 
          secret.nodeKinds && secret.nodeKinds.includes(n.data.kind)
        )
        return !hasSecret
      }).length
    } catch (e) {
      console.error('Failed to check secrets', e)
    }

    return {
      hasTrigger,
      orphanCount: 0, // Simplified - would need edges to check properly
      missingCredsCount,
    }
  }, [nodes])

  const handleValidate = () => {
    const triggers = nodes.filter(n => n.data?.kind?.startsWith('trigger'))
    const actions = nodes.filter(n => n.data?.kind?.startsWith('action'))

    let issues = []
    if (triggers.length === 0) {
      issues.push('No trigger found')
    } else if (triggers.length > 1) {
      issues.push(`Multiple triggers found (${triggers.length})`)
    }
    if (actions.length === 0) {
      issues.push('No actions found')
    }

    // Check for missing credentials
    try {
      const secrets = JSON.parse(localStorage.getItem('workflow_secrets') || '[]')
      const missingCredsNodes = nodes.filter(n => {
        const requiresCreds = n.data?.kind && (
          n.data.kind.includes('facebook') ||
          n.data.kind.includes('telegram') ||
          n.data.kind.includes('email') ||
          n.data.kind.includes('sheets') ||
          n.data.kind.includes('api')
        )
        if (!requiresCreds) return false
        
        const hasSecret = secrets.some(secret => 
          secret.nodeKinds && secret.nodeKinds.includes(n.data.kind)
        )
        return !hasSecret
      })

      if (missingCredsNodes.length > 0) {
        issues.push(`${missingCredsNodes.length} node(s) missing credentials`)
      }
    } catch (e) {
      console.error('Failed to check secrets', e)
    }

    if (issues.length === 0) {
      showToast('✓ Validation passed!', 'success')
    } else {
      showToast(`Validation failed: ${issues.join(', ')}`, 'error')
    }

    if (onValidate) {
      onValidate(issues)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30">
      <span className="text-sm font-medium">Health:</span>
      
      {healthStatus.hasTrigger ? (
        <Badge variant="default" className="bg-primary/80 hover:bg-primary">
          ✓ Trigger
        </Badge>
      ) : (
        <Badge variant="destructive">
          ⚠ No Trigger
        </Badge>
      )}

      {healthStatus.orphanCount > 0 && (
        <Badge variant="outline" className="bg-accent/50">
          ⚠ {healthStatus.orphanCount} Orphan nodes
        </Badge>
      )}

      {healthStatus.missingCredsCount > 0 && (
        <Badge variant="destructive">
          ❗ {healthStatus.missingCredsCount} Missing creds
        </Badge>
      )}

      <div className="ml-auto">
        <Button size="sm" variant="outline" onClick={handleValidate}>
          Validate
        </Button>
      </div>
    </div>
  )
}

