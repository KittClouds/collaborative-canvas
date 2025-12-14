import { EntityFactSheetSchema } from '@/types/factSheetTypes';
import { Calendar, Users, Zap, Clock, Award } from 'lucide-react';

export const eventSchema: EntityFactSheetSchema = {
  entityKind: 'EVENT',
  cards: [
    {
      id: 'overview',
      title: 'Overview',
      icon: Calendar,
      gradient: 'from-teal-500 to-cyan-500',
      fields: [
        { name: 'name', label: 'Event Name', type: 'text', placeholder: 'Click to add name...' },
        { name: 'type', label: 'Type', type: 'dropdown', options: ['Battle', 'Ceremony', 'Discovery', 'Betrayal', 'Meeting', 'Death', 'Birth', 'Marriage', 'Treaty', 'Disaster', 'Miracle', 'Other'] },
        { name: 'description', label: 'Description', type: 'text', multiline: true, placeholder: 'What happened...' },
        { name: 'significance', label: 'Significance', type: 'dropdown', options: ['Minor', 'Moderate', 'Major', 'World-Changing', 'Legendary'] },
        { name: 'status', label: 'Status', type: 'dropdown', options: ['Upcoming', 'In Progress', 'Completed', 'Prevented', 'Recurring'] },
      ],
    },
    {
      id: 'participants',
      title: 'Participants',
      icon: Users,
      gradient: 'from-purple-500 to-violet-500',
      fields: [
        { name: 'keyFigures', label: 'Key Figures', type: 'array', itemType: 'entity-link', addButtonText: 'Add Figure' },
        { name: 'factions', label: 'Factions Involved', type: 'array', itemType: 'entity-link', addButtonText: 'Add Faction' },
        { name: 'witnesses', label: 'Witnesses', type: 'array', itemType: 'entity-link', addButtonText: 'Add Witness' },
        { name: 'casualties', label: 'Casualties', type: 'text', multiline: true, placeholder: 'Who was lost...' },
        { name: 'survivors', label: 'Notable Survivors', type: 'array', itemType: 'entity-link', addButtonText: 'Add Survivor' },
      ],
    },
    {
      id: 'consequences',
      title: 'Consequences',
      icon: Zap,
      gradient: 'from-red-500 to-orange-500',
      fields: [
        { name: 'immediateEffects', label: 'Immediate Effects', type: 'array', itemType: 'text', addButtonText: 'Add Effect' },
        { name: 'longTermEffects', label: 'Long-Term Effects', type: 'array', itemType: 'text', addButtonText: 'Add Effect' },
        { name: 'politicalChanges', label: 'Political Changes', type: 'text', multiline: true, placeholder: 'How did power shift...' },
        { name: 'culturalImpact', label: 'Cultural Impact', type: 'text', multiline: true, placeholder: 'How did it change society...' },
        { name: 'relatedEvents', label: 'Triggered Events', type: 'array', itemType: 'entity-link', addButtonText: 'Add Event' },
      ],
    },
    {
      id: 'timeline',
      title: 'Timeline',
      icon: Clock,
      gradient: 'from-blue-500 to-indigo-500',
      fields: [
        { name: 'date', label: 'Date', type: 'text', placeholder: 'When did it occur...' },
        { name: 'duration', label: 'Duration', type: 'text', placeholder: 'How long did it last...' },
        { name: 'location', label: 'Location', type: 'text', placeholder: 'Where did it happen...' },
        { name: 'precedingEvents', label: 'Preceding Events', type: 'array', itemType: 'entity-link', addButtonText: 'Add Event' },
        { name: 'followingEvents', label: 'Following Events', type: 'array', itemType: 'entity-link', addButtonText: 'Add Event' },
        { name: 'timeline', label: 'Timeline Details', type: 'text', multiline: true, placeholder: 'Sequence of events...' },
      ],
    },
    {
      id: 'legacy',
      title: 'Legacy',
      icon: Award,
      gradient: 'from-amber-500 to-yellow-500',
      fields: [
        { name: 'rememberedAs', label: 'Remembered As', type: 'text', placeholder: 'How is it known...' },
        { name: 'commemorations', label: 'Commemorations', type: 'array', itemType: 'text', addButtonText: 'Add Commemoration' },
        { name: 'legends', label: 'Legends', type: 'array', itemType: 'text', addButtonText: 'Add Legend' },
        { name: 'artifacts', label: 'Related Artifacts', type: 'array', itemType: 'entity-link', addButtonText: 'Add Artifact' },
        { name: 'secretTruths', label: 'Secret Truths', type: 'text', multiline: true, placeholder: 'What really happened...' },
      ],
    },
  ],
};
