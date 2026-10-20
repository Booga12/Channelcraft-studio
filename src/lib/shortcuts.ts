// Keyboard shortcuts, in one list for the handler and the shortcut sheet.

export const SHORTCUTS: { group: string; items: [string, string][] }[] = [
  {
    group: 'General',
    items: [
      ['Ctrl+S', 'Save'],
      ['Ctrl+Z', 'Undo'],
      ['Ctrl+Y or Ctrl+Shift+Z', 'Redo'],
      ['Ctrl+K', 'Search for anything'],
      ['?', 'Show this list'],
      ['Ctrl+,', 'Settings'],
    ],
  },
  {
    group: 'Selecting',
    items: [
      ['Click', 'Select an element'],
      ['Shift+click or Ctrl+click', 'Add to or remove from the selection'],
      ['Drag on an empty spot', 'Select everything inside a box'],
      ['Ctrl+A', 'Select all'],
      ['Esc', 'Deselect'],
    ],
  },
  {
    group: 'Editing',
    items: [
      ['Drag', 'Move the selection (Shift: in a straight line, Alt: no snapping)'],
      ['Drag a handle', 'Resize (Shift: keep proportions, Alt: from the centre)'],
      ['Arrow keys', 'Nudge (Shift: 10× further)'],
      ['Ctrl+D', 'Duplicate'],
      ['Ctrl+C / Ctrl+V', 'Copy / paste'],
      ['Delete', 'Delete'],
      ['Ctrl+] / Ctrl+[', 'Bring forward / send backward'],
      ['Ctrl+Shift+] / Ctrl+Shift+[', 'Bring to front / send to back'],
      ['Ctrl+L', 'Lock or unlock'],
      ['F2', 'Rename'],
    ],
  },
  {
    group: 'View',
    items: [
      ['Ctrl+0', 'Zoom to fit'],
      ['Ctrl+1', 'Actual size'],
      ['Ctrl+= / Ctrl+-', 'Zoom in / out'],
      ['Ctrl+scroll', 'Zoom'],
      ['Ctrl+\'', 'Show or hide the grid'],
      ['Page Up / Page Down', 'Previous / next system'],
      ['P', 'Play or stop animations'],
    ],
  },
];
