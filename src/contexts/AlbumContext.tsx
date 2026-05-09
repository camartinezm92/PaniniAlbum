import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import { StickerState } from '../types/sticker';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface AlbumContextType {
  stickers: StickerState;
  shortId: string | null;
  friends: Record<string, { nickname: string, lastInteraction: number }>;
  updateSticker: (stickerId: string, delta: number) => void;
  clearSticker: (stickerId: string) => void;
  saveFriend: (shortId: string, nickname: string) => Promise<void>;
  loading: boolean;
}

const AlbumContext = createContext<AlbumContextType | null>(null);

export const useAlbum = () => {
  const context = useContext(AlbumContext);
  if (!context) throw new Error('useAlbum must be used within AlbumProvider');
  return context;
};

export const AlbumProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [stickers, setStickers] = useState<StickerState>({});
  const [shortId, setShortId] = useState<string | null>(null);
  const [friends, setFriends] = useState<Record<string, { nickname: string, lastInteraction: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setStickers({});
      setShortId(null);
      setFriends({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const albumRef = doc(db, 'albums', user.uid);
    const unsubscribe = onSnapshot(albumRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStickers(data.stickers || {});
        setFriends(data.friends || {});
        
        // If they don't have a shortId, generate one and save it
        if (!data.shortId) {
          const newShortId = user.uid.substring(0, 8).toUpperCase();
          setDoc(albumRef, { 
            shortId: newShortId,
            updatedAt: serverTimestamp() 
          }, { merge: true });
          setShortId(newShortId);
        } else {
          setShortId(data.shortId);
        }
      } else {
        // First time user: generate ID and create empty doc
        const newShortId = user.uid.substring(0, 8).toUpperCase();
        setDoc(albumRef, { 
          userId: user.uid, 
          stickers: {}, 
          shortId: newShortId,
          friends: {},
          updatedAt: serverTimestamp() 
        });
        setStickers({});
        setFriends({});
        setShortId(newShortId);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `albums/${user.uid}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const saveFriend = useCallback(async (friendShortId: string, nickname: string) => {
    if (!user) return;
    
    const albumRef = doc(db, 'albums', user.uid);
    try {
      await setDoc(albumRef, {
        friends: {
          [friendShortId]: {
            nickname,
            lastInteraction: Date.now()
          }
        },
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `albums/${user.uid}`);
    }
  }, [user]);

  const updateSticker = useCallback(async (stickerId: string, delta: number) => {
    if (!user) return;
    
    const currentCount = stickers[stickerId] || 0;
    const newCount = Math.max(0, currentCount + delta);
    
    // Update local state optimistically
    const newStickersState = { ...stickers };
    if (newCount === 0) {
      delete newStickersState[stickerId];
    } else {
      newStickersState[stickerId] = newCount;
    }
    setStickers(newStickersState);

    const albumRef = doc(db, 'albums', user.uid);
    try {
      // Correct nested update for setDoc with merge: true
      await setDoc(albumRef, {
        userId: user.uid,
        stickers: {
          [stickerId]: newCount === 0 ? deleteField() : newCount
        },
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `albums/${user.uid}`);
    }
  }, [user, stickers]);

  const clearSticker = useCallback(async (stickerId: string) => {
    if (!user) return;
    
    const newStickersState = { ...stickers };
    delete newStickersState[stickerId];
    setStickers(newStickersState);

    const albumRef = doc(db, 'albums', user.uid);
    try {
      await setDoc(albumRef, {
        userId: user.uid,
        stickers: {
          [stickerId]: deleteField()
        },
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `albums/${user.uid}`);
    }
  }, [user, stickers]);

  return (
    <AlbumContext.Provider value={{ stickers, shortId, friends, updateSticker, clearSticker, saveFriend, loading }}>
      {children}
    </AlbumContext.Provider>
  );
};
