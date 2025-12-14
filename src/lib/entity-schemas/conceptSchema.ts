import { EntityFactSheetSchema } from '@/types/factSheetTypes';
import { Lightbulb, Wand2, History, GitBranch, BookOpen } from 'lucide-react';

export const conceptSchema: EntityFactSheetSchema = {
  entityKind: 'CONCEPT',
  cards: [
    {
      id: 'definition',
      title: 'Definition',
      icon: Lightbulb,
      gradient: 'from-indigo-500 to-purple-500',
      fields: [
        { name: 'name', label: 'Concept Name', type: 'text', placeholder: 'Click to add name...' },
        { name: 'type', label: 'Type', type: 'dropdown', options: ['Magic System', 'Prophecy', 'Curse', 'Law', 'Custom', 'Legend', 'Religion', 'Philosophy', 'Technology', 'Language', 'Other'] },
        { name: 'description', label: 'Description', type: 'text', multiline: true, placeholder: 'Explain this concept...' },
        { name: 'shortDefinition', label: 'Short Definition', type: 'text', placeholder: 'One-line summary...' },
        { name: 'aliases', label: 'Aliases', type: 'array', itemType: 'text', addButtonText: 'Add Alias' },
      ],
    },
    {
      id: 'applications',
      title: 'Applications & Rules',
      icon: Wand2,
      gradient: 'from-purple-500 to-pink-500',
      fields: [
        { name: 'rules', label: 'Rules', type: 'array', itemType: 'text', addButtonText: 'Add Rule' },
        { name: 'limitations', label: 'Limitations', type: 'array', itemType: 'text', addButtonText: 'Add Limitation' },
        { name: 'costs', label: 'Costs', type: 'array', itemType: 'text', addButtonText: 'Add Cost' },
        { name: 'practitioners', label: 'Practitioners', type: 'array', itemType: 'entity-link', addButtonText: 'Add Practitioner' },
        { name: 'manifestations', label: 'Manifestations', type: 'array', itemType: 'text', addButtonText: 'Add Manifestation' },
        { name: 'commonUses', label: 'Common Uses', type: 'text', multiline: true, placeholder: 'How is it typically used...' },
      ],
    },
    {
      id: 'history',
      title: 'History & Origin',
      icon: History,
      gradient: 'from-amber-500 to-orange-500',
      fields: [
        { name: 'origin', label: 'Origin', type: 'text', multiline: true, placeholder: 'Where did it come from...' },
        { name: 'discoverer', label: 'Discoverer/Creator', type: 'text', placeholder: 'Who found or created it...' },
        { name: 'age', label: 'Age', type: 'text', placeholder: 'How old is this concept...' },
        { name: 'evolution', label: 'Evolution', type: 'text', multiline: true, placeholder: 'How has it changed over time...' },
        { name: 'keyEvents', label: 'Key Events', type: 'array', itemType: 'entity-link', addButtonText: 'Add Event' },
      ],
    },
    {
      id: 'related',
      title: 'Related Concepts',
      icon: GitBranch,
      gradient: 'from-teal-500 to-cyan-500',
      fields: [
        { name: 'parentConcepts', label: 'Parent Concepts', type: 'array', itemType: 'entity-link', addButtonText: 'Add Parent' },
        { name: 'childConcepts', label: 'Child Concepts', type: 'array', itemType: 'entity-link', addButtonText: 'Add Child' },
        { name: 'opposites', label: 'Opposites', type: 'array', itemType: 'entity-link', addButtonText: 'Add Opposite' },
        { name: 'relatedItems', label: 'Related Items', type: 'array', itemType: 'entity-link', addButtonText: 'Add Item' },
        { name: 'relatedLocations', label: 'Related Locations', type: 'array', itemType: 'entity-link', addButtonText: 'Add Location' },
      ],
    },
    {
      id: 'sources',
      title: 'Sources & References',
      icon: BookOpen,
      gradient: 'from-slate-500 to-gray-500',
      fields: [
        { name: 'primarySources', label: 'Primary Sources', type: 'array', itemType: 'text', addButtonText: 'Add Source' },
        { name: 'inWorldTexts', label: 'In-World Texts', type: 'array', itemType: 'text', addButtonText: 'Add Text' },
        { name: 'experts', label: 'Experts', type: 'array', itemType: 'entity-link', addButtonText: 'Add Expert' },
        { name: 'schools', label: 'Schools of Thought', type: 'array', itemType: 'text', addButtonText: 'Add School' },
        { name: 'controversies', label: 'Controversies', type: 'text', multiline: true, placeholder: 'Disputed aspects...' },
      ],
    },
  ],
};
