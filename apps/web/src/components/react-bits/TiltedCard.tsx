"use client";

import { useRef, useState, type HTMLAttributes, type PointerEvent } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type SpringOptions,
} from "motion/react";

import { cn } from "@/lib/utils";

type TiltedCardProps = HTMLAttributes<HTMLDivElement> & {
  captionText?: string;
  scaleOnHover?: number;
  rotateAmplitude?: number;
};

const springValues: SpringOptions = {
  damping: 30,
  stiffness: 100,
  mass: 2,
};

/**
 * Adapted from React Bits' TiltedCard component.
 * Source: https://github.com/DavidHDev/react-bits/tree/main/src/ts-tailwind/Components/TiltedCard
 *
 * PivotAssist uses a generic content slot instead of an image-only API so the
 * interview scene can remain accessible HTML while still gaining the 3D card
 * interaction.
 */
export function TiltedCard({
  children,
  className,
  captionText,
  scaleOnHover = 1.035,
  rotateAmplitude = 7,
  ...props
}: TiltedCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useMotionValue(0), springValues);
  const rotateY = useSpring(useMotionValue(0), springValues);
  const scale = useSpring(1, springValues);
  const opacity = useSpring(0, springValues);
  const rotateCaption = useSpring(0, {
    stiffness: 350,
    damping: 30,
    mass: 1,
  });
  const reduceMotion = useReducedMotion() ?? false;
  const [lastY, setLastY] = useState(0);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (reduceMotion || !ref.current) return;

    const bounds = ref.current.getBoundingClientRect();
    const offsetX = event.clientX - bounds.left - bounds.width / 2;
    const offsetY = event.clientY - bounds.top - bounds.height / 2;
    const rotationX = (offsetY / (bounds.height / 2)) * -rotateAmplitude;
    const rotationY = (offsetX / (bounds.width / 2)) * rotateAmplitude;

    rotateX.set(rotationX);
    rotateY.set(rotationY);
    x.set(event.clientX - bounds.left);
    y.set(event.clientY - bounds.top);

    const velocityY = offsetY - lastY;
    rotateCaption.set(-velocityY * 0.6);
    setLastY(offsetY);
  };

  const handlePointerEnter = () => {
    if (reduceMotion) return;
    scale.set(scaleOnHover);
    opacity.set(1);
  };

  const handlePointerLeave = () => {
    scale.set(1);
    opacity.set(0);
    rotateX.set(0);
    rotateY.set(0);
    rotateCaption.set(0);
    setLastY(0);
  };

  return (
    <div
      {...props}
      ref={ref}
      data-react-bits="tilted-card"
      className={cn("relative h-full w-full [perspective:1200px]", className)}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        style={{ rotateX, rotateY, scale }}
      >
        {children}
      </motion.div>

      {captionText && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-20 hidden rounded-md bg-white px-2.5 py-1 text-[10px] font-semibold text-ink shadow-lg sm:block"
          style={{ x, y, opacity, rotate: rotateCaption }}
        >
          {captionText}
        </motion.div>
      )}
    </div>
  );
}
