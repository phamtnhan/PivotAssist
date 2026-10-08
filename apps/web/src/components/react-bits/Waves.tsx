"use client";

import React, { useRef, useEffect, type CSSProperties } from "react";

class Grad {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  dot2(x: number, y: number): number {
    return this.x * x + this.y * y;
  }
}

class FastNoise {
  grad2: Grad[];
  p: Uint8Array;
  perm: Uint8Array;

  constructor(seed = 42) {
    this.grad2 = [
      new Grad(1, 0),
      new Grad(-1, 0),
      new Grad(0, 1),
      new Grad(0, -1),
      new Grad(0.7071, 0.7071),
      new Grad(-0.7071, 0.7071),
      new Grad(0.7071, -0.7071),
      new Grad(-0.7071, -0.7071),
    ];
    this.p = new Uint8Array(256);
    this.perm = new Uint8Array(512);

    for (let i = 0; i < 256; i++) {
      this.p[i] = i;
    }
    // Deterministic shuffle
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) % 2147483647;
      const j = s % (i + 1);
      const tmp = this.p[i];
      this.p[i] = this.p[j];
      this.p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
    }
  }

  perlin2(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);

    const g00 = this.grad2[this.perm[X + this.perm[Y]] & 7];
    const g10 = this.grad2[this.perm[X + 1 + this.perm[Y]] & 7];
    const g01 = this.grad2[this.perm[X + this.perm[Y + 1]] & 7];
    const g11 = this.grad2[this.perm[X + 1 + this.perm[Y + 1]] & 7];

    const n00 = g00.dot2(xf, yf);
    const n10 = g10.dot2(xf - 1, yf);
    const n01 = g01.dot2(xf, yf - 1);
    const n11 = g11.dot2(xf - 1, yf - 1);

    const nx0 = n00 + u * (n10 - n00);
    const nx1 = n01 + u * (n11 - n01);
    return nx0 + v * (nx1 - nx0);
  }
}

interface Point {
  x: number;
  y: number;
  wave: { x: number; y: number };
  cursor: { x: number; y: number; vx: number; vy: number };
}

export interface WavesProps {
  lineColor?: string;
  backgroundColor?: string;
  waveSpeedX?: number;
  waveSpeedY?: number;
  waveAmpX?: number;
  waveAmpY?: number;
  xGap?: number;
  yGap?: number;
  friction?: number;
  tension?: number;
  maxCursorMove?: number;
  style?: CSSProperties;
  className?: string;
}

export const Waves: React.FC<WavesProps> = ({
  lineColor = "rgba(66, 133, 244, 0.16)",
  backgroundColor = "transparent",
  waveSpeedX = 0.014,
  waveSpeedY = 0.007,
  waveAmpX = 36,
  waveAmpY = 22,
  xGap = 16,
  yGap = 32,
  friction = 0.92,
  tension = 0.005,
  maxCursorMove = 100,
  style = {},
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const noise = new FastNoise(108);
    let lines: Point[][] = [];
    let width = 0;
    let height = 0;
    let animId: number | null = null;
    let isVisible = true;

    const mouse = {
      x: -999,
      y: -999,
      lx: 0,
      ly: 0,
      sx: 0,
      sy: 0,
      v: 0,
      vs: 0,
      a: 0,
      set: false,
    };

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      if (!container || !canvas || !ctx) return;
      const rect = container.getBoundingClientRect();
      width = rect.width || 1;
      height = rect.height || 1;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      buildLines();
    }

    function buildLines() {
      lines = [];
      const oWidth = width + 160;
      const oHeight = height + 40;
      const totalLines = Math.ceil(oWidth / xGap);
      const totalPoints = Math.ceil(oHeight / yGap);
      const xStart = (width - xGap * totalLines) / 2;
      const yStart = (height - yGap * totalPoints) / 2;

      for (let i = 0; i <= totalLines; i++) {
        const pts: Point[] = [];
        const px = xStart + xGap * i;
        for (let j = 0; j <= totalPoints; j++) {
          pts.push({
            x: px,
            y: yStart + yGap * j,
            wave: { x: 0, y: 0 },
            cursor: { x: 0, y: 0, vx: 0, vy: 0 },
          });
        }
        lines.push(pts);
      }
    }

    function updatePoints(time: number) {
      const radius = Math.max(160, mouse.vs);
      const radiusSq = radius * radius;
      const mouseSpeedFactor = mouse.vs * 0.00055;
      const tSec = time * 0.001;

      for (let i = 0; i < lines.length; i++) {
        const pts = lines[i];
        for (let j = 0; j < pts.length; j++) {
          const p = pts[j];
          const move =
            noise.perlin2(
              p.x * 0.002 + tSec * (waveSpeedX || 0.015) * 60,
              p.y * 0.0015 + tSec * (waveSpeedY || 0.008) * 45,
            ) * 12;
          const ambient = Math.sin(p.x * 0.006 + tSec * 0.9 + i * 0.08) * (waveAmpY * 0.22);
          p.wave.x = Math.cos(move) * waveAmpX;
          p.wave.y = Math.sin(move) * waveAmpY + ambient;

          const dx = p.x - mouse.sx;
          const dy = p.y - mouse.sy;
          const distSq = dx * dx + dy * dy;

          if (distSq < radiusSq) {
            const dist = Math.sqrt(distSq);
            const s = 1 - dist / radius;
            const f = Math.cos(dist * 0.001) * s;
            p.cursor.vx += Math.cos(mouse.a) * f * radius * mouseSpeedFactor;
            p.cursor.vy += Math.sin(mouse.a) * f * radius * mouseSpeedFactor;
          }

          p.cursor.vx += -p.cursor.x * tension;
          p.cursor.vy += -p.cursor.y * tension;
          p.cursor.vx *= friction;
          p.cursor.vy *= friction;
          p.cursor.x += p.cursor.vx * 1.8;
          p.cursor.y += p.cursor.vy * 1.8;

          if (p.cursor.x > maxCursorMove) p.cursor.x = maxCursorMove;
          else if (p.cursor.x < -maxCursorMove) p.cursor.x = -maxCursorMove;

          if (p.cursor.y > maxCursorMove) p.cursor.y = maxCursorMove;
          else if (p.cursor.y < -maxCursorMove) p.cursor.y = -maxCursorMove;
        }
      }
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;

      for (let i = 0; i < lines.length; i++) {
        const pts = lines[i];
        if (pts.length < 2) continue;

        const first = pts[0];
        ctx.moveTo(
          first.x + first.wave.x + first.cursor.x,
          first.y + first.wave.y + first.cursor.y,
        );

        for (let j = 1; j < pts.length; j++) {
          const p = pts[j];
          ctx.lineTo(p.x + p.wave.x + p.cursor.x, p.y + p.wave.y + p.cursor.y);
        }
      }
      ctx.stroke();
    }

    function loop(t: number) {
      if (isVisible) {
        // Smooth mouse interpolation
        mouse.sx += (mouse.x - mouse.sx) * 0.12;
        mouse.sy += (mouse.y - mouse.sy) * 0.12;
        const dx = mouse.x - mouse.lx;
        const dy = mouse.y - mouse.ly;
        const d = Math.sqrt(dx * dx + dy * dy);
        mouse.v = d;
        mouse.vs += (d - mouse.vs) * 0.1;
        if (mouse.vs > 100) mouse.vs = 100;
        mouse.lx = mouse.x;
        mouse.ly = mouse.y;
        mouse.a = Math.atan2(dy, dx);

        updatePoints(t);
        draw();
      }
      animId = requestAnimationFrame(loop);
    }

    function onMouseMove(e: MouseEvent) {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      if (!mouse.set) {
        mouse.sx = mouse.x;
        mouse.sy = mouse.y;
        mouse.lx = mouse.x;
        mouse.ly = mouse.y;
        mouse.set = true;
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.05 },
    );

    observer.observe(container);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        resize();
      });
      resizeObserver.observe(container);
    }

    resize();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      updatePoints(0);
      draw();
    } else {
      animId = requestAnimationFrame(loop);
      window.addEventListener("mousemove", onMouseMove, { passive: true });
    }
    window.addEventListener("resize", resize);

    return () => {
      observer.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      if (animId !== null) cancelAnimationFrame(animId);
    };
  }, [
    lineColor,
    waveSpeedX,
    waveSpeedY,
    waveAmpX,
    waveAmpY,
    xGap,
    yGap,
    friction,
    tension,
    maxCursorMove,
  ]);

  return (
    <div
      ref={containerRef}
      style={{
        backgroundColor,
        maskImage:
          "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 12%, rgba(0,0,0,0.95) 80%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 12%, rgba(0,0,0,0.95) 80%, transparent 100%)",
        ...style,
      }}
      className={`absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none ${className}`}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};

export default Waves;
