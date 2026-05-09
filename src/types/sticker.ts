export interface Team {
  id: string;
  name: string;
  flag: string;
  group: string;
}

export interface StickerState {
  [stickerId: string]: number; // stickerId -> count
}

export interface AlbumData {
  userId: string;
  shortId: string;
  stickers: StickerState;
  friends?: Record<string, { nickname: string, lastInteraction: number }>;
  updatedAt: unknown;
}

export interface TradeProposal {
  id: string;
  fromId: string;
  fromUid: string;
  toId: string;
  toUid: string;
  give: string[];
  get: string[];
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
  createdAt: unknown;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  email: string | null;
}
