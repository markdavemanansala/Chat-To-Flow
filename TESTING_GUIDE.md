# Testing Guide - Step by Step

## Dev Server Status
✅ Dev server should be running (started in background)
🌐 Open your browser to the URL shown in the terminal (typically `http://localhost:5173`)

---

## Testing Checklist - Start Here

### 1. Home Page Test (`/`)
**URL**: `http://localhost:5173/`

**What to Test**:
- [ ] Page loads without errors
- [ ] Title "AI Agent Builder" displays
- [ ] Two cards visible: "Use a Template" and "Describe in Chat"
- [ ] Click "Browse Templates →" - should navigate to `/templates`
- [ ] Click "Start Chatting →" - should navigate to `/chat`
- [ ] Click "🚀 Take a 60-second tour" - onboarding wizard should open

**Expected Result**: Page loads correctly, navigation works

---

### 2. Chat Page Test (`/chat`) ⚠️ **MAIN FOCUS**
**URL**: `http://localhost:5173/chat`

**What to Test**:

#### A. Initial Load
- [ ] Page loads without errors
- [ ] Welcome message displays: "Hello! I'm your AI workflow automation assistant..."
- [ ] Input field is visible and enabled
- [ ] "Send" button is visible
- [ ] Workflow Preview panel on the right is visible (empty state)

#### B. Create New Workflow
Try typing: **"Save Facebook comments to Google Sheets"**

- [ ] Message appears in chat
- [ ] AI response appears (or loading indicator)
- [ ] Workflow nodes appear in the preview panel on the right
- [ ] Nodes are connected with edges
- [ ] Success message appears in chat

#### C. Modify Existing Workflow
After creating a workflow, try: **"Remove the Google Sheets node"** or **"Delete the last step"**

- [ ] Message appears in chat
- [ ] AI processes the request
- [ ] Node is removed from preview
- [ ] Preview updates in real-time
- [ ] Confirmation message appears

#### D. Add to Workflow
Try: **"Add a validation step"** or **"Add email notification"**

- [ ] Message appears in chat
- [ ] New node is added to workflow
- [ ] Preview updates correctly
- [ ] Nodes are properly connected

#### E. Multiple Messages
- [ ] Send multiple messages in sequence
- [ ] Conversation context is maintained
- [ ] Workflow updates correctly with each message
- [ ] No duplicate nodes or errors

#### F. Navigation Buttons
- [ ] "Edit in Builder" button appears when workflow exists
- [ ] "View Summary" button appears when workflow exists
- [ ] Clicking "Edit in Builder" navigates to `/builder`
- [ ] Clicking "View Summary" navigates to `/preview`

**Known Issues to Watch For**:
- ❌ Preview not updating when nodes are added/removed
- ❌ Chat messages not appearing
- ❌ Errors in browser console
- ❌ Workflow not generating
- ❌ Nodes not removing when requested

---

### 3. Templates Page Test (`/templates`)
**URL**: `http://localhost:5173/templates`

**What to Test**:
- [ ] Page loads without errors
- [ ] Template cards are visible
- [ ] Search box works - type "facebook" and see filtered results
- [ ] Industry filter pills work - click "F&B" and see filtered results
- [ ] Click "Use Template" on a template
- [ ] If template has variables, guided checklist appears
- [ ] After using template, navigates to `/preview`
- [ ] Workflow is created correctly

**Expected Result**: Templates load, filtering works, workflow generation works

---

### 4. Builder Page Test (`/builder`)
**URL**: `http://localhost:5173/builder`

**What to Test**:
- [ ] Page loads without errors
- [ ] Canvas is visible
- [ ] Left panel has "Chat" and "Catalog" tabs
- [ ] Can switch between Chat and Catalog tabs
- [ ] Node catalog shows different node types
- [ ] Can drag nodes from catalog to canvas
- [ ] Can connect nodes by dragging from handle to handle
- [ ] Can select nodes (click on them)
- [ ] Node inspector panel appears when node is selected
- [ ] Can modify node properties in inspector
- [ ] Toolbar buttons work (Connect Accounts, Secrets, Test, Shortcuts)

**Expected Result**: Visual builder works, nodes can be added and connected

---

### 5. Preview Page Test (`/preview`)
**URL**: `http://localhost:5173/preview`

**What to Test**:
- [ ] Page loads without errors
- [ ] If no workflow, shows empty state
- [ ] If workflow exists, shows:
  - [ ] Workflow name
  - [ ] Trigger section
  - [ ] Steps list (numbered)
  - [ ] Integrations badges
- [ ] "Save Draft" button works
- [ ] "Save as Version" button works
- [ ] "View Versions" button opens dialog
- [ ] "Edit Workflow" button navigates to `/builder`
- [ ] "Start Over" button resets everything

**Expected Result**: Preview displays workflow correctly, all buttons work

---

### 6. My Workflows Page Test (`/workflows`)
**URL**: `http://localhost:5173/workflows`

**What to Test**:
- [ ] Page loads without errors
- [ ] Tabs are visible: "All", "Templates", "Drafts", "Live Agents"
- [ ] Can switch between tabs
- [ ] Templates section shows built-in templates
- [ ] Drafts section shows saved drafts (if any)
- [ ] Search box filters results
- [ ] Can delete drafts
- [ ] Can open drafts

**Expected Result**: Workflows page displays correctly, tabs and search work

---

## Browser Console Checks

**Open Browser DevTools (F12) and check Console tab:**

### ✅ Good Signs:
- No red errors
- Console logs showing workflow operations (look for emoji logs like 🚀, ✅, 📦)
- Zustand store updates logged

### ❌ Bad Signs:
- Red error messages
- "Cannot read property of undefined"
- "Maximum update depth exceeded"
- Network errors (404, 500)
- React errors

---

## Common Issues & Solutions

### Issue: Chat page not loading
**Check**: Browser console for errors
**Solution**: Check if all imports are correct

### Issue: Workflow preview not updating
**Check**: Browser console for Zustand store logs
**Solution**: Check if `useNodes()` and `useEdges()` hooks are working

### Issue: Nodes not removing
**Check**: Console for patch application logs
**Solution**: Check `applyPatch` function in store

### Issue: AI responses not working
**Check**: Is `VITE_OPENAI_API_KEY` set in `.env`?
**Solution**: App should work without OpenAI (basic mode)

---

## Testing Priority

1. **HIGH**: Chat Page - Main reported issue
2. **MEDIUM**: State Management - Check if Zustand store works
3. **MEDIUM**: Workflow Patch System - Check if patches apply correctly
4. **LOW**: Other pages - Should work if core is fixed

---

## Report Issues

When you find an issue, note:
1. **Page/Feature**: Which page or feature
2. **What you did**: Steps to reproduce
3. **Expected**: What should happen
4. **Actual**: What actually happened
5. **Console Errors**: Any errors in browser console
6. **Screenshot**: If possible

---

## Next Steps After Testing

1. Document all issues found
2. Prioritize fixes
3. Fix issues one by one
4. Re-test after each fix

