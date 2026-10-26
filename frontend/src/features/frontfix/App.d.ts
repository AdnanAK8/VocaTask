import type { ComponentType } from 'react';

export interface FrontFixAppProps {
  onClose?: () => void;
  isDrawer?: boolean;
}

declare const FrontFixApp: ComponentType<FrontFixAppProps>;
export default FrontFixApp;
