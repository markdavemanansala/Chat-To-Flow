import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

const shortcuts = [
  { keys: ['?'], action: 'Show keyboard shortcuts' },
  { keys: ['Ctrl', 'Z'], action: 'Undo' },
  { keys: ['Ctrl', 'Y'], action: 'Redo' },
  { keys: ['Ctrl', 'S'], action: 'Save draft' },
  { keys: ['Ctrl', 'E'], action: 'Export JSON' },
  { keys: ['Delete'], action: 'Delete selected nodes/edges' },
  { keys: ['Backspace'], action: 'Delete selected nodes/edges' },
  { keys: ['F'], action: 'Fit view to canvas' },
  { keys: ['V'], action: 'Validate workflow' },
]

export function ShortcutsHelp({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Speed up your workflow with these shortcuts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm">{shortcut.action}</span>
              <div className="flex gap-1">
                {shortcut.keys.map((key, keyIndex) => (
                  <Badge key={keyIndex} variant="outline" className="font-mono text-xs">
                    {key}
                    {keyIndex < shortcut.keys.length - 1 && <span className="ml-1">+</span>}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

