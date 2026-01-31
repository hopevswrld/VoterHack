import { useEffect, useState, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * Hook to track scroll position for parallax effects
 */
export function useScrollY() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return scrollY;
}

/**
 * Hook to detect when an element enters the viewport
 */
export function useInView(
  ref: RefObject<HTMLElement | null>,
  options: { threshold?: number; rootMargin?: string; once?: boolean } = {}
) {
  const { threshold = 0.1, rootMargin = '0px', once = true } = options;
  const [isInView, setIsInView] = useState(false);
  const hasTriggered = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          if (once) {
            hasTriggered.current = true;
            observer.disconnect();
          }
        } else if (!once && !hasTriggered.current) {
          setIsInView(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, threshold, rootMargin, once]);

  return isInView;
}

/**
 * Combined hook for scroll-triggered animations with stagger support
 */
export function useScrollAnimation<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const isInView = useInView(ref);

  const getAnimationClass = () =>
    `transition-all duration-700 ease-out ${
      isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
    }`;

  const getStaggerStyle = (index: number, baseDelay = 0) => ({
    transitionDelay: `${baseDelay + index * 80}ms`,
  });

  return { ref, isInView, getAnimationClass, getStaggerStyle };
}

/**
 * Hook for animated number counting
 */
export function useAnimatedNumber(
  value: number,
  duration = 500
): number {
  const [displayValue, setDisplayValue] = useState(value);
  const startTime = useRef<number | null>(null);
  const startValue = useRef(value);

  useEffect(() => {
    if (value === displayValue) return;

    startValue.current = displayValue;
    startTime.current = null;

    const animate = (currentTime: number) => {
      if (startTime.current === null) {
        startTime.current = currentTime;
      }

      const elapsed = currentTime - startTime.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const current = Math.round(
        startValue.current + (value - startValue.current) * easeOut
      );

      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return displayValue;
}
