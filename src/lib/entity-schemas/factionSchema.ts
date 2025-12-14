import { EntityFactSheetSchema } from '@/types/factSheetTypes';
import { Shield, Crown, Coins, Users, Target, MapPin } from 'lucide-react';

export const factionSchema: EntityFactSheetSchema = {
  entityKind: 'FACTION',
  cards: [
    {
      id: 'identity',
      title: 'Identity',
      icon: Shield,
      gradient: 'from-red-500 to-rose-500',
      fields: [
        { name: 'name', label: 'Faction Name', type: 'text', placeholder: 'Click to add name...' },
        { name: 'type', label: 'Type', type: 'dropdown', options: ['Guild', 'Kingdom', 'Order', 'Cult', 'Tribe', 'Alliance', 'Corporation', 'Military', 'Religious', 'Criminal'] },
        { name: 'motto', label: 'Motto/Creed', type: 'text', placeholder: 'Their guiding words...' },
        { name: 'description', label: 'Description', type: 'text', multiline: true, placeholder: 'Describe this faction...' },
        { name: 'symbol', label: 'Symbol/Emblem', type: 'text', placeholder: 'Describe their symbol...' },
        { name: 'colors', label: 'Colors', type: 'array', itemType: 'text', addButtonText: 'Add Color' },
        { name: 'founded', label: 'Founded', type: 'text', placeholder: 'When was it established...' },
      ],
    },
    {
      id: 'leadership',
      title: 'Leadership',
      icon: Crown,
      gradient: 'from-amber-500 to-yellow-500',
      fields: [
        { name: 'leader', label: 'Leader', type: 'text', placeholder: 'Who leads them...' },
        { name: 'leaderTitle', label: 'Leader Title', type: 'text', placeholder: 'What are they called...' },
        { name: 'councilMembers', label: 'Council/Officers', type: 'array', itemType: 'entity-link', addButtonText: 'Add Member' },
        { name: 'hierarchy', label: 'Hierarchy', type: 'text', multiline: true, placeholder: 'How is it structured...' },
        { name: 'succession', label: 'Succession', type: 'text', multiline: true, placeholder: 'How do leaders change...' },
      ],
    },
    {
      id: 'resources',
      title: 'Resources & Power',
      icon: Coins,
      gradient: 'from-emerald-500 to-green-500',
      fields: [
        { name: 'wealth', label: 'Wealth Level', type: 'dropdown', options: ['Destitute', 'Poor', 'Modest', 'Wealthy', 'Rich', 'Extremely Rich'] },
        { name: 'militaryStrength', label: 'Military Strength', type: 'dropdown', options: ['None', 'Minimal', 'Small', 'Moderate', 'Strong', 'Dominant'] },
        { name: 'influence', label: 'Influence', type: 'progress', currentField: 'influenceCurrent', maxField: 'influenceMax', color: '#8b5cf6' },
        { name: 'assets', label: 'Key Assets', type: 'array', itemType: 'text', addButtonText: 'Add Asset' },
        { name: 'specialResources', label: 'Special Resources', type: 'array', itemType: 'text', addButtonText: 'Add Resource' },
      ],
    },
    {
      id: 'relations',
      title: 'Relations',
      icon: Users,
      gradient: 'from-blue-500 to-indigo-500',
      fields: [
        { name: 'allies', label: 'Allies', type: 'array', itemType: 'entity-link', addButtonText: 'Add Ally' },
        { name: 'enemies', label: 'Enemies', type: 'array', itemType: 'entity-link', addButtonText: 'Add Enemy' },
        { name: 'neutrals', label: 'Neutral Relations', type: 'array', itemType: 'entity-link', addButtonText: 'Add Neutral' },
        { name: 'relationships', label: 'Detailed Relations', type: 'relationship' },
      ],
    },
    {
      id: 'goals',
      title: 'Goals & Methods',
      icon: Target,
      gradient: 'from-purple-500 to-pink-500',
      fields: [
        { name: 'primaryGoal', label: 'Primary Goal', type: 'text', multiline: true, placeholder: 'What do they want most...' },
        { name: 'secondaryGoals', label: 'Secondary Goals', type: 'array', itemType: 'text', addButtonText: 'Add Goal' },
        { name: 'methods', label: 'Methods', type: 'array', itemType: 'text', addButtonText: 'Add Method' },
        { name: 'currentPlans', label: 'Current Plans', type: 'text', multiline: true, placeholder: 'What are they doing now...' },
        { name: 'secrets', label: 'Secrets', type: 'array', itemType: 'text', addButtonText: 'Add Secret' },
      ],
    },
    {
      id: 'territory',
      title: 'Territory',
      icon: MapPin,
      gradient: 'from-cyan-500 to-teal-500',
      fields: [
        { name: 'headquarters', label: 'Headquarters', type: 'text', placeholder: 'Where are they based...' },
        { name: 'territories', label: 'Controlled Territories', type: 'array', itemType: 'entity-link', addButtonText: 'Add Territory' },
        { name: 'presenceAreas', label: 'Areas of Presence', type: 'array', itemType: 'text', addButtonText: 'Add Area' },
        { name: 'expansionTargets', label: 'Expansion Targets', type: 'array', itemType: 'text', addButtonText: 'Add Target' },
      ],
    },
  ],
};
