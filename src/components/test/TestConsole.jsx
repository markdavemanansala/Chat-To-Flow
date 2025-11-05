import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useNodes } from "@/store/app"
import { useToast } from "@/components/ToastProvider"

export function TestConsole({ open, onToggle }) {
  const nodes = useNodes()
  const { showToast } = useToast()
  const [testResults, setTestResults] = useState(null)
  const [isRunning, setIsRunning] = useState(false)

  const handleRunTest = async () => {
    setIsRunning(true)
    setTestResults(null)
    showToast('Running test with sample data...', 'default')

    // Mock test execution
    const results = nodes.map((node, index) => ({
      nodeId: node.id,
      nodeLabel: node.data?.label || node.id,
      status: Math.random() > 0.3 ? 'success' : 'error',
      inputs: { sample: 'test data', timestamp: new Date().toISOString() },
      outputs: { result: 'processed', index },
      error: Math.random() > 0.3 ? null : 'Mock error: Connection timeout',
      duration: Math.floor(Math.random() * 1000) + 100,
    }))

    setTimeout(() => {
      setTestResults(results)
      setIsRunning(false)
      const successCount = results.filter(r => r.status === 'success').length
      showToast(`Test completed: ${successCount}/${results.length} nodes passed`, 'success')
    }, 2000)
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className="fixed bottom-4 right-4 z-50"
      >
        Open Test Console
      </Button>
    )
  }

  return (
    <div className="fixed bottom-0 right-0 w-96 h-96 bg-background border-t border-l shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <CardTitle className="text-sm font-semibold">Test Console</CardTitle>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={handleRunTest}
            disabled={isRunning || nodes.length === 0}
          >
            {isRunning ? 'Running...' : 'Run Test'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onToggle}>
            ✕
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {!testResults && !isRunning && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Click "Run Test" to execute with sample data
          </div>
        )}

        {isRunning && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Running test...
          </div>
        )}

        {testResults && (
          <div className="space-y-3">
            {testResults.map((result) => (
              <Card key={result.nodeId} className="text-xs">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{result.nodeLabel}</CardTitle>
                    <Badge 
                      variant={result.status === 'success' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {result.status === 'success' ? '✓' : '✗'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Inputs:</div>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(result.inputs, null, 2)}
                    </pre>
                  </div>
                  {result.outputs && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Outputs:</div>
                      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                        {JSON.stringify(result.outputs, null, 2)}
                      </pre>
                    </div>
                  )}
                  {result.error && (
                    <div>
                      <div className="text-xs font-medium text-destructive mb-1">Error:</div>
                      <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2 rounded">
                        {result.error}
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Duration: {result.duration}ms
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
