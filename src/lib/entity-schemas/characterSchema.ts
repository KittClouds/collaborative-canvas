import { EntityFactSheetSchema } from '@/types/factSheetTypes';
import { User, Zap, BarChart3, Sparkles, Package, Users, StickyNote } from 'lucide-react';

export const characterSchema: EntityFactSheetSchema = {
  entityKind: 'CHARACTER',
  cards: [
    {
      id: 'identity',
      title: 'Identity Core',
      icon: User,
      gradient: 'from-blue-500 to-cyan-500',
      fields: [
        { name: 'fullName', label: 'Full Name', type: 'text', placeholder: 'Click to add name...' },
        { name: 'aliases', label: 'Aliases', type: 'array', itemType: 'text', addButtonText: 'Add Alias' },
        { name: 'occupation', label: 'Occupation/Class', type: 'text', placeholder: 'Click to add occupation...' },
        { name: 'background', label: 'Background', type: 'text', multiline: true, placeholder: 'Click to add background...' },
        { name: 'personality', label: 'Personality', type: 'text', multiline: true, placeholder: 'Click to add personality...' },
        { name: 'age', label: 'Age', type: 'number', min: 0, placeholder: 'Age' },
        { name: 'species', label: 'Species/Race', type: 'text', placeholder: 'Click to add species...' },
        { name: 'gender', label: 'Gender', type: 'text', placeholder: 'Click to add gender...' },
      ],
    },
    {
      id: 'progression',
      title: 'Progression & Vitals',
      icon: Zap,
      gradient: 'from-pink-500 to-rose-500',
      fields: [
        { name: 'level', label: 'Level', type: 'number', min: 1, defaultValue: 1 },
        { name: 'xp', label: 'Experience', type: 'progress', currentField: 'xpCurrent', maxField: 'xpRequired', color: '#eab308' },
        { name: 'health', label: 'Health', type: 'progress', currentField: 'healthCurrent', maxField: 'healthMax', color: '#ef4444' },
        { name: 'mana', label: 'Mana', type: 'progress', currentField: 'manaCurrent', maxField: 'manaMax', color: '#3b82f6' },
        { name: 'stamina', label: 'Stamina', type: 'progress', currentField: 'staminaCurrent', maxField: 'staminaMax', color: '#22c55e' },
        { name: 'statusConditions', label: 'Status Conditions', type: 'array', itemType: 'text', addButtonText: 'Add Condition' },
      ],
    },
    {
      id: 'attributes',
      title: 'Attributes',
      icon: BarChart3,
      gradient: 'from-purple-500 to-violet-500',
      fields: [
        {
          name: 'stats',
          label: 'Core Stats',
          type: 'stat-grid',
          stats: [
            { name: 'strength', label: 'Strength', abbr: 'STR' },
            { name: 'dexterity', label: 'Dexterity', abbr: 'DEX' },
            { name: 'constitution', label: 'Constitution', abbr: 'CON' },
            { name: 'intelligence', label: 'Intelligence', abbr: 'INT' },
            { name: 'wisdom', label: 'Wisdom', abbr: 'WIS' },
            { name: 'charisma', label: 'Charisma', abbr: 'CHA' },
          ],
        },
      ],
    },
    {
      id: 'abilities',
      title: 'Abilities & Skills',
      icon: Sparkles,
      gradient: 'from-amber-500 to-orange-500',
      fields: [
        { name: 'abilities', label: 'Abilities', type: 'array', itemType: 'text', addButtonText: 'Add Ability' },
        { name: 'skills', label: 'Skills', type: 'array', itemType: 'text', addButtonText: 'Add Skill' },
        { name: 'languages', label: 'Languages', type: 'array', itemType: 'text', addButtonText: 'Add Language' },
        { name: 'proficiencies', label: 'Proficiencies', type: 'array', itemType: 'text', addButtonText: 'Add Proficiency' },
      ],
    },
    {
      id: 'inventory',
      title: 'Inventory',
      icon: Package,
      gradient: 'from-emerald-500 to-teal-500',
      fields: [
        { name: 'equippedItems', label: 'Equipped', type: 'array', itemType: 'entity-link', addButtonText: 'Add Item' },
        { name: 'carriedItems', label: 'Carried', type: 'array', itemType: 'entity-link', addButtonText: 'Add Item' },
        { name: 'gold', label: 'Gold', type: 'number', min: 0, defaultValue: 0 },
        { name: 'carryCapacity', label: 'Carry Capacity', type: 'number', min: 0, unit: 'lbs' },
      ],
    },
    {
      id: 'relationships',
      title: 'Relationships',
      icon: Users,
      gradient: 'from-red-500 to-pink-500',
      fields: [
        { name: 'relationships', label: 'Connections', type: 'relationship' },
        { name: 'factions', label: 'Faction Affiliations', type: 'array', itemType: 'entity-link', addButtonText: 'Add Faction' },
      ],
    },
    {
      id: 'notes',
      title: 'Notes & Secrets',
      icon: StickyNote,
      gradient: 'from-slate-500 to-gray-500',
      fields: [
        { name: 'publicNotes', label: 'Public Notes', type: 'text', multiline: true, placeholder: 'Notes visible to all...' },
        { name: 'privateNotes', label: 'Private Notes', type: 'text', multiline: true, placeholder: 'Hidden notes and secrets...' },
        { name: 'goals', label: 'Goals', type: 'array', itemType: 'text', addButtonText: 'Add Goal' },
        { name: 'fears', label: 'Fears', type: 'array', itemType: 'text', addButtonText: 'Add Fear' },
      ],
    },
  ],
};
