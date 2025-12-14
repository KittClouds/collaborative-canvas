import { EntityFactSheetSchema } from '@/types/factSheetTypes';
import { Package, Sparkles, Shield, History, Coins } from 'lucide-react';

export const itemSchema: EntityFactSheetSchema = {
  entityKind: 'ITEM',
  cards: [
    {
      id: 'properties',
      title: 'Properties',
      icon: Package,
      gradient: 'from-emerald-500 to-green-500',
      fields: [
        { name: 'name', label: 'Item Name', type: 'text', placeholder: 'Click to add name...' },
        { name: 'type', label: 'Type', type: 'dropdown', options: ['Weapon', 'Armor', 'Artifact', 'Consumable', 'Tool', 'Key', 'Treasure', 'Material', 'Misc'] },
        { name: 'rarity', label: 'Rarity', type: 'dropdown', options: ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact', 'Unique'] },
        { name: 'description', label: 'Description', type: 'text', multiline: true, placeholder: 'Describe this item...' },
        { name: 'weight', label: 'Weight', type: 'number', min: 0, unit: 'lbs' },
        { name: 'size', label: 'Size', type: 'dropdown', options: ['Tiny', 'Small', 'Medium', 'Large', 'Huge'] },
        { name: 'material', label: 'Material', type: 'text', placeholder: 'What is it made of...' },
      ],
    },
    {
      id: 'effects',
      title: 'Effects & Abilities',
      icon: Sparkles,
      gradient: 'from-purple-500 to-violet-500',
      fields: [
        { name: 'magicProperties', label: 'Magic Properties', type: 'array', itemType: 'text', addButtonText: 'Add Property' },
        { name: 'damage', label: 'Damage', type: 'text', placeholder: 'e.g., 1d8 slashing' },
        { name: 'armorClass', label: 'Armor Class', type: 'number', min: 0 },
        { name: 'bonuses', label: 'Bonuses', type: 'array', itemType: 'text', addButtonText: 'Add Bonus' },
        { name: 'abilities', label: 'Special Abilities', type: 'array', itemType: 'text', addButtonText: 'Add Ability' },
        { name: 'charges', label: 'Charges', type: 'progress', currentField: 'chargesCurrent', maxField: 'chargesMax', color: '#8b5cf6' },
        { name: 'cursed', label: 'Cursed', type: 'dropdown', options: ['No', 'Yes - Minor', 'Yes - Major', 'Yes - Sentient'] },
      ],
    },
    {
      id: 'requirements',
      title: 'Requirements',
      icon: Shield,
      gradient: 'from-amber-500 to-orange-500',
      fields: [
        { name: 'attunement', label: 'Attunement', type: 'dropdown', options: ['None', 'Required', 'Required by Spellcaster', 'Required by Class', 'Required by Alignment'] },
        { name: 'attunementDetails', label: 'Attunement Details', type: 'text', placeholder: 'Specific requirements...' },
        { name: 'prerequisites', label: 'Prerequisites', type: 'array', itemType: 'text', addButtonText: 'Add Prerequisite' },
        { name: 'restrictions', label: 'Restrictions', type: 'array', itemType: 'text', addButtonText: 'Add Restriction' },
      ],
    },
    {
      id: 'history',
      title: 'History & Lore',
      icon: History,
      gradient: 'from-slate-500 to-gray-500',
      fields: [
        { name: 'origin', label: 'Origin', type: 'text', multiline: true, placeholder: 'Where did it come from...' },
        { name: 'creator', label: 'Creator', type: 'text', placeholder: 'Who made it...' },
        { name: 'previousOwners', label: 'Previous Owners', type: 'array', itemType: 'entity-link', addButtonText: 'Add Owner' },
        { name: 'currentOwner', label: 'Current Owner', type: 'text', placeholder: 'Who has it now...' },
        { name: 'legends', label: 'Legends', type: 'array', itemType: 'text', addButtonText: 'Add Legend' },
        { name: 'location', label: 'Current Location', type: 'text', placeholder: 'Where is it now...' },
      ],
    },
    {
      id: 'value',
      title: 'Value & Trade',
      icon: Coins,
      gradient: 'from-yellow-500 to-amber-500',
      fields: [
        { name: 'baseValue', label: 'Base Value', type: 'number', min: 0, unit: 'gp' },
        { name: 'marketValue', label: 'Market Value', type: 'number', min: 0, unit: 'gp' },
        { name: 'availability', label: 'Availability', type: 'dropdown', options: ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Unique'] },
        { name: 'craftingDifficulty', label: 'Crafting Difficulty', type: 'dropdown', options: ['Easy', 'Moderate', 'Hard', 'Very Hard', 'Legendary', 'Impossible'] },
        { name: 'craftingMaterials', label: 'Crafting Materials', type: 'array', itemType: 'text', addButtonText: 'Add Material' },
      ],
    },
  ],
};
