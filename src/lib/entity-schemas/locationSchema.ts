import { EntityFactSheetSchema } from '@/types/factSheetTypes';
import { MapPin, Mountain, Users, Compass, GitBranch, History } from 'lucide-react';

export const locationSchema: EntityFactSheetSchema = {
  entityKind: 'LOCATION',
  cards: [
    {
      id: 'overview',
      title: 'Overview',
      icon: MapPin,
      gradient: 'from-blue-500 to-indigo-500',
      fields: [
        { name: 'name', label: 'Location Name', type: 'text', placeholder: 'Click to add name...' },
        { name: 'type', label: 'Type', type: 'dropdown', options: ['Continent', 'Country', 'City', 'Town', 'Village', 'Landmark', 'Building', 'Room', 'Dungeon', 'Wilderness'] },
        { name: 'description', label: 'Description', type: 'text', multiline: true, placeholder: 'Describe this place...' },
        { name: 'parentLocation', label: 'Parent Location', type: 'text', placeholder: 'Part of...' },
        { name: 'aliases', label: 'Aliases', type: 'array', itemType: 'text', addButtonText: 'Add Alias' },
      ],
    },
    {
      id: 'geography',
      title: 'Geography & Climate',
      icon: Mountain,
      gradient: 'from-emerald-500 to-green-500',
      fields: [
        { name: 'terrain', label: 'Terrain', type: 'text', placeholder: 'Click to add terrain...' },
        { name: 'climate', label: 'Climate', type: 'dropdown', options: ['Tropical', 'Arid', 'Temperate', 'Continental', 'Polar', 'Mediterranean', 'Oceanic', 'Magical'] },
        { name: 'resources', label: 'Natural Resources', type: 'array', itemType: 'text', addButtonText: 'Add Resource' },
        { name: 'hazards', label: 'Hazards', type: 'array', itemType: 'text', addButtonText: 'Add Hazard' },
        { name: 'size', label: 'Size', type: 'text', placeholder: 'Dimensions or area...' },
      ],
    },
    {
      id: 'population',
      title: 'Population & Culture',
      icon: Users,
      gradient: 'from-amber-500 to-yellow-500',
      fields: [
        { name: 'population', label: 'Population', type: 'number', min: 0 },
        { name: 'demographics', label: 'Demographics', type: 'text', multiline: true, placeholder: 'Who lives here...' },
        { name: 'government', label: 'Government', type: 'text', placeholder: 'How is it ruled...' },
        { name: 'ruler', label: 'Ruler/Leader', type: 'text', placeholder: 'Who rules here...' },
        { name: 'culture', label: 'Culture', type: 'text', multiline: true, placeholder: 'Customs and traditions...' },
        { name: 'languages', label: 'Languages', type: 'array', itemType: 'text', addButtonText: 'Add Language' },
      ],
    },
    {
      id: 'pointsOfInterest',
      title: 'Points of Interest',
      icon: Compass,
      gradient: 'from-purple-500 to-pink-500',
      fields: [
        { name: 'landmarks', label: 'Landmarks', type: 'array', itemType: 'entity-link', addButtonText: 'Add Landmark' },
        { name: 'shops', label: 'Shops & Services', type: 'array', itemType: 'text', addButtonText: 'Add Shop' },
        { name: 'inns', label: 'Inns & Taverns', type: 'array', itemType: 'text', addButtonText: 'Add Inn' },
        { name: 'dungeons', label: 'Dungeons & Ruins', type: 'array', itemType: 'entity-link', addButtonText: 'Add Dungeon' },
        { name: 'secrets', label: 'Hidden Secrets', type: 'array', itemType: 'text', addButtonText: 'Add Secret' },
      ],
    },
    {
      id: 'connections',
      title: 'Connections',
      icon: GitBranch,
      gradient: 'from-cyan-500 to-teal-500',
      fields: [
        { name: 'connectedLocations', label: 'Connected Locations', type: 'array', itemType: 'entity-link', addButtonText: 'Add Connection' },
        { name: 'travelRoutes', label: 'Travel Routes', type: 'array', itemType: 'text', addButtonText: 'Add Route' },
        { name: 'travelTime', label: 'Travel Times', type: 'text', multiline: true, placeholder: 'How long to reach nearby places...' },
        { name: 'factions', label: 'Factions Present', type: 'array', itemType: 'entity-link', addButtonText: 'Add Faction' },
      ],
    },
    {
      id: 'history',
      title: 'History & Lore',
      icon: History,
      gradient: 'from-slate-500 to-gray-500',
      fields: [
        { name: 'founded', label: 'Founded', type: 'text', placeholder: 'When was it established...' },
        { name: 'history', label: 'History', type: 'text', multiline: true, placeholder: 'Major historical events...' },
        { name: 'legends', label: 'Legends', type: 'array', itemType: 'text', addButtonText: 'Add Legend' },
        { name: 'notableEvents', label: 'Notable Events', type: 'array', itemType: 'entity-link', addButtonText: 'Add Event' },
      ],
    },
  ],
};
