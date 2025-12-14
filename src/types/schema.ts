export type EntityShape = 'rectangle' | 'roundrectangle' | 'ellipse' | 'triangle' | 'diamond' | 'hexagon' | 'star';

export interface EntityType {
  kind: string;
  labelProp: string;
  defaultStyle?: {
    shape?: EntityShape;
    color?: string;
  };
}

export interface RelationshipType {
  label: string;
  from: string | string[];
  to: string | string[];
  directed: boolean;
  defaultStyle?: {
    color?: string;
  };
}

export const ENTITY_SHAPES: EntityShape[] = ['rectangle', 'roundrectangle', 'ellipse', 'triangle', 'diamond', 'hexagon', 'star'];
