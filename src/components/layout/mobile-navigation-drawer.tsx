"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

type MobileNavigationDrawerProps = {
  branding: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  closeLabel: string;
  drawerLabel: string;
  id: string;
  triggerLabel: string;
};

export function MobileNavigationDrawer({
  branding,
  children,
  closeLabel,
  drawerLabel,
  id,
  triggerLabel,
}: MobileNavigationDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const opener = openerRef.current;
    const drawer = drawerRef.current;
    if (!drawer) return;
    const activeDrawer = drawer;
    const selector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");

    const getFocusable = () =>
      Array.from(activeDrawer.querySelectorAll<HTMLElement>(selector));

    getFocusable()[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      const active = document.activeElement;
      const outside = active instanceof Node && !activeDrawer.contains(active);
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, [isOpen]);

  const close = () => setIsOpen(false);

  return (
    <>
      <button
        ref={openerRef}
        aria-controls={id}
        aria-expanded={isOpen}
        aria-label={triggerLabel}
        className="border-border bg-background text-foreground hover:bg-muted inline-flex size-10 items-center justify-center rounded-lg border lg:hidden"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label={closeLabel}
            className="bg-sidebar-overlay absolute inset-0"
            onClick={close}
            type="button"
          />
          <aside
            ref={drawerRef}
            aria-label={drawerLabel}
            aria-modal="true"
            className="bg-sidebar absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col overflow-hidden border-r p-5 shadow-2xl"
            id={id}
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              {branding}
              <button
                aria-label={closeLabel}
                className="border-border text-sidebar-foreground hover:bg-sidebar-active inline-flex size-10 shrink-0 items-center justify-center rounded-lg border"
                onClick={close}
                type="button"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <div className="mt-7 min-h-0 flex-1 overflow-y-auto">
              {children(close)}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
