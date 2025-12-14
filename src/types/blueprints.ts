import { AttributeType } from './attributes';

export interface AttributeTemplate {
  id: string;
  name: string;
  type: AttributeType;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

export interface EntityBlueprint {
  id: string;
  entityKind: string;
  name: string;
  description: string;
  templates: AttributeTemplate[];
  createdAt: string;
  updatedAt: string;
}
