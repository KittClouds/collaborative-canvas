import { EntityFactSheetSchema } from '@/types/factSheetTypes';
import { User, Target, Sparkles, Users, StickyNote } from 'lucide-react';

export const npcSchema: EntityFactSheetSchema = {
  entityKind: 'NPC',
  cards: [
    {
      id: 'identity',
      title: 'Identity',
      icon: User,
      gradient: 'from-orange-500 to-amber-500',
      fields: [
        { name: 'fullName', label: 'Full Name', type: 'text', placeholder: 'Click to add name...' },
        { name: 'role', label: 'Role', type: 'dropdown', options: ['Merchant', 'Guard', 'Noble', 'Commoner', 'Mystic', 'Warrior', 'Artisan', 'Scholar', 'Criminal', 'Servant', 'Official', 'Other'] },
        { name: 'occupation', label: 'Occupation', type: 'text', placeholder: 'What do they do...' },
        { name: 'description', label: 'Description', type: 'text', multiline: true, placeholder: 'Physical appearance and demeanor...' },
        { name: 'personality', label: 'Personality', type: 'text', multiline: true, placeholder: 'How do they act...' },
        { name: 'quirks', label: 'Quirks', type: 'array', itemType: 'text', addButtonText: 'Add Quirk' },
        { name: 'voice', label: 'Voice/Mannerisms', type: 'text', placeholder: 'How do they speak...' },
      ],
    },
    {
      id: 'role',
      title: 'Story Role',
      icon: Target,
      gradient: 'from-blue-500 to-indigo-500',
      fields: [
        { name: 'storyRole', label: 'Story Role', type: 'dropdown', options: ['Quest Giver', 'Ally', 'Enemy', 'Neutral', 'Information Source', 'Shop Keeper', 'Obstacle', 'Comic Relief', 'Mentor', 'Victim'] },
        { name: 'importance', label: 'Importance', type: 'dropdown', options: ['Minor', 'Moderate', 'Major', 'Key'] },
        { name: 'location', label: 'Location', type: 'text', placeholder: 'Where can they be found...' },
        { name: 'schedule', label: 'Schedule', type: 'text', multiline: true, placeholder: 'When are they available...' },
        { name: 'firstAppearance', label: 'First Appearance', type: 'text', placeholder: 'When do players meet them...' },
        { name: 'plotHooks', label: 'Plot Hooks', type: 'array', itemType: 'text', addButtonText: 'Add Hook' },
      ],
    },
    {
      id: 'motivations',
      title: 'Motivations',
      icon: Sparkles,
      gradient: 'from-purple-500 to-pink-500',
      fields: [
        { name: 'goals', label: 'Goals', type: 'array', itemType: 'text', addButtonText: 'Add Goal' },
        { name: 'fears', label: 'Fears', type: 'array', itemType: 'text', addButtonText: 'Add Fear' },
        { name: 'secrets', label: 'Secrets', type: 'array', itemType: 'text', addButtonText: 'Add Secret' },
        { name: 'needs', label: 'Needs', type: 'array', itemType: 'text', addButtonText: 'Add Need' },
        { name: 'attitude', label: 'Default Attitude', type: 'dropdown', options: ['Hostile', 'Unfriendly', 'Indifferent', 'Friendly', 'Helpful'] },
        { name: 'loyalties', label: 'Loyalties', type: 'text', multiline: true, placeholder: 'Who are they loyal to...' },
      ],
    },
    {
      id: 'abilities',
      title: 'Abilities & Resources',
      icon: Sparkles,
      gradient: 'from-emerald-500 to-teal-500',
      fields: [
        { name: 'combatLevel', label: 'Combat Level', type: 'dropdown', options: ['Non-combatant', 'Weak', 'Average', 'Skilled', 'Dangerous', 'Elite', 'Legendary'] },
        { name: 'skills', label: 'Skills', type: 'array', itemType: 'text', addButtonText: 'Add Skill' },
        { name: 'equipment', label: 'Equipment', type: 'array', itemType: 'entity-link', addButtonText: 'Add Equipment' },
        { name: 'wealth', label: 'Wealth', type: 'dropdown', options: ['Destitute', 'Poor', 'Modest', 'Comfortable', 'Wealthy', 'Rich'] },
        { name: 'influence', label: 'Social Influence', type: 'dropdown', options: ['None', 'Local', 'Regional', 'National', 'Continental', 'Global'] },
        { name: 'services', label: 'Services Offered', type: 'array', itemType: 'text', addButtonText: 'Add Service' },
      ],
    },
    {
      id: 'relationships',
      title: 'Relationships',
      icon: Users,
      gradient: 'from-red-500 to-rose-500',
      fields: [
        { name: 'relationships', label: 'Connections', type: 'relationship' },
        { name: 'factions', label: 'Factions', type: 'array', itemType: 'entity-link', addButtonText: 'Add Faction' },
        { name: 'enemies', label: 'Enemies', type: 'array', itemType: 'entity-link', addButtonText: 'Add Enemy' },
        { name: 'allies', label: 'Allies', type: 'array', itemType: 'entity-link', addButtonText: 'Add Ally' },
        { name: 'family', label: 'Family', type: 'array', itemType: 'entity-link', addButtonText: 'Add Family' },
      ],
    },
  ],
};
