import React, { useState, useRef } from 'react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface StickerButtonProps {
  id: string;
  count: number;
  onClick: () => void;
  onLongPress: () => void;
  label?: string;
  className?: string;
}

export const StickerButton: React.FC<StickerButtonProps> = ({ 
  id, 
  count, 
  onClick, 
  onLongPress,
  label,
  className
}) => {
  const [isPressing, setIsPressing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    
    setIsPressing(true);
    isLongPress.current = false;

    timerRef.current = setTimeout(() => {
      onLongPress();
      isLongPress.current = true;
      setIsPressing(false);
      if (window.navigator.vibrate) window.navigator.vibrate(50);
    }, 450); // Shorter but distinguishable from a tap
  };

  const handlePointerUp = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    if (isPressing && !isLongPress.current) {
      onClick();
    }
    
    setIsPressing(false);
    isLongPress.current = false;
  };

  const handlePointerCancel = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPressing(false);
    isLongPress.current = false;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onContextMenu={handleContextMenu}
      className={cn(
        "relative flex flex-col items-center justify-center h-14 w-full rounded-2xl border-2 transition-all duration-200 select-none touch-none",
        count > 0 
          ? "bg-blue-600 border-blue-600 text-white font-black shadow-lg shadow-blue-500/20" 
          : "bg-white dark:bg-gray-800 border-gray-100 dark:border-white/5 text-gray-400 hover:border-blue-500/30",
        isPressing && "scale-95",
        className
      )}
    >
      <span className="text-sm">{label || id.split('-').pop()}</span>
      <AnimatePresence>
        {count > 1 && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full z-10 shadow-lg min-w-[20px] text-center"
          >
            x{count}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
};
