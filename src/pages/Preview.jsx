import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useWorkflowSummary, useResetAll } from "@/store/app"
import { useToast } from "@/components/ToastProvider"
import { saveWorkflowDraft } from "@/lib/api"
import { saveWorkflowVersion, getWorkflowVersions, restoreWorkflowVersion } from "@/lib/versioning"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"

export function Preview() {
  const navigate = useNavigate()
  const workflow = useWorkflowSummary()
  const resetAll = useResetAll()
  const { showToast } = useToast()
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [versions, setVersions] = useState([])

  useEffect(() => {
    setVersions(getWorkflowVersions())
  }, [])

  const handleOpenBuilder = () => {
    navigate('/builder')
  }

  // React Query mutation for saving draft
  const saveDraftMutation = useMutation({
    mutationFn: saveWorkflowDraft,
    onSuccess: () => {
      showToast("Draft saved successfully!", "success")
    },
    onError: () => {
      showToast("Failed to save draft", "error")
    },
  })

  const handleBack = () => {
    navigate(-1)
  }

  const handleSaveDraft = () => {
    if (!workflow) return
    saveDraftMutation.mutate(workflow)
  }

  const handleStartOver = () => {
    resetAll()
    navigate("/")
  }

  const handleSaveVersion = () => {
    if (!workflow) return
    const version = saveWorkflowVersion(workflow)
    setVersions(getWorkflowVersions())
    showToast(`Saved as version: ${version.name}`, 'success')
  }

  const handleRestoreVersion = (versionId) => {
    const restored = restoreWorkflowVersion(versionId)
    if (restored) {
      // Restore to store - would need to navigate to builder or update store
      showToast('Version restored. Open in builder to see changes.', 'success')
      setVersionsOpen(false)
    }
  }

  // If no workflow, show empty state
  if (!workflow) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <h1 className="text-4xl font-bold mb-4">No Workflow to Preview</h1>
          <p className="text-muted-foreground mb-6">
            You haven't created a workflow yet. Choose a template or describe your task to get started.
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => navigate("/templates")}>Browse Templates</Button>
            <Button variant="outline" onClick={() => navigate("/chat")}>Describe a Task</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Button variant="outline" onClick={handleBack} className="mb-4">
          ← Back
        </Button>
        <h1 className="text-4xl font-bold mb-2">Workflow Summary</h1>
        <p className="text-muted-foreground">
          Review your automation workflow
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <CardTitle className="text-2xl">{workflow.name}</CardTitle>
                <Badge variant={workflow.source === "template" ? "default" : "secondary"}>
                  {workflow.source === "template" ? "From Template" : "From Chat"}
                </Badge>
              </div>
              <CardDescription>
                {workflow.notes || "No additional notes"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Trigger Section */}
          <div>
            <h3 className="font-semibold mb-2 text-sm uppercase tracking-wide text-muted-foreground">
              Trigger
            </h3>
            <p className="text-sm bg-muted p-3 rounded-md">
              {workflow.trigger}
            </p>
          </div>

          {/* Integrations Section */}
          {workflow.integrations && workflow.integrations.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2 text-sm uppercase tracking-wide text-muted-foreground">
                Integrations
              </h3>
              <div className="flex flex-wrap gap-2">
                {workflow.integrations.map((integration, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {integration}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Steps Section */}
          <div>
            <h3 className="font-semibold mb-2 text-sm uppercase tracking-wide text-muted-foreground">
              Steps
            </h3>
            <ol className="space-y-2">
              {workflow.steps.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="text-sm bg-muted p-2 rounded-md flex-1">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <Button 
          variant="outline" 
          className="flex-1 min-w-[120px]" 
          onClick={handleSaveDraft}
          disabled={saveDraftMutation.isPending}
        >
          {saveDraftMutation.isPending ? "Saving..." : "Save Draft"}
        </Button>
        <Button 
          variant="outline" 
          className="flex-1 min-w-[120px]"
          onClick={handleSaveVersion}
        >
          Save as Version
        </Button>
        <Button 
          variant="outline" 
          className="flex-1 min-w-[120px]"
          onClick={() => setVersionsOpen(true)}
        >
          View Versions
        </Button>
        <Button className="flex-1 min-w-[120px]" onClick={handleOpenBuilder}>
          Edit Workflow
        </Button>
        <Button variant="secondary" className="flex-1 min-w-[120px]" onClick={handleStartOver}>
          Start Over
        </Button>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground text-center">
          Click "Edit Workflow" to open the visual workflow builder.
        </p>
      </div>

      {/* Versions Dialog */}
      <Dialog open={versionsOpen} onOpenChange={setVersionsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Workflow Versions</DialogTitle>
            <DialogDescription>
              View and restore previous versions of this workflow
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto py-4">
            {versions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No versions saved yet
              </div>
            ) : (
              versions.map((version) => (
                <Card key={version.id} className="cursor-pointer hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{version.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(version.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestoreVersion(version.id)}
                      >
                        Restore
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
