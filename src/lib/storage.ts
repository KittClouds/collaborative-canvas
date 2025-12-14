import type { Note, Folder } from '@/contexts/NotesContext';

export const STORAGE_KEY = 'networked-notes-data';
const BACKUP_KEY = `${STORAGE_KEY}-backup`;

// Load from localStorage
export function loadFromStorage(): { notes: Note[]; folders: Folder[] } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return parseStorageData(stored);
    }
  } catch (e) {
    console.error('Failed to load notes from storage:', e);
    // Try to recover from backup
    return loadFromBackup();
  }
  return { notes: [], folders: [] };
}

// Load from backup
export function loadFromBackup(): { notes: Note[]; folders: Folder[] } {
  try {
    const backup = localStorage.getItem(BACKUP_KEY);
    if (backup) {
      console.log('Recovering from backup...');
      return parseStorageData(backup);
    }
  } catch (e) {
    console.error('Failed to load from backup:', e);
  }
  return { notes: [], folders: [] };
}

// Parse storage data with date conversion
function parseStorageData(data: string): { notes: Note[]; folders: Folder[] } {
  const parsed = JSON.parse(data);
  return {
    notes: parsed.notes.map((n: any) => ({
      ...n,
      createdAt: new Date(n.createdAt),
      updatedAt: new Date(n.updatedAt),
    })),
    folders: parsed.folders.map((f: any) => ({
      ...f,
      createdAt: new Date(f.createdAt),
    })),
  };
}

// Save to localStorage with backup
export function saveToStorage(notes: Note[], folders: Folder[]) {
  try {
    const data = JSON.stringify({ notes, folders });
    
    // Keep backup of previous state before saving
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) {
      localStorage.setItem(BACKUP_KEY, current);
    }
    
    localStorage.setItem(STORAGE_KEY, data);
  } catch (e) {
    console.error('Failed to save notes to storage:', e);
  }
}

// Export notes to JSON file
export function exportNotes(notes: Note[], folders: Folder[]) {
  const data = {
    notes,
    folders,
    exportedAt: new Date().toISOString(),
    version: '1.0',
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `notes-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Import notes from JSON file
export function importNotes(file: File): Promise<{ notes: Note[]; folders: Folder[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        if (!data.notes || !data.folders) {
          throw new Error('Invalid backup file format');
        }
        
        resolve({
          notes: data.notes.map((n: any) => ({
            ...n,
            createdAt: new Date(n.createdAt),
            updatedAt: new Date(n.updatedAt),
          })),
          folders: data.folders.map((f: any) => ({
            ...f,
            createdAt: new Date(f.createdAt),
          })),
        });
      } catch (err) {
        reject(new Error('Failed to parse backup file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
