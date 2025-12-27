/// <reference types="vite/client" />

declare module 'react-virtualized-auto-sizer' {
    import { ReactNode } from 'react';

    export interface AutoSizerProps {
        children: (size: { height: number; width: number }) => ReactNode;
        className?: string;
        defaultHeight?: number;
        defaultWidth?: number;
        disableHeight?: boolean;
        disableWidth?: boolean;
        onResize?: (size: { height: number; width: number }) => void;
        style?: React.CSSProperties;
    }

    export default function AutoSizer(props: AutoSizerProps): JSX.Element;
}
