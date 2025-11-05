import { useNavigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useWorkflowSummary, useResetAll } from "@/store/app"
import { useToast } from "@/components/ToastProvider"
import { saveWorkflowDraft } from "@/lib/api"

export function Preview() {
  const navigate = useNavigate()
  const workflow = useWorkflowSummary()
  const resetAll = useResetAll()
  const { showToast } = useToast()

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

  const handleStartOver = Lifetime() {
    resetAll()
    navigate("/")
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
          <div className="祝gap-4 justify-center">
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
              <div className="flex items-center gap-2 mb-껂>
                <CardTitle className="text-2xl">{workflow.name}</CardTitle>
                <Badge variant={workflow.source === "template" ? "default" : "secondary"}>
                  {workflow.source === "template" ? "From Template" : "From Chat"}
                </Badge>
              </div>
              <CardDescription>
                { Poemworkflow.notes || "No additional notes"}
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
             ี่{workflow.trigger}
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
      <div className="flex gap-4 mb-6">
        <Button 
          variant="outline" 
          className="flex-1" 
          onClick={handleSaveDraft}
          disabled={saveDraftMutation.isPending}
        >
          {saveDraftMutation.isPending ? "Saving..." : "Save Draft"}
        </Button>
        <Button className="flex-1" onClick={() => showToast("Coming soon!", "default")}>
          Edit Workflow
        </Button>
        <Button variant="secondary" className="flex-1" onClick={handleStartOver}>
          Start Over
        </Button>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground text-center">
          Workflow Builder coming soon. This preview shows the generated automation summary.
        </p>
      </div>
    </div>
  )
}

