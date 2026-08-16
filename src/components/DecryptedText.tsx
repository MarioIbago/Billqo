import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './DecryptedText.css';

export interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  sequential?: boolean;
  revealDirection?: 'start' | 'end' | 'center';
  characters?: string;
  className?: string;
  parentClassName?: string;
  encryptedClassName?: string;
  animateOn?: 'view' | 'hover';
}

function nonWhitespaceIndices(text: string): number[] {
  return Array.from(text).flatMap((character, index) => (/\s/.test(character) ? [] : [index]));
}

function revealOrder(text: string, direction: DecryptedTextProps['revealDirection']): number[] {
  const indices = nonWhitespaceIndices(text);
  if (direction === 'end') return [...indices].reverse();
  if (direction !== 'center') return indices;

  const center = (text.length - 1) / 2;
  return [...indices].sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
}

function allVisibleIndices(text: string): Set<number> {
  return new Set(Array.from(text, (_character, index) => index));
}

function whitespaceIndices(text: string): Set<number> {
  return new Set(Array.from(text).flatMap((character, index) => (/\s/.test(character) ? [index] : [])));
}

export default function DecryptedText({
  text,
  speed = 34,
  maxIterations = 9,
  sequential = true,
  revealDirection = 'start',
  characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+<>?',
  className = '',
  parentClassName = '',
  encryptedClassName = '',
  animateOn = 'view',
}: DecryptedTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [displayText, setDisplayText] = useState(text);
  const [revealed, setRevealed] = useState<Set<number>>(() => allVisibleIndices(text));
  const [runId, setRunId] = useState(0);
  const hasAnimatedRef = useRef(false);

  const characterPool = useMemo(() => characters.split('').filter(Boolean), [characters]);

  const scramble = useCallback((visible: Set<number>) => {
    return Array.from(text)
      .map((character, index) => {
        if (/\s/.test(character) || visible.has(index)) return character;
        return characterPool[Math.floor(Math.random() * characterPool.length)] ?? character;
      })
      .join('');
  }, [characterPool, text]);

  const start = useCallback(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setDisplayText(text);
      setRevealed(allVisibleIndices(text));
      return;
    }

    const initial = whitespaceIndices(text);
    setRevealed(initial);
    setDisplayText(scramble(initial));
    setRunId((value) => value + 1);
  }, [scramble, text]);

  useEffect(() => {
    setDisplayText(text);
    setRevealed(allVisibleIndices(text));
    hasAnimatedRef.current = false;
  }, [text]);

  useEffect(() => {
    if (runId === 0) return;

    let current = whitespaceIndices(text);
    const order = revealOrder(text, revealDirection);
    let pointer = 0;
    let iteration = 0;

    const timer = window.setInterval(() => {
      if (sequential) {
        if (pointer >= order.length) {
          window.clearInterval(timer);
          setRevealed(allVisibleIndices(text));
          setDisplayText(text);
          return;
        }

        current = new Set(current);
        current.add(order[pointer]);
        pointer += 1;
        setRevealed(current);
        setDisplayText(scramble(current));
        return;
      }

      iteration += 1;
      if (iteration >= maxIterations) {
        window.clearInterval(timer);
        setRevealed(allVisibleIndices(text));
        setDisplayText(text);
        return;
      }
      setDisplayText(scramble(current));
    }, Math.max(16, speed));

    return () => window.clearInterval(timer);
  }, [maxIterations, revealDirection, runId, scramble, sequential, speed, text]);

  useEffect(() => {
    if (animateOn !== 'view') return;
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || hasAnimatedRef.current) return;
      hasAnimatedRef.current = true;
      start();
    }, { threshold: 0.18 });

    observer.observe(element);
    return () => observer.disconnect();
  }, [animateOn, start]);

  return (
    <span
      ref={containerRef}
      className={`decrypted-text ${parentClassName}`.trim()}
      aria-label={text.replace(/\s+/g, ' ').trim()}
      onMouseEnter={animateOn === 'hover' ? start : undefined}
    >
      <span aria-hidden="true">
        {Array.from(displayText).map((character, index) => (
          <span
            key={`${index}-${character}`}
            className={revealed.has(index) ? className : encryptedClassName}
          >
            {character}
          </span>
        ))}
      </span>
    </span>
  );
}
