import { useEffect, useCallback, useRef } from 'react';

interface UseScannerProps {
  onScan: (barcode: string) => void;
  // Maximum time between keystrokes to be considered a scanner input
  maxDelay?: number;
  // Minimum length of a barcode
  minLength?: number;
}

export function useScanner({ onScan, maxDelay = 50, minLength = 3 }: UseScannerProps) {
  const buffer = useRef<string>('');
  const lastKeyTime = useRef<number>(Date.now());
  const timer = useRef<NodeJS.Timeout | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if the event is happening inside an input, textarea, etc (unless it's a generic search input)
      // Usually POS scanners emulate keyboard but we don't want to interfere with manual typing in specific fields.
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      // If user is manually typing, let them. If the scanner is fast enough, it will still capture.
      // But scanners often fire very quickly.
      
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime.current;
      
      if (timeDiff > maxDelay) {
        // Reset buffer if delay is too long (human typing)
        buffer.current = '';
      }

      lastKeyTime.current = currentTime;

      // Handle Enter key which usually terminates a barcode scan
      if (e.key === 'Enter') {
        if (buffer.current.length >= minLength) {
          // Play a success beep
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            osc.connect(gainNode);
            gainNode.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
          } catch (err) {
            // Ignore audio context errors
          }

          onScan(buffer.current);
          buffer.current = '';
          
          if (!isInput) {
            e.preventDefault();
          }
        }
        return;
      }

      // Append printable characters to the buffer
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        buffer.current += e.key;
      }

      // Clear the buffer after a timeout
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => {
        buffer.current = '';
      }, maxDelay * 2);
    },
    [onScan, maxDelay, minLength]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [handleKeyDown]);
}
