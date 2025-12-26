import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ENTITY_KINDS, ENTITY_COLORS, ENTITY_ICONS, type EntityKind } from '@/lib/entities/entityTypes';

interface EntityKindSelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  excludeKinds?: EntityKind[];
}

const DEFAULT_EXCLUDED: EntityKind[] = ['NETWORK'];

function formatKindLabel(kind: EntityKind): string {
  return kind.charAt(0) + kind.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function EntityKindSelector({
  value,
  onChange,
  placeholder = 'Select entity type',
  disabled = false,
  excludeKinds = DEFAULT_EXCLUDED,
}: EntityKindSelectorProps) {
  const availableKinds = ENTITY_KINDS.filter(
    (kind) => !excludeKinds.includes(kind)
  );

  const selectedKind = value as EntityKind | undefined;
  const SelectedIcon = selectedKind ? ENTITY_ICONS[selectedKind] : null;
  const selectedColor = selectedKind ? ENTITY_COLORS[selectedKind] : undefined;

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>
          {selectedKind && SelectedIcon && (
            <span className="flex items-center gap-2">
              <SelectedIcon className="w-4 h-4" style={{ color: selectedColor }} />
              <span style={{ color: selectedColor }} className="font-medium">
                {formatKindLabel(selectedKind)}
              </span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {availableKinds.map((kind) => {
          const Icon = ENTITY_ICONS[kind];
          const color = ENTITY_COLORS[kind];
          return (
            <SelectItem
              key={kind}
              value={kind}
              className="relative pl-4 cursor-pointer"
            >
              <span
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l"
                style={{ backgroundColor: color }}
              />
              <span className="flex items-center gap-2">
                <Icon className="w-4 h-4" style={{ color }} />
                <span style={{ color }} className="font-medium">
                  {formatKindLabel(kind)}
                </span>
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
