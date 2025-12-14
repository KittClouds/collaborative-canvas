import { EntityFactSheetSchema } from '@/types/factSheetTypes';
import { Film, Users, MapPin, Zap, StickyNote } from 'lucide-react';

export const sceneSchema: EntityFactSheetSchema = {
  entityKind: 'SCENE',
  cards: [
    {
      id: 'overview',
      title: 'Scene Overview',
      icon: Film,
      gradient: 'from-pink-500 to-rose-500',
      fields: [
        { name: 'name', label: 'Scene Name', type: 'text', placeholder: 'Click to add name...' },
        { name: 'type', label: 'Type', type: 'dropdown', options: ['Opening', 'Climax', 'Resolution', 'Flashback', 'Beat', 'Transition', 'Action', 'Dialogue', 'Discovery', 'Confrontation'] },
        { name: 'status', label: 'Status', type: 'dropdown', options: ['Planned', 'In Progress', 'Completed', 'Skipped', 'Revised'] },
        { name: 'summary', label: 'Summary', type: 'text', multiline: true, placeholder: 'What happens in this scene...' },
        { name: 'mood', label: 'Mood/Tone', type: 'dropdown', options: ['Tense', 'Exciting', 'Somber', 'Humorous', 'Mysterious', 'Romantic', 'Horrific', 'Triumphant', 'Melancholic'] },
        { name: 'importance', label: 'Importance', type: 'dropdown', options: ['Minor', 'Standard', 'Important', 'Critical', 'Climactic'] },
      ],
    },
    {
      id: 'participants',
      title: 'Participants',
      icon: Users,
      gradient: 'from-purple-500 to-violet-500',
      fields: [
        { name: 'protagonists', label: 'Protagonists', type: 'array', itemType: 'entity-link', addButtonText: 'Add Character' },
        { name: 'antagonists', label: 'Antagonists', type: 'array', itemType: 'entity-link', addButtonText: 'Add Character' },
        { name: 'supporting', label: 'Supporting Characters', type: 'array', itemType: 'entity-link', addButtonText: 'Add Character' },
        { name: 'factions', label: 'Factions Involved', type: 'array', itemType: 'entity-link', addButtonText: 'Add Faction' },
        { name: 'pointOfView', label: 'Point of View', type: 'text', placeholder: 'Whose perspective...' },
      ],
    },
    {
      id: 'setting',
      title: 'Setting',
      icon: MapPin,
      gradient: 'from-blue-500 to-cyan-500',
      fields: [
        { name: 'location', label: 'Location', type: 'text', placeholder: 'Where does it take place...' },
        { name: 'timeOfDay', label: 'Time of Day', type: 'dropdown', options: ['Dawn', 'Morning', 'Noon', 'Afternoon', 'Dusk', 'Evening', 'Night', 'Midnight'] },
        { name: 'weather', label: 'Weather', type: 'text', placeholder: 'Weather conditions...' },
        { name: 'duration', label: 'Duration', type: 'text', placeholder: 'How long does it last...' },
        { name: 'atmosphere', label: 'Atmosphere', type: 'text', multiline: true, placeholder: 'Describe the atmosphere...' },
        { name: 'sensoryDetails', label: 'Sensory Details', type: 'array', itemType: 'text', addButtonText: 'Add Detail' },
      ],
    },
    {
      id: 'conflict',
      title: 'Conflict & Stakes',
      icon: Zap,
      gradient: 'from-red-500 to-orange-500',
      fields: [
        { name: 'conflict', label: 'Central Conflict', type: 'text', multiline: true, placeholder: 'What is the conflict...' },
        { name: 'stakes', label: 'Stakes', type: 'text', multiline: true, placeholder: 'What is at risk...' },
        { name: 'tension', label: 'Tension Level', type: 'progress', currentField: 'tensionLevel', maxField: 'tensionMax', color: '#ef4444' },
        { name: 'obstacles', label: 'Obstacles', type: 'array', itemType: 'text', addButtonText: 'Add Obstacle' },
        { name: 'turningPoint', label: 'Turning Point', type: 'text', multiline: true, placeholder: 'Key moment of change...' },
        { name: 'resolution', label: 'Resolution', type: 'text', multiline: true, placeholder: 'How does it resolve...' },
      ],
    },
    {
      id: 'notes',
      title: 'Notes & Connections',
      icon: StickyNote,
      gradient: 'from-slate-500 to-gray-500',
      fields: [
        { name: 'previousScene', label: 'Previous Scene', type: 'text', placeholder: 'Link to prior scene...' },
        { name: 'nextScene', label: 'Next Scene', type: 'text', placeholder: 'Link to following scene...' },
        { name: 'foreshadowing', label: 'Foreshadowing', type: 'array', itemType: 'text', addButtonText: 'Add Foreshadow' },
        { name: 'callbacks', label: 'Callbacks', type: 'array', itemType: 'text', addButtonText: 'Add Callback' },
        { name: 'writingNotes', label: 'Writing Notes', type: 'text', multiline: true, placeholder: 'Notes for writing...' },
        { name: 'revision', label: 'Revision Notes', type: 'text', multiline: true, placeholder: 'Changes needed...' },
      ],
    },
  ],
};
