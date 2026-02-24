# Frontend Fixes Plan

## Context
Multiple UI/UX issues on the EasyClaw React Native app need fixing: layout problems on chat, sidebar, and skills pages, session persistence, modal flow for skill installation, and category search behavior.

---

## 1. Fix double safe-area padding on chat page
**File:** `src/components/chat/ChatHeader.tsx:44`

The root `SafeAreaView` in `app/index.tsx:83` already adds safe area insets. ChatHeader adds `paddingTop: insets.top + 8` on top of that, doubling the top offset.

**Fix:** Change `paddingTop: insets.top + 8` to `paddingTop: 8`. Remove the `useSafeAreaInsets` import if no longer needed.

---

## 2. Remove gray/white background on chat input
**File:** `src/components/chat/ChatInput.tsx:159-173`

The `inputContainer` has `backgroundColor: '#FFFFFF'` which creates a white block against the cream `#FFF8F0` page background, appearing as a gray-tinted area.

**Fix:** Change `backgroundColor: '#FFFFFF'` to `backgroundColor: colors.background` (`#FFF8F0`) in `inputContainer` so it matches the page. Keep the border/shadow for subtle definition.

---

## 3. Remember last opened session
**Files:** `src/stores/chatStore.ts`, `src/stores/sessionStore.ts`

Currently `activeSessionKey` defaults to `'main'` and is never persisted. When navigating away and back, it stays in memory but resets on reconnect/agent switch.

**Fix:**
- In `chatStore.ts`: persist `activeSessionKey` to `expo-secure-store` on every change in `setActiveSessionKey`
- On app init (in `connect` success handler or `fetchSessions`), restore the persisted key and load that session's history instead of defaulting to `'main'`
- Use the existing `secureStorage` pattern (like `agentStore` does for `activeAgentId`)

---

## 4. Add safe-area padding to sidebar
**File:** `src/components/sidebar/Sidebar.tsx:189-196`

The sidebar uses `position: absolute, top: 0` which goes behind the status bar. The header only has `paddingTop: 16`.

**Fix:** Import `useSafeAreaInsets` and apply `paddingTop: insets.top + 16` to the sidebar header style. This ensures the logo/close button are below the status bar.

---

## 5. Hide header elements (burger, session name, model) when sidebar is open
**Files:** `src/components/chat/ChatHeader.tsx`, `src/stores/navigationStore.ts`

When sidebar slides over, the ChatHeader elements (burger icon, session name, model selector) remain visible/interactive behind the sidebar, causing visual glitches.

**Fix:** In `ChatHeader`, read `isSidebarOpen` from `useNavigationStore`. When `isSidebarOpen` is true, hide the header content (return null or set `opacity: 0` / `pointerEvents: 'none'`). This prevents z-index fighting and interaction issues.

---

## 6. Sync selected model with server model on connect
**File:** `src/stores/sessionStore.ts:44-49`

`syncModelFromServer` is already called in `fetchSessions` when the server returns `defaults.model`. The resolution logic in `chatStore.ts:50-74` may fail for certain model strings.

**Fix:** Add logging to verify the sync is happening. Check if the server returns the model correctly. If the server model format doesn't match any AVAILABLE_MODELS entry, improve the `resolveServerModel` fallback logic to handle more formats.

---

## 7. Remove code lines from skill cards
**File:** `src/screens/SkillsScreen.tsx:186-213`

Remove the terminal-style `export {name}` / `from "author"` code lines and line numbers.

**Fix:** Replace the `cardBody` content with:
- Skill name as a bold heading
- Author row with avatar + name (no code syntax coloring)
- Description text (keep as-is)

Remove styles: `codeLine`, `lineNum`, `codeKeyword`, `codeName`, `codeFrom`, `codeAuthor`.

---

## 8. Remove titles from headers, keep only page-level titles
**File:** `src/screens/SkillsScreen.tsx:80-86`

The header row has both a burger icon AND a "Skills" title text. The page body also has a large "Skills" title. This duplicates the title.

**Fix:** Remove `headerTitle` text from the header row. Keep only the burger menu icon in the header. The large page title inside the ScrollView body is sufficient. Apply this pattern to any other screens that duplicate titles (check AgentsScreen, FilesScreen).

---

## 9. Redesign skill opening modal - show detail first, then agents
**File:** `src/components/skills/InstallSkillModal.tsx`

Currently opens directly to an agent selection list. User wants a detail view first.

**Fix:** Redesign the modal to have two sections in a single ScrollView:
1. **Top section (skill details):**
   - Skill name (large heading)
   - Author with avatar
   - Star count
   - Full description text
   - Last updated date
2. **Bottom section (agents - visible on scroll):**
   - "Install on agents" subheading
   - Agent list with toggle switches (existing logic)
   - Install button (sticky at bottom)

Make the modal taller (70-80% of screen) to accommodate both sections.

---

## 10. Fix category selection - don't push to search field
**File:** `src/screens/SkillsScreen.tsx:64-68`

`handleCategorySelect` currently does `setQuery(cat.label)` which pushes the category name into the search text field. The search field should only be for name/description searches.

**Fix:**
- Remove `setQuery(cat.label)` from `handleCategorySelect`
- Pass the category key as a separate parameter to `doSearch` / `searchSkills`
- Modify `doSearch` to accept an optional category parameter: `doSearch(query, category?)`
- Keep the search field value unchanged when selecting a category
- The active category chip already shows what category is selected

---

## Files to modify
1. `src/components/chat/ChatHeader.tsx` — remove double safe-area padding
2. `src/components/chat/ChatInput.tsx` — remove white background
3. `src/stores/chatStore.ts` — persist activeSessionKey
4. `src/stores/sessionStore.ts` — restore persisted session on connect
5. `src/components/sidebar/Sidebar.tsx` — add safe-area top padding
6. `src/screens/SkillsScreen.tsx` — remove code lines, remove header title, fix category search
7. `src/components/skills/InstallSkillModal.tsx` — redesign to detail-first modal
8. `src/screens/AgentsScreen.tsx` — remove header title (if duplicated)
9. `src/screens/FilesScreen.tsx` — remove header title (if duplicated)

---

## Verification
1. Build debug APK and install on phone via adb
2. Check chat page: header padding should be smaller, input should not have white/gray background
3. Open a non-default session, navigate to Skills, navigate back to Chat — should show the last session
4. Open sidebar — should have proper safe-area padding at top, no overlapping status bar
5. Skills page: cards should show clean layout without code syntax, no duplicate title in header
6. Tap a skill: should show detail info first, scroll down to see agents
7. Select a category: search field should remain empty, category chip should show
