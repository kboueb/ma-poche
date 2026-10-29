import type { ReactNode, CSSProperties } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Effet hover (bordure + glow) pour les cartes cliquables */
  interactive?: boolean;
  /** Index pour l'apparition en cascade (style --stagger) */
  stagger?: number;
  style?: CSSProperties;
  onClick?: () => void;
}

export function Card({ children, className, interactive, stagger, style, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={stagger !== undefined ? { ...style, "--stagger": stagger } as CSSProperties : style}
      className={twMerge(clsx(
        "card",
        interactive && "card-interactive cursor-pointer",
        stagger !== undefined && "animate-fade-up",
        className
      ))}
    >
      {children}
    </div>
  );
}
