import { useEffect, useRef } from "react";

/**
 * Canvas constellation: drifting points linked by faint lines that lean
 * away from the cursor. Pauses when the tab is hidden, scales with DPR, and
 * draws a single static frame when the user prefers reduced motion.
 */
export default function ParticleField({ className = "", density = 0.00011, color = "237, 238, 240" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: -9999, y: -9999 };
    let particles = [];
    let frame = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(24, Math.min(140, Math.floor(width * height * density)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.6,
      }));
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      for (const p of particles) {
        if (!reduce) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance < 120 && distance > 0) {
            p.vx += (dx / distance) * 0.05;
            p.vy += (dy / distance) * 0.05;
          }
          p.vx *= 0.985;
          p.vy *= 0.985;
          p.x += p.vx + Math.sign(p.vx || 1) * 0.05;
          p.y += p.vy;
          if (p.x < -10) p.x = width + 10;
          if (p.x > width + 10) p.x = -10;
          if (p.y < -10) p.y = height + 10;
          if (p.y > height + 10) p.y = -10;
        }
        context.beginPath();
        context.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        context.fillStyle = `rgba(${color}, 0.55)`;
        context.fill();
      }
      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const a = particles[i];
          const b = particles[j];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance < 110) {
            context.strokeStyle = `rgba(${color}, ${0.16 * (1 - distance / 110)})`;
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.stroke();
          }
        }
      }
    };

    const loop = () => {
      draw();
      frame = requestAnimationFrame(loop);
    };

    const onPointerMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    };
    const onPointerLeave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
    };
    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden && !reduce) frame = requestAnimationFrame(loop);
    };

    resize();
    if (reduce) {
      draw();
    } else {
      frame = requestAnimationFrame(loop);
    }
    const observer = new ResizeObserver(() => {
      resize();
      if (reduce) draw();
    });
    observer.observe(canvas);
    window.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [density, color]);

  return <canvas ref={canvasRef} aria-hidden="true" className={["pointer-events-none h-full w-full", className].join(" ")} />;
}
