import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

export function GuidedTemplateChecklist({ template, onComplete }) {
  const [step1Complete, setStep1Complete] = useState(false)
  const [step2Complete, setStep2Complete] = useState(false)
  const [pageId, setPageId] = useState('')
  const [selectedSheet, setSelectedSheet] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const sheets = ['Sheet 1', 'Sheet 2', 'Sheet 3'] // Mock data

  const handleComplete = async () => {
    if (step1Complete && step2Complete && onComplete) {
      setIsGenerating(true)
      try {
        // Pass checklist data to onComplete, which will generate the workflow
        await onComplete({ pageId, selectedSheet })
      } finally {
        setIsGenerating(false)
      }
    }
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Setup Checklist</h3>
          <Badge variant="outline">
            {step1Complete && step2Complete ? 'Complete' : 'In Progress'}
          </Badge>
        </div>

        {/* Step 1: Fill Page ID */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={step1Complete}
              onChange={(e) => setStep1Complete(e.target.checked)}
              className="w-4 h-4"
            />
            <Label>Step 1: Fill Page ID</Label>
          </div>
          {!step1Complete && (
            <div className="ml-6 space-y-2">
              <Input
                placeholder="Enter your Facebook Page ID"
                value={pageId}
                onChange={(e) => {
                  setPageId(e.target.value)
                  if (e.target.value.trim()) {
                    setStep1Complete(true)
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Find your Page ID in your Facebook Page settings
              </p>
            </div>
          )}
        </div>

        {/* Step 2: Pick Sheet */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={step2Complete}
              onChange={(e) => setStep2Complete(e.target.checked)}
              className="w-4 h-4"
            />
            <Label>Step 2: Pick Sheet</Label>
          </div>
          {!step2Complete && (
            <div className="ml-6 space-y-2">
              <select
                className="w-full px-3 py-2 border rounded-md bg-background text-foreground [&>option]:bg-background [&>option]:text-foreground"
                value={selectedSheet}
                onChange={(e) => {
                  setSelectedSheet(e.target.value)
                  if (e.target.value) {
                    setStep2Complete(true)
                  }
                }}
              >
                <option value="">Select a sheet...</option>
                {sheets.map((sheet) => (
                  <option key={sheet} value={sheet}>{sheet}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Choose the Google Sheet to sync data with
              </p>
            </div>
          )}
        </div>

        {step1Complete && step2Complete && (
          <Button onClick={handleComplete} className="w-full" disabled={isGenerating}>
            {isGenerating ? "Generating Workflow..." : "Continue"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

