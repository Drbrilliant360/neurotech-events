import { animate } from "animejs";
import { useEffect } from "react";

const CONTROL_SELECTOR = ".nt-btn:not(:disabled), .nt-chip:not(:disabled), .nt-choice:not(:disabled), .nt-arrow-link";
const HOVER_SELECTOR = `${CONTROL_SELECTOR}, .nt-card, .nt-event-card`;

function findInteractiveTarget(target: EventTarget | null, selector: string): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(selector) : null;
}

function releaseTransform(target: HTMLElement) {
  target.style.removeProperty("transform");
}

/** Adds unobtrusive motion to existing controls without changing their behavior or markup. */
export function InteractionMotion() {
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) return;

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = findInteractiveTarget(event.target, HOVER_SELECTOR);
      if (!target || target.contains(event.relatedTarget as Node | null)) return;

      const isCard = target.matches(".nt-card, .nt-event-card");
      animate(target, {
        scale: isCard ? 1.01 : 1.025,
        translateY: isCard ? -4 : -2,
        duration: 220,
        ease: "out(3)",
        onComplete: () => releaseTransform(target),
      });
    };

    const onPointerOut = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = findInteractiveTarget(event.target, HOVER_SELECTOR);
      if (!target || target.contains(event.relatedTarget as Node | null)) return;

      animate(target, {
        scale: 1,
        translateY: 0,
        duration: 180,
        ease: "out(3)",
        onComplete: () => releaseTransform(target),
      });
    };

    const onPress = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = findInteractiveTarget(event.target, CONTROL_SELECTOR);
      if (!target) return;

      animate(target, {
        scale: [1, 0.96, 1],
        duration: 320,
        ease: "out(3)",
        onComplete: () => releaseTransform(target),
      });
    };

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("pointerdown", onPress);
    return () => {
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("pointerdown", onPress);
    };
  }, []);

  return null;
}
