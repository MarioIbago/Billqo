import {
  createElement,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import './TextType.css';

export interface TextTypeProps extends HTMLAttributes<HTMLElement> {
  text: string | string[];
  as?: ElementType;
  typingSpeed?: number;
  initialDelay?: number;
  pauseDuration?: number;
  deletingSpeed?: number;
  loop?: boolean;
  showCursor?: boolean;
  cursorCharacter?: ReactNode;
  cursorClassName?: string;
  startOnVisible?: boolean;
}

export default function TextType({
  text,
  as: Component = 'span',
  typingSpeed = 34,
  initialDelay = 80,
  pauseDuration = 1400,
  deletingSpeed = 24,
  loop = false,
  showCursor = false,
  cursorCharacter = '|',
  cursorClassName = '',
  startOnVisible = true,
  className = '',
  ...props
}: TextTypeProps) {
  const sentences = useMemo(() => (Array.isArray(text) ? text : [text]), [text]);
  const elementRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(!startOnVisible);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const reduceMotion = typeof window !== 'undefined'
    && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (!startOnVisible || !elementRef.current || reduceMotion) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
    }, { threshold: 0.18 });
    observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, [reduceMotion, startOnVisible]);

  useEffect(() => {
    if (reduceMotion) {
      setDisplayedText(sentences[0] ?? '');
      return;
    }
    if (!visible) return;

    const current = sentences[sentenceIndex] ?? '';
    let timeout: number | undefined;

    if (!deleting && displayedText.length < current.length) {
      const delay = displayedText.length === 0 ? initialDelay : typingSpeed;
      timeout = window.setTimeout(() => {
        setDisplayedText(current.slice(0, displayedText.length + 1));
      }, Math.max(16, delay));
    } else if (!deleting) {
      const hasNext = sentenceIndex < sentences.length - 1;
      if (hasNext || loop) {
        timeout = window.setTimeout(() => setDeleting(true), pauseDuration);
      }
    } else if (displayedText.length > 0) {
      timeout = window.setTimeout(() => {
        setDisplayedText((value) => value.slice(0, -1));
      }, Math.max(16, deletingSpeed));
    } else {
      setDeleting(false);
      setSentenceIndex((index) => (index + 1) % Math.max(sentences.length, 1));
    }

    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [
    deleting,
    deletingSpeed,
    displayedText,
    initialDelay,
    loop,
    pauseDuration,
    reduceMotion,
    sentenceIndex,
    sentences,
    typingSpeed,
    visible,
  ]);

  return createElement(
    Component,
    {
      ...props,
      ref: elementRef,
      className: `text-type ${className}`.trim(),
      'aria-label': sentences.join(' '),
    },
    <span className="text-type__content" aria-hidden="true">{displayedText}</span>,
    showCursor && !reduceMotion
      ? <span className={`text-type__cursor ${cursorClassName}`.trim()} aria-hidden="true">{cursorCharacter}</span>
      : null,
  );
}
