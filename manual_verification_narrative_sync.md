
# Narrative Timeline Integration Verification

## Test Plan (Strict Nesting)

### 1. Initialization (Zero State)
1.  **Preparation:** Rename/Move any existing "Narrative" folders to "Narrative_Old" to simulate a clean state (optional).
2.  Open **Narrative > Calendar**.
3.  Locate the "Quick Add" section in any column (e.g., "To Do").
4.  **Verification:** The button should read **"Initialize Narrative Timeline"** (or similar).
5.  Click it.
6.  **Verification:** A "Narrative" folder should appear in the File Tree root.
7.  **Verification:** The button should change to an Input + "Add Event" button.

### 2. Nested Creation
1.  In "Quick Add", select **"Add Character"** from the dropdown menu.
2.  Enter name: "Daenerys".
3.  Click Add.
4.  **Calendar:** "Daenerys" card appears.
5.  **Files:** Check the File Tree.
    -   Find `Narrative > Characters > Daenerys` (or simply `Narrative > Daenerys` if strict path logic defaults differently, but `Characters` folder should be created).
    -   **CRITICAL:** It must be inside `Narrative`. It must not be at the root.

### 3. Multiple Timelines (Advanced)
1.  Manually create a folder named "Alt Timeline" at the root.
2.  If possible via UI or Console, verify it is recognized as a Root (e.g., ensure it has `entityKind: NARRATIVE`).
3.  Verify the Calendar "Quick Add" area now shows a **Dropdown Selector** for the Timeline (Narrative vs Alt Timeline).
4.  Select "Alt Timeline".
5.  Add "Scene A".
6.  **Verification:** "Scene A" appears inside "Alt Timeline > Scenes".
