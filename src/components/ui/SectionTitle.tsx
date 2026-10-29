import type { ReactNode } from "react";

interface SectionTitleProps {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Titre de section : petit, semibold, avec action optionnelle à droite. */
export function SectionTitle({ children, action, className = "" }: SectionTitleProps) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <h2 className="section-title">{children}</h2>
      {action}
    </div>
  );
}
