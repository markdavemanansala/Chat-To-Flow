import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard"

export function Home() {
  const [showOnboarding, setShowOnboarding] = useState(false)
  
  // Check if user is new (no workflows saved)
  useEffect(() => {
    const hasWorkflows = localStorage.getItem('workflow_drafts') || localStorage.getItem('workflow_versions')
    const hasSeenOnboarding = localStorage.getItem('has_seen_onboarding')
    if (!hasWorkflows && !hasSeenOnboarding) {
      // Auto-show on first visit, or they can click the button
      // setShowOnboarding(true)
    }
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="text-center mb-8 space-y-4">
        <h1 className="text-3xl md:text-4xl font-bold">AI Agent Builder</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Create powerful automations with AI assistance
        </p>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            setShowOnboarding(true)
            localStorage.setItem('has_seen_onboarding', 'true')
          }}
        >
          🚀 Take a 60-second tour
        </Button>
      </div>
      
      <div className="grid md:grid-cols-2 gap-4">
        <Link to="/templates" className="group">
          <Card className="h-full hover:shadow-lg transition-all cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl md:text-2xl">Use a Template</CardTitle>
              <CardDescription className="text-sm">
                Start with a pre-built automation template
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-3">
              <p className="text-sm text-muted-foreground line-clamp-3">
                Browse ready-to-use templates for common workflows. Customize them to fit your needs.
              </p>
            </CardContent>
            <CardFooter>
              <Button className="w-full group-hover:bg-primary/90 text-sm">
                Browse Templates →
              </Button>
            </CardFooter>
          </Card>
        </Link>

        <Link to="/chat" className="group">
          <Card className="h-full hover:shadow-lg transition-all cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl md:text-2xl">Describe in Chat</CardTitle>
              <CardDescription className="text-sm">
                Build custom automation through conversation
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-3">
              <p className="text-sm text-muted-foreground line-clamp-3">
                Describe what you want to automate. AI will build it for you in minutes.
              </p>
            </CardContent>
            <CardFooter>
              <Button className="w-full group-hover:bg-primary/90 text-sm">
                Start Chatting →
              </Button>
            </CardFooter>
          </Card>
        </Link>
      </div>

      <OnboardingWizard open={showOnboarding} onOpenChange={setShowOnboarding} />
    </div>
  )
}
