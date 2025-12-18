import React from 'react';
import type { FieldDef } from '@/features/blueprint-hub/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

interface FieldGroupBlockProps {
  fields: FieldDef[];
  values: Record<string, any>;
  onChange: (fieldName: string, value: any) => void;
  errors?: Record<string, string>;
}

export function FieldGroupBlock({ fields, values, onChange, errors }: FieldGroupBlockProps) {
  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <FieldRenderer
          key={field.field_id}
          field={field}
          value={values[field.field_name]}
          onChange={(value) => onChange(field.field_name, value)}
          error={errors?.[field.field_name]}
        />
      ))}
    </div>
  );
}

interface FieldRendererProps {
  field: FieldDef;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}

function FieldRenderer({ field, value, onChange, error }: FieldRendererProps) {
  const renderField = () => {
    switch (field.data_type) {
      case 'string':
        return (
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.ui_hints?.placeholder || field.display_label}
            className={cn('bg-background/50', error && 'border-destructive')}
            disabled={field.ui_hints?.readonly}
          />
        );

      case 'text':
      case 'richtext':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.ui_hints?.placeholder || field.display_label}
            rows={field.ui_hints?.rows || 3}
            className={cn('bg-background/50 resize-none', error && 'border-destructive')}
            disabled={field.ui_hints?.readonly}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            placeholder={field.ui_hints?.placeholder || field.display_label}
            className={cn('bg-background/50', error && 'border-destructive')}
            disabled={field.ui_hints?.readonly}
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={value || false}
              onCheckedChange={onChange}
              disabled={field.ui_hints?.readonly}
            />
            <span className="text-sm text-muted-foreground">
              {value ? 'Yes' : 'No'}
            </span>
          </div>
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={cn('bg-background/50', error && 'border-destructive')}
            disabled={field.ui_hints?.readonly}
          />
        );

      case 'datetime':
        return (
          <Input
            type="datetime-local"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={cn('bg-background/50', error && 'border-destructive')}
            disabled={field.ui_hints?.readonly}
          />
        );

      case 'enum':
        const options = field.ui_hints?.options || [];
        return (
          <Select value={value || ''} onValueChange={onChange} disabled={field.ui_hints?.readonly}>
            <SelectTrigger className={cn('bg-background/50', error && 'border-destructive')}>
              <SelectValue placeholder={`Select ${field.display_label}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'json':
        return (
          <Textarea
            value={value ? JSON.stringify(value, null, 2) : ''}
            onChange={(e) => {
              try {
                onChange(JSON.parse(e.target.value));
              } catch {
                // Invalid JSON, keep as string for now
              }
            }}
            placeholder="JSON data"
            rows={field.ui_hints?.rows || 4}
            className={cn('bg-background/50 resize-none font-mono text-xs', error && 'border-destructive')}
            disabled={field.ui_hints?.readonly}
          />
        );

      default:
        return (
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.ui_hints?.placeholder || field.display_label}
            className={cn('bg-background/50', error && 'border-destructive')}
            disabled={field.ui_hints?.readonly}
          />
        );
    }
  };

  // Check if field should be hidden
  if (field.ui_hints?.hidden) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        {field.display_label}
        {field.is_required && <span className="text-destructive">*</span>}
      </Label>
      
      {field.description && (
        <p className="text-xs text-muted-foreground/70 mb-1">{field.description}</p>
      )}
      
      {field.ui_hints?.helpText && (
        <p className="text-xs text-muted-foreground/60 italic mb-1">{field.ui_hints.helpText}</p>
      )}
      
      {renderField()}
      
      {error && (
        <div className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
