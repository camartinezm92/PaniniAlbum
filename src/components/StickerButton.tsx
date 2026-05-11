import React, { useState, useRef } from 'react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { getFlagUrl } from '../constants/countryData';

interface StickerButtonProps {
  id: string;
  count: number;
  onClick: () => void;
  onLongPress: () => void;
  label?: string;
  className?: string;
  isSpecial?: boolean;
  playerName?: string;
}

export const StickerButton: React.FC<StickerButtonProps> = ({ 
  id, 
  count, 
  onClick, 
  onLongPress,
  label,
  className,
  isSpecial,
  playerName
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

  const countryCode = id.includes('-') ? id.split('-')[0] : null;

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onContextMenu={handleContextMenu}
      className={cn(
        "relative flex flex-col items-center justify-center h-14 w-full rounded-2xl border-2 transition-all duration-200 select-none touch-none group",
        count > 0 
          ? cn(
              "text-white font-black shadow-lg shadow-blue-500/20",
              isSpecial 
                ? "bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 border-amber-300 shadow-amber-500/20" 
                : "bg-blue-600 border-blue-600"
            )
          : cn(
              "bg-white dark:bg-gray-800 border-gray-100 dark:border-white/5 text-gray-400 hover:border-blue-500/30",
              isSpecial && "border-amber-500/30 bg-amber-50/5 dark:bg-amber-900/10"
            ),
        isPressing && "scale-95",
        className
      )}
    >
      {/* Clipping Wrapper for Background & Watermark */}
      <div className="absolute inset-0 rounded-[14px] overflow-hidden pointer-events-none">
        {/* Watermark Flag for regular stickers */}
        {countryCode && count > 0 && !isSpecial && (
          <div className="absolute inset-0 opacity-30 pointer-events-none group-hover:opacity-45 transition-opacity">
            <img src={getFlagUrl(countryCode)} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
          </div>
        )}
      </div>

      <span className={cn("relative z-10 text-sm", playerName ? "font-black" : "")}>{label || id.split('-').pop()}</span>
      {playerName && (
        <span className="relative z-10 text-[9px] leading-[1.1] uppercase font-bold text-center px-0.5 opacity-90 truncate w-full mt-0.5">
          {playerName}
        </span>
      )}
      <AnimatePresence>
        {count > 1 && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full z-20 shadow-xl min-w-[24px] text-center font-black border-2 border-white dark:border-gray-900"
          >
            x{count}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
};
