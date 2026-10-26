import type { ComponentType } from 'react';

export interface FrontFixAppProps {
  onClose?: () => void;
  isDrawer?: boolean;
  initialError?: any;
}

declare const FrontFixApp: ComponentType<FrontFixAppProps>;
export default FrontFixApp;
