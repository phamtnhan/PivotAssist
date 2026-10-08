"use client";

import { useState, type HTMLAttributes, type PointerEvent } from "react";

import { cn } from "@/lib/utils";

type SpotlightCardProps = HTMLAttributes<HTMLDivElement> & {
  spotlightColor?: string;
};

/**
 * Adapted from React Bits' SpotlightCard component.
 * Source: https://github.com/DavidHDev/react-bits/tree/main/src/ts-tailwind/Components/SpotlightCard
 */
export function SpotlightCard({
  children,
  className,
  spotlightColor = "rgba(0, 143, 95, 0.14)",
  ...props
}: SpotlightCardProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setPosition({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
  };

  return (
    <div
      {...props}
      data-react-bits="spotlight-card"
      className={cn("group relative isolate overflow-hidden", className)}
      onPointerMove={handlePointerMove}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(420px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 72%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
