import { useState } from 'react';

export default function useSidebar(isDrawer = false) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggle() {
    if (isDrawer || window.matchMedia('(max-width: 800px)').matches) setMobileOpen((o) => !o);
    else setCollapsed((c) => !c);
  }

  function closeMobile() {
    setMobileOpen(false);
  }

  return { collapsed, mobileOpen, toggle, closeMobile };
}
