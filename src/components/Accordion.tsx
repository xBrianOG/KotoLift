import { useState, PropsWithChildren } from 'react';

type AccordionProps = PropsWithChildren<{
  title: string;
  defaultOpen?: boolean;
}>;

export function Accordion({ title, defaultOpen = false, children }: AccordionProps) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  return (
    <div className="accordion card" style={{ padding: 0, marginBottom: 12 }}>
      <div
        className="accordion-header"
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, cursor: 'pointer', background: 'var(--bg-card)' }}
      >
        <strong>{title}</strong>
        <span aria-label="toggle">{open ? '−' : '+'}</span>
      </div>
      {open && (
        <div className="accordion-content" style={{ padding: 12 }}>{children}</div>
      )}
    </div>
  );
}
