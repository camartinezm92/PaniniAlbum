import React, { useState, useEffect, useMemo } from 'react';
import { TEAMS, SPECIALS } from './constants/teams';
import { PLAYER_NAMES } from './constants/playerNames';
import { COUNTRY_COLORS, getFlagUrl } from './constants/countryData';
import { useAlbum } from './contexts/AlbumContext';
import { useAuth } from './contexts/AuthContext';
import { Navbar } from './components/Navbar';
import { StickerButton } from './components/StickerButton';
import { Search, Share2, Users, ArrowLeftRight, ChevronRight, Trophy, LayoutGrid, List, Copy, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { doc, getDoc, collection, query, where, getDocs, limit, onSnapshot, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, signInWithGoogle } from './firebase';
import { useSearchParams } from 'react-router-dom';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';
import { TradeProposal } from './types/sticker';

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const { stickers, shortId, friends, saveFriend } = useAlbum();
  const [searchParams] = useSearchParams();
  
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'groups' | 'alphabetical'>('groups');
  const [activeTab, setActiveTab] = useState<'album' | 'specials' | 'summary' | 'proposals'>('album');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [compareInput, setCompareInput] = useState('');
  const [isSearchingId, setIsSearchingId] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  
  const [compareData, setCompareData] = useState<{ userId: string; name: string; stickers: Record<string, number>; shortId: string } | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [isViewingFriendAlbum, setIsViewingFriendAlbum] = useState(false);
  const [tradeProposal, setTradeProposal] = useState<{ give: string[], get: string[] }>({ give: [], get: [] });
  const [incomingProposals, setIncomingProposals] = useState<TradeProposal[]>([]);
  const [outgoingProposals, setOutgoingProposals] = useState<TradeProposal[]>([]);

  const proposals = useMemo(() => {
    const all = [...incomingProposals, ...outgoingProposals];
    const seen = new Set();
    return all.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [incomingProposals, outgoingProposals]);

  const compareId = searchParams.get('compare');

  useEffect(() => {
    if (!user) {
      setIncomingProposals([]);
      setOutgoingProposals([]);
      return;
    }
    
    const qIncoming = query(
      collection(db, 'proposals'),
      where('toUid', '==', user.uid),
      where('status', 'in', ['pending', 'accepted'])
    );
    
    const qOutgoing = query(
      collection(db, 'proposals'),
      where('fromUid', '==', user.uid),
      where('status', 'in', ['pending', 'accepted'])
    );

    const unsubIncoming = onSnapshot(qIncoming, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TradeProposal));
      setIncomingProposals(docs);
    });

    const unsubOutgoing = onSnapshot(qOutgoing, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TradeProposal));
      setOutgoingProposals(docs);
    });

    return () => {
      unsubIncoming();
      unsubOutgoing();
    };
  }, [user]);

  const activeStickers = useMemo(() => {
    if (isViewingFriendAlbum && compareData) return compareData.stickers;
    return stickers;
  }, [isViewingFriendAlbum, compareData, stickers]);

  const groups = useMemo(() => {
    const map: Record<string, typeof TEAMS> = {};
    TEAMS.forEach(team => {
      if (!map[team.group]) map[team.group] = [];
      map[team.group].push(team);
    });
    return Object.keys(map).sort().map(g => {
      const gTeams = map[g];
      let owned = 0;
      const total = gTeams.length * 20;
      gTeams.forEach(t => {
        for(let i=1; i<=20; i++) {
          if ((activeStickers[`${t.id}-${i}`] || 0) > 0) owned++;
        }
      });
      return { 
        id: g, 
        teams: gTeams,
        owned,
        total,
        percent: Math.round((owned / total) * 100)
      };
    });
  }, [activeStickers]);

  const missingStickers = useMemo(() => {
    const missing: { id: string; name: string; stickers: number[] }[] = [];
    
    TEAMS.forEach(team => {
      const teamMissing = Array.from({ length: 20 }, (_, i) => i + 1)
        .filter(n => (activeStickers[`${team.id}-${n}`] || 0) === 0);
      if (teamMissing.length > 0) {
        missing.push({ id: team.id, name: team.name, stickers: teamMissing });
      }
    });

    Object.entries(SPECIALS).forEach(([key, info]) => {
      const specialMissing = Array.from({ length: info.count }, (_, i) => i + 1)
        .filter(n => (activeStickers[`${key}-${n}`] || 0) === 0);
      if (specialMissing.length > 0) {
        missing.push({ id: key, name: info.name, stickers: specialMissing });
      }
    });

    return missing;
  }, [activeStickers]);

  const repeatedStickers = useMemo(() => {
    const repeated: { id: string; name: string; stickers: { num: number; count: number }[] }[] = [];
    
    TEAMS.forEach(team => {
      const teamRepeated = Array.from({ length: 20 }, (_, i) => i + 1)
        .map(n => ({ num: n, count: activeStickers[`${team.id}-${n}`] || 0 }))
        .filter(s => s.count > 1);
      if (teamRepeated.length > 0) {
        repeated.push({ id: team.id, name: team.name, stickers: teamRepeated });
      }
    });

    Object.entries(SPECIALS).forEach(([key, info]) => {
      const specialRepeated = Array.from({ length: info.count }, (_, i) => i + 1)
        .map(n => ({ num: n, count: activeStickers[`${key}-${n}`] || 0 }))
        .filter(s => s.count > 1);
      if (specialRepeated.length > 0) {
        repeated.push({ id: key, name: info.name, stickers: specialRepeated });
      }
    });

    return repeated;
  }, [activeStickers]);

  const multiRepeatedStickers = useMemo(() => {
    const multi: { id: string; name: string; stickers: { num: number; count: number }[] }[] = [];
    
    TEAMS.forEach(team => {
      const teamMulti = Array.from({ length: 20 }, (_, i) => i + 1)
        .map(n => ({ num: n, count: activeStickers[`${team.id}-${n}`] || 0 }))
        .filter(s => s.count > 2);
      if (teamMulti.length > 0) {
        multi.push({ id: team.id, name: team.name, stickers: teamMulti });
      }
    });

    Object.entries(SPECIALS).forEach(([key, info]) => {
      const specialMulti = Array.from({ length: info.count }, (_, i) => i + 1)
        .map(n => ({ num: n, count: activeStickers[`${key}-${n}`] || 0 }))
        .filter(s => s.count > 2);
      if (specialMulti.length > 0) {
        multi.push({ id: key, name: info.name, stickers: specialMulti });
      }
    });

    return multi;
  }, [activeStickers]);

  const comparisonDeal = useMemo(() => {
    if (!compareData) return null;
    
    const meSirven: string[] = [];
    const leSirven: string[] = [];

    // Check Teams
    TEAMS.forEach(team => {
      for (let i = 1; i <= 20; i++) {
        const sId = `${team.id}-${i}`;
        const myCount = stickers[sId] || 0;
        const theirCount = compareData.stickers[sId] || 0;

        if (myCount === 0 && theirCount > 1) meSirven.push(sId);
        if (theirCount === 0 && myCount > 1) leSirven.push(sId);
      }
    });

    // Check Specials
    Object.entries(SPECIALS).forEach(([key, info]) => {
      for (let i = 1; i <= info.count; i++) {
        const sId = `${key}-${i}`;
        const myCount = stickers[sId] || 0;
        const theirCount = compareData.stickers[sId] || 0;

        if (myCount === 0 && theirCount > 1) meSirven.push(sId);
        if (theirCount === 0 && myCount > 1) leSirven.push(sId);
      }
    });

    return { meSirven, leSirven };
  }, [stickers, compareData]);

  useEffect(() => {
    if (compareId && user && compareId !== user.uid && (!compareData || compareData.userId !== compareId)) {
      const fetchCompare = async () => {
        const albumRef = doc(db, 'albums', compareId);
        const userRef = doc(db, 'users', compareId);
        try {
          const [albumSnap, userSnap] = await Promise.all([getDoc(albumRef), getDoc(userRef)]);
          
          if (albumSnap.exists() && userSnap.exists()) {
            setCompareData({
              userId: compareId,
              name: userSnap.data().displayName || 'Amigo',
              stickers: albumSnap.data().stickers || {}
            });
            setIsComparing(true);
            setActiveTab('summary'); // Switch to summary to show trade info
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `comparison/${compareId}`);
        }
      };
      fetchCompare();
    }
  }, [compareId, user]);

  const filteredTeams = useMemo(() => {
    let result = [...TEAMS];
    if (searchQuery) {
      result = result.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (selectedGroup && viewMode === 'groups') {
      result = result.filter(t => t.group === selectedGroup);
    }
    if (viewMode === 'alphabetical') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }
    return result;
  }, [searchQuery, viewMode, selectedGroup]);

  const stats = useMemo(() => {
    const totalTeamsStickers = TEAMS.length * 20;
    const totalSpecials = Object.values(SPECIALS).reduce((acc, curr) => acc + curr.count, 0);
    const totalTotal = totalTeamsStickers + totalSpecials;
    
    let owned = 0;
    let repeated = 0;
    let multiRepeated = 0;
    Object.values(activeStickers).forEach(count => {
      if (count > 0) owned++;
      if (count > 1) {
        repeated += (count - 1);
        if (count > 2) multiRepeated += (count - 2);
      }
    });

    return { totalTotal, owned, repeated, multiRepeated, missing: totalTotal - owned, percent: Math.round((owned / totalTotal) * 100) };
  }, [activeStickers]);

  const editNickname = (fId: string, current: string) => {
    const name = prompt('Asignar apodo para este álbum:', current);
    if (name !== null) saveFriend(fId, name);
  };

  const lookupByShortId = async (inputId?: string) => {
    const idToSearch = (inputId || compareInput).toUpperCase();
    if (!idToSearch || idToSearch.length < 4) return;
    setIsSearchingId(true);
    try {
      const q = query(
        collection(db, 'albums'), 
        where('shortId', '==', idToSearch),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        alert('No se encontró ningún álbum con ese ID');
        return;
      }

      const albumDoc = querySnapshot.docs[0];
      const albumData = albumDoc.data();
      const targetUid = albumDoc.id;

      if (targetUid === user?.uid) {
        alert('Este es tu propio álbum');
        return;
      }

      const userRef = doc(db, 'users', targetUid);
      const userSnap = await getDoc(userRef);
      const friendName = userSnap.exists() ? (userSnap.data().displayName || 'Amigo') : 'Amigo';

      setCompareData({
        userId: targetUid,
        name: friends[idToSearch]?.nickname || friendName,
        stickers: albumData.stickers || {},
        shortId: idToSearch
      });
      setIsComparing(true);
      setShowSearchPanel(false);
      
      // Auto-save to recent friends
      if (!friends[idToSearch]) {
        saveFriend(idToSearch, friendName);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'search_by_id');
    } finally {
      setIsSearchingId(false);
    }
  };

  const sendInAppProposal = async () => {
    if (!user || !compareData || (!tradeProposal.give.length && !tradeProposal.get.length)) return;
    
    try {
      const proposalRef = doc(collection(db, 'proposals'));
      await setDoc(proposalRef, {
        fromId: shortId,
        fromUid: user.uid,
        toId: compareData.shortId,
        toUid: compareData.userId,
        give: tradeProposal.give,
        get: tradeProposal.get,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      alert('Propuesta enviada con éxito. Tu amigo la verá en su aplicación.');
      setTradeProposal({ give: [], get: [] });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'send_proposal');
    }
  };

  const updateProposalStatus = async (proposalId: string, status: 'accepted' | 'rejected' | 'cancelled' | 'completed') => {
    const proposalRef = doc(db, 'proposals', proposalId);
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal || !user) return;

    try {
      // If accepting (recipient) or completing (sender), we update the album
      const isAccepting = status === 'accepted' && proposal.toUid === user.uid;
      const isCompleting = status === 'completed' && proposal.fromUid === user.uid;

      if (isAccepting || isCompleting) {
        const newStickers = { ...stickers };
        // If I am recipient and I accept: 
        //    I GIVE (remove): proposal.get
        //    I GET (add): proposal.give
        // If I am sender and I complete:
        //    I GIVE (remove): proposal.give
        //    I GET (add): proposal.get

        const toGive = isAccepting ? proposal.get : proposal.give;
        const toReceive = isAccepting ? proposal.give : proposal.get;

        toGive.forEach(id => {
          const current = newStickers[id] || 0;
          if (current > 0) {
            newStickers[id] = current - 1;
          }
        });

        toReceive.forEach(id => {
          newStickers[id] = (newStickers[id] || 0) + 1;
        });

        const albumRef = doc(db, 'albums', user.uid);
        await updateDoc(albumRef, {
          stickers: newStickers,
          updatedAt: serverTimestamp()
        });
      }

      // Update proposal status in DB LAST
      // Note: If status is 'completed' or 'rejected' or 'cancelled', it will disappear from listeners
      await updateDoc(proposalRef, { status });
      
      console.log(`Propuesta ${proposalId} actualizada a ${status}`);
    } catch (err) {
      console.error('Error updating proposal:', err);
      alert('Error al actualizar la propuesta. Por favor intenta de nuevo.');
    }
  };

  const shareAlbum = () => {
    if (!user || !shortId) return;
    const text = `¡Mira mi álbum del mundial! Compara tus fichas conmigo usando mi ID: ${shortId}`;
    navigator.clipboard.writeText(text);
    alert('¡ID de tu álbum copiado! Pásaselo a tus amigos.');
  };

  const toggleTradeSticker = (id: string, type: 'give' | 'get') => {
    setTradeProposal(prev => {
      const list = prev[type];
      const newList = list.includes(id) ? list.filter(x => x !== id) : [...list, id];
      return { ...prev, [type]: newList };
    });
  };

  const shareTradeRequest = () => {
    if (!tradeProposal.give.length && !tradeProposal.get.length) return;
    
    let text = `🤝 PROPUESTA DE INTERCAMBIO\n\n`;
    text += `De mi álbum (${shortId}):\n`;
    text += tradeProposal.give.length > 0 ? tradeProposal.give.join(', ') : 'Ninguna seleccionada';
    text += `\n\nDel álbum de ${compareData?.name}:\n`;
    text += tradeProposal.get.length > 0 ? tradeProposal.get.join(', ') : 'Ninguna seleccionada';
    text += `\n\n¿Te parece bien el cambio?`;

    navigator.clipboard.writeText(text);
    alert('¡Propuesta copiada! Envíala por WhatsApp o chat a tu amigo.');
  };

  const [expandedSummaryGroups, setExpandedSummaryGroups] = useState<Record<string, boolean>>({});
  const [expandedGroupIds, setExpandedGroupIds] = useState<Record<string, boolean>>({});
  const [quickView, setQuickView] = useState<'escudos' | 'equipos' | null>(null);

  const toggleSummaryGroup = (id: string) => {
    setExpandedSummaryGroups(prev => ({ [id]: !prev[id] }));
  };

  const toggleGroup = (id: string) => {
    setExpandedGroupIds(prev => ({ [id]: !prev[id] }));
  };

  const copyMissingList = () => {
    let text = "MI ALBUM - FALTANTES:\n\n";
    missingStickers.forEach(team => {
      text += `${team.id}: ${team.stickers.sort((a,b)=>a-b).join(', ')}\n`;
    });
    navigator.clipboard.writeText(text);
    alert('Lista de faltantes copiada al portapapeles');
  };

  const copyRepeatedList = () => {
    let text = "MI ALBUM - REPETIDAS:\n\n";
    repeatedStickers.forEach(team => {
      text += `${team.id}: ${team.stickers.map(s => s.num).sort((a,b)=>a-b).join(', ')}\n`;
    });
    navigator.clipboard.writeText(text);
    alert('Lista de repetidas copiada al portapapeles');
  };

  const copyMultiRepeatedList = () => {
    let text = "MI ALBUM - MULTI-REPETIDAS (+2):\n\n";
    multiRepeatedStickers.forEach(team => {
      text += `${team.id}: ${team.stickers.map(s => s.num).sort((a,b)=>a-b).join(', ')}\n`;
    });
    navigator.clipboard.writeText(text);
    alert('Lista de multi-repetidas copiada al portapapeles');
  };

  if (authLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#050505] transition-colors duration-300">
      <Trophy className="w-12 h-12 text-blue-500 animate-bounce mb-4" />
      <span className="text-gray-500 dark:text-gray-400 font-medium animate-pulse">Cargando tu colección...</span>
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#050505] flex flex-col transition-colors duration-300">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-8"
          >
            <Trophy className="w-24 h-24 text-blue-600 mx-auto" />
            <div className="space-y-4">
              <h1 className="text-5xl font-black tracking-tighter text-gray-900 dark:text-white uppercase leading-tight">
                Tu Álbum Digital <br/> del <span className="text-blue-600">Mundial</span>
              </h1>
              <p className="text-lg text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Gestiona tus fichas, evita repetidas e intercambia con amigos en tiempo real.
              </p>
            </div>
            <button
               onClick={() => signInWithGoogle()}
               className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white bg-blue-600 rounded-2xl hover:bg-blue-700 active:scale-95 shadow-xl shadow-blue-500/20"
            >
              <Users className="w-6 h-6 mr-3" />
              Empieza Mi Colección
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-white transition-colors duration-300">
      <Navbar />
      
      <main className="max-w-5xl mx-auto px-4 pt-8">
        {/* Friend Album View Banner */}
        <AnimatePresence>
          {isViewingFriendAlbum && compareData && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-8"
            >
              <div className="bg-amber-500 text-white px-6 py-4 rounded-[28px] shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl">
                    👀
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Modo Observador</p>
                    <h3 className="text-xl font-black uppercase tracking-tighter">Álbum de {compareData.name}</h3>
                  </div>
                </div>
                <button 
                  onClick={() => setIsViewingFriendAlbum(false)}
                  className="bg-white text-amber-600 px-6 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-gray-100 transition-all flex items-center gap-2"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  Volver a Mi Álbum
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dashboard Progress */}
        <div className="bg-white dark:bg-gray-900 rounded-[32px] p-6 mb-8 border border-gray-100 dark:border-white/5 shadow-2xl">
           <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="relative w-32 h-32 flex-shrink-0">
                 <svg className="w-full h-full -rotate-90">
                    <circle cx="64" cy="64" r="58" className="stroke-gray-100 dark:stroke-white/5 fill-none" strokeWidth="10" />
                    <motion.circle 
                      cx="64" cy="64" r="58" 
                      className="stroke-blue-600 fill-none" 
                      strokeWidth="10" 
                      strokeDasharray="364"
                      initial={{ strokeDashoffset: 364 }}
                      animate={{ strokeDashoffset: 364 - (364 * stats.percent) / 100 }}
                      strokeLinecap="round"
                    />
                 </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-gray-900 dark:text-white">{stats.percent}%</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Proporción</span>
                 </div>
              </div>

              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4 w-full">
                 <button onClick={() => setActiveTab('album')} className="text-left hover:opacity-70 transition-opacity">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Obtenidas</span>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.owned} <span className="text-sm font-medium text-gray-500">/ {stats.totalTotal}</span></p>
                 </button>
                 <button onClick={() => setActiveTab('summary')} className="text-left hover:opacity-70 transition-opacity">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Faltan</span>
                    <p className="text-2xl font-black text-red-500">{stats.missing}</p>
                 </button>
                 <button onClick={() => setActiveTab('summary')} className="sm:col-span-1 col-span-2 text-left hover:opacity-70 transition-opacity">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Repetidas</span>
                    <p className="text-2xl font-black text-amber-500">{stats.repeated}</p>
                 </button>
              </div>

              <div className="flex flex-col gap-2 w-full md:w-auto">
                 <div className="bg-gray-100 dark:bg-white/5 p-4 rounded-2xl flex flex-col items-center gap-1 min-w-[140px] shadow-inner">
                   <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-1">Mi ID de Álbum</span>
                   <div className="flex items-center gap-2">
                     <span className="text-xl font-black text-blue-600 dark:text-blue-400 tracking-widest">{shortId || '...'}</span>
                     <button title="Copiar ID" onClick={shareAlbum} className="p-1 hover:text-blue-400 transition-colors text-gray-400 dark:text-white/50 hover:text-blue-600 dark:hover:text-white">
                       <Copy className="w-3.5 h-3.5" />
                     </button>
                   </div>
                 </div>
                 <div className="flex gap-2">
                    <button 
                      onClick={() => setShowSearchPanel(!showSearchPanel)} 
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 font-black py-2.5 px-4 rounded-2xl transition-all border-2 text-[10px] uppercase tracking-widest",
                        showSearchPanel ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20" : "border-blue-600/30 text-blue-600 hover:bg-blue-600 hover:text-white"
                      )}
                    >
                      <Users className="w-3.5 h-3.5" /> Amigos {Object.keys(friends).length > 0 && `(${Object.keys(friends).length})`}
                    </button>
                    {proposals.length > 0 && (
                      <button 
                        onClick={() => setActiveTab('proposals')}
                        className="bg-red-500 text-white w-10 rounded-2xl flex items-center justify-center relative shadow-lg shadow-red-500/20 animate-pulse"
                      >
                         <div className="absolute -top-1 -right-1 bg-white text-red-500 text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-black border border-red-500">{proposals.length}</div>
                         <ArrowLeftRight className="w-4 h-4" />
                      </button>
                    )}
                    {compareData && (
                      <button 
                        onClick={() => setIsComparing(!isComparing)} 
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 font-black py-2.5 px-4 rounded-2xl transition-all border-2 text-[10px] uppercase tracking-widest", 
                          isComparing ? "bg-green-500 border-green-500 text-white shadow-lg shadow-green-500/20" : "border-green-500/30 text-green-500 hover:bg-green-500 hover:text-white"
                        )}
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" /> {isComparing ? "Comparando" : "Comparar"}
                      </button>
                    )}
                 </div>
              </div>
           </div>
        </div>

        {/* Global Comparison Search - Now toggleable */}
        <AnimatePresence>
          {showSearchPanel && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-8"
            >
              <div className="bg-blue-600/10 dark:bg-blue-600/20 border border-blue-600/20 p-6 rounded-[32px] space-y-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="flex-shrink-0">
                     <h3 className="font-black uppercase text-sm tracking-widest text-blue-600 dark:text-blue-400 mb-1">Comparar con Amigo</h3>
                     <p className="text-[10px] text-blue-500/60 dark:text-blue-400/60 font-bold uppercase tracking-widest">Ingresa su ID de 8 caracteres</p>
                  </div>
                    <div className="flex-1 flex flex-col sm:flex-row gap-2 w-full">
                      <input 
                        type="text" 
                        placeholder="EJ: ABCD1234"
                        value={compareInput}
                        onChange={(e) => setCompareInput(e.target.value.toUpperCase())}
                        className="flex-1 bg-white/10 dark:bg-white/5 border border-transparent focus:border-blue-500 rounded-2xl px-4 py-3 outline-none font-black tracking-widest uppercase text-lg shadow-sm text-gray-900 dark:text-white"
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={() => lookupByShortId()}
                          disabled={isSearchingId || !compareInput}
                          className="flex-1 sm:flex-none bg-blue-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 shadow-lg shadow-blue-500/20"
                        >
                          {isSearchingId ? '...' : 'Comparar'}
                          <ArrowLeftRight className="w-4 h-4" />
                        </button>
                        {compareData && (
                          <button 
                            onClick={() => {
                              setIsViewingFriendAlbum(true);
                              setIsComparing(false);
                            }}
                            className="flex-1 sm:flex-none bg-amber-500 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-amber-600 transition-all flex items-center justify-center gap-2 border-b-4 border-amber-700 active:border-b-0 active:translate-y-1 shadow-lg shadow-amber-500/20"
                          >
                            Ver Álbum <Trophy className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                </div>

                {Object.keys(friends).length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Amigos Recientes</h4>
                        <div className="flex flex-wrap gap-2">
                           {Object.entries(friends).sort((a,b) => b[1].lastInteraction - a[1].lastInteraction).map(([fId, info]) => (
                             <div key={fId} className="flex flex-col bg-white/5 border border-white/5 rounded-2xl overflow-hidden transition-all hover:border-blue-600/30 group">
                               <div className="flex items-center">
                                 <button 
                                   onClick={() => lookupByShortId(fId)}
                                   className="flex items-center gap-2 py-2 px-3 text-left flex-1"
                                 >
                                   <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center text-[10px] font-black text-blue-600">{fId.substring(0,2)}</div>
                                   <div>
                                     <p className="text-[10px] font-black uppercase tracking-tighter leading-none mb-0.5">{info.nickname}</p>
                                     <p className="text-[8px] font-bold text-gray-400 tracking-widest leading-none">{fId}</p>
                                   </div>
                                 </button>
                                 <button 
                                   onClick={() => editNickname(fId, info.nickname)}
                                   className="p-3 text-gray-300 hover:text-blue-600 transition-colors"
                                   title="Editar apodo"
                                 >
                                   <Pencil className="w-3.5 h-3.5" /> 
                                 </button>
                               </div>
                               <button 
                                 onClick={async () => {
                                   const fDoc = await getDoc(doc(db, 'albums', fId));
                                   if (fDoc.exists()) {
                                     setCompareData({
                                       userId: fId,
                                       name: info.nickname || 'Amigo',
                                       stickers: fDoc.data().stickers || {},
                                       shortId: fId
                                     });
                                     setIsViewingFriendAlbum(true);
                                     setIsComparing(false);
                                     setShowSearchPanel(false);
                                   }
                                 }}
                                 className="bg-amber-500/10 text-amber-600 py-1.5 text-[8px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all"
                               >
                                 Ver Álbum Completo
                               </button>
                             </div>
                           ))}
                        </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="flex flex-col gap-4 mb-8">
           <div className="flex flex-nowrap items-center justify-between gap-4 overflow-x-auto scrollbar-hide pb-1 sm:pb-0">
              <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-2xl w-full sm:w-auto shrink-0">
                 {(['album', 'specials', 'summary', 'proposals'] as const).map((tab) => (
                   <button
                     key={tab}
                     onClick={() => setActiveTab(tab)}
                     className={cn(
                       "flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase transition-all tracking-wider relative shrink-0", 
                       activeTab === tab ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                     )}
                   >
                     {tab === 'album' ? 'Equipos' : tab === 'specials' ? 'Especiales' : tab === 'summary' ? 'Resumen' : 'Cambios'}
                     {tab === 'proposals' && proposals.length > 0 && (
                       <span className="absolute -top-1 -right-1 flex h-4 w-4 rounded-full bg-red-500 text-white text-[8px] items-center justify-center border-2 border-white dark:border-gray-800">{proposals.length}</span>
                     )}
                   </button>
                 ))}
              </div>
           </div>

           <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre o abreviado (ej: MEX)..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="w-full pl-11 pr-4 py-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 focus:border-blue-500/50 rounded-2xl outline-none transition-all text-sm text-gray-900 dark:text-white placeholder:text-gray-400 shadow-sm" 
                />
              </div>
              <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-2xl shadow-inner w-full sm:w-auto shrink-0">
                 <button 
                   onClick={() => setViewMode('groups')}
                   className={cn(
                     "flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5",
                     viewMode === 'groups' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                   )}
                   title="Vista por Grupos"
                 >
                   <LayoutGrid className="w-3.5 h-3.5" />
                   <span>Grupos</span>
                 </button>
                 <button 
                   onClick={() => setViewMode('alphabetical')}
                   className={cn(
                     "flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5",
                     viewMode === 'alphabetical' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                   )}
                   title="Vista Alfabética"
                 >
                   <List className="w-3.5 h-3.5" />
                   <span>A-Z</span>
                 </button>
              </div>
           </div>

           {activeTab === 'album' && viewMode === 'groups' && !searchQuery && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar"
              >
                  <button 
                    onClick={() => setSelectedGroup(null)}
                    className={cn(
                      "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                      selectedGroup === null ? "bg-blue-600 text-white" : "bg-white dark:bg-white/5 text-gray-500 hover:bg-gray-100"
                    )}
                  >
                    Todos
                  </button>
                  {groups.map(g => (
                    <button 
                      key={g.id}
                      onClick={() => setSelectedGroup(g.id)}
                      className={cn(
                        "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2",
                        selectedGroup === g.id ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-white dark:bg-white/5 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
                      )}
                    >
                      <span>Grupo {g.id}</span>
                      <span className={cn(
                        "px-1.5 py-0.5 rounded-md text-[8px]",
                        selectedGroup === g.id ? "bg-white/20 text-white" : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      )}>
                        {g.percent}%
                      </span>
                    </button>
                  ))}
              </motion.div>
           )}
        </div>

        {/* Grid Content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="wait">
            {activeTab === 'album' ? (
              <motion.div
                key="album-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="col-span-full space-y-8"
              >
                {viewMode === 'groups' && !selectedGroup && !searchQuery ? (
                  groups.map(group => (
                    <div key={group.id} className="space-y-4">
                       <button 
                        onClick={() => toggleGroup(group.id)}
                        className="w-full text-left flex items-center justify-between bg-white dark:bg-gray-900 px-6 py-10 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-xl hover:border-blue-500/30 transition-all group overflow-hidden relative"
                      >
                        {/* Background Flags Grid */}
                        <div className="absolute inset-0 flex opacity-[0.1] dark:opacity-20 pointer-events-none">
                          {group.teams.map(t => (
                            <div key={t.id} className="flex-1 h-full relative overflow-hidden">
                              <img 
                                src={getFlagUrl(t.id)} 
                                alt="" 
                                className="w-full h-full object-cover object-center scale-110" 
                                referrerPolicy="no-referrer" 
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-gray-900 via-transparent to-transparent opacity-40" />
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 relative z-10 w-full">
                          {/* Title & Progress Row for mobile */}
                          <div className="flex items-center justify-between sm:contents">
                            <div className="flex-1 sm:order-2">
                              <h3 className="text-lg sm:text-xl font-black uppercase tracking-tighter text-gray-900 dark:text-white leading-tight">Grupo {group.id}</h3>
                              <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{group.owned} / {group.total} fichas</p>
                            </div>
                            
                            <div className="flex items-center gap-3 sm:hidden bg-gray-100 dark:bg-black/60 p-2 rounded-2xl backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-lg">
                               <div className="text-right">
                                  <p className="text-sm font-black text-blue-600 dark:text-blue-400">{group.percent}%</p>
                                  <div className="h-1 w-12 bg-gray-200 dark:bg-white/10 rounded-full mt-1 overflow-hidden">
                                    <motion.div initial={{width:0}} animate={{width:`${group.percent}%`}} className="h-full bg-blue-600" />
                                  </div>
                               </div>
                               <ChevronRight className={cn("w-4 h-4 text-gray-400 transition-transform", expandedGroupIds[group.id] && "rotate-90")} />
                            </div>
                          </div>

                          {/* Flags Block */}
                          <div className="flex -space-x-3 sm:order-1 self-start sm:self-center bg-white/60 dark:bg-black/60 p-2 rounded-2xl backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-lg">
                            {group.teams.map(t => (
                              <img key={t.id} src={getFlagUrl(t.id)} alt={t.name} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white dark:border-gray-900 object-cover shadow-sm" referrerPolicy="no-referrer" />
                            ))}
                          </div>
                          
                          {/* Desktop Progress Block */}
                          <div className="hidden sm:flex items-center gap-4 sm:order-3 bg-white/60 dark:bg-black/60 p-3 rounded-2xl backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-lg ml-auto">
                            <div className="text-right">
                               <p className="text-base font-black text-blue-600 dark:text-blue-400">{group.percent}%</p>
                               <div className="h-1.5 w-20 bg-gray-200 dark:bg-white/10 rounded-full mt-1 overflow-hidden">
                                 <motion.div initial={{width:0}} animate={{width:`${group.percent}%`}} className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.2)]" />
                               </div>
                            </div>
                            <ChevronRight className={cn("w-6 h-6 text-gray-400 transition-transform", expandedGroupIds[group.id] && "rotate-90")} />
                          </div>
                        </div>
                      </button>

                      <AnimatePresence>
                        {expandedGroupIds[group.id] && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
                              {group.teams.map(team => {
                                const owned = Array.from({length:20}, (_,i)=>i+1).filter(n => (activeStickers[`${team.id}-${n}`]||0)>0).length;
                                return <TeamCard key={team.id} team={team} ownedCount={owned} onClick={()=>setSelectedTeam(team.id)} isComparing={isComparing} compareData={compareData} myStickers={stickers} isViewingFriendAlbum={isViewingFriendAlbum} />;
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTeams.map(team => {
                      const owned = Array.from({length:20}, (_,i)=>i+1).filter(n => (activeStickers[`${team.id}-${n}`]||0)>0).length;
                      return <TeamCard key={team.id} team={team} ownedCount={owned} onClick={()=>setSelectedTeam(team.id)} isComparing={isComparing} compareData={compareData} myStickers={stickers} isViewingFriendAlbum={isViewingFriendAlbum} />;
                    })}
                  </div>
                )}
              </motion.div>
            ) : activeTab === 'specials' ? (
              <motion.div
                key="specials-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="col-span-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {Object.entries(SPECIALS).map(([key, info]) => {
                  const owned = Object.keys(activeStickers).filter(id => id.startsWith(key)).filter(id => activeStickers[id]>0).length;
                  return <button key={key} onClick={()=>setSelectedTeam(key)} className="bg-white dark:bg-gray-900 p-6 rounded-[28px] border border-gray-100 dark:border-white/5 shadow-lg text-left hover:border-blue-500 transition-all group">
                     <div className="flex items-center justify-between mb-4">
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner", 
                          key === '00' ? 'bg-amber-500 text-white shadow-amber-500/20' : 
                          key === 'CC' ? 'bg-red-500 text-white' : 
                          'bg-blue-600 text-white'
                        )}>
                          {key}
                        </div>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{owned}<span className="text-sm font-medium text-gray-400">/{info.count}</span></p>
                     </div>
                     <p className="font-black text-lg text-gray-900 dark:text-white mb-4 uppercase">{info.name}</p>
                     <div className="h-2 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <motion.div initial={{width:0}} animate={{width:`${(owned/info.count)*100}%`}} className={cn("h-full", key==='CC'?'bg-red-500':'bg-blue-600')} />
                     </div>
                     {isComparing && compareData && <ComparisonBadge teamId={key} myStickers={stickers} theirStickers={compareData.stickers} count={info.count} />}
                  </button>;
                })}
              </motion.div>
            ) : activeTab === 'proposals' ? (
               <motion.div 
                key="proposals-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="col-span-full space-y-6"
               >
                  <h3 className="text-2xl font-black uppercase tracking-tighter text-gray-900 dark:text-white">Propuestas Recibidas</h3>
                  {proposals.length === 0 ? (
                    <div className="bg-white dark:bg-gray-900 p-12 rounded-[40px] text-center border border-dashed border-gray-200 dark:border-white/10">
                       <ArrowLeftRight className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                       <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">No tienes propuestas pendientes</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       {proposals.map(proposal => (
                         <div key={proposal.id} className="bg-white dark:bg-gray-900 p-6 rounded-[32px] border border-gray-100 dark:border-white/5 shadow-xl space-y-6">
                            <div className="flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-xs">{proposal.fromId.substring(0,2)}</div>
                                  <div>
                                     <div className="flex items-center gap-2">
                                        <p className="font-black uppercase tracking-tight text-gray-900 dark:text-white">
                                          {friends[proposal.fromId]?.nickname || proposal.fromId}
                                        </p>
                                        <button 
                                          onClick={() => editNickname(proposal.fromId, friends[proposal.fromId]?.nickname || proposal.fromId)}
                                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                          title="Asignar Apodo"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                     </div>
                                     <p className="text-[10px] font-bold text-gray-400 uppercase">ID: {proposal.fromId}</p>
                                  </div>
                               </div>
                               <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-2 py-1 rounded-full">PENDIENTE</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-black/20 p-4 rounded-2xl">
                               <div className="space-y-2">
                                  <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Me entrega ({proposal.give.length})</p>
                                  <div className="flex flex-wrap gap-1">
                                     {proposal.give.slice(0, 10).map(id => (
                                       <span key={id} className="text-[9px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded shadow-sm border border-amber-400/50">
                                         {id}
                                       </span>
                                     ))}
                                     {proposal.give.length > 10 && <span className="text-[8px] font-black text-gray-400">+{proposal.give.length - 10}</span>}
                                  </div>
                               </div>
                               <div className="space-y-2">
                                  <p className="text-[9px] font-black text-green-500 uppercase tracking-widest">Le entrego ({proposal.get.length})</p>
                                  <div className="flex flex-wrap gap-1">
                                     {proposal.get.slice(0, 10).map(id => (
                                       <span key={id} className="text-[9px] font-bold bg-green-500 text-white px-2 py-0.5 rounded shadow-sm border border-green-400/50">
                                         {id}
                                       </span>
                                     ))}
                                     {proposal.get.length > 10 && <span className="text-[8px] font-black text-gray-400">+{proposal.get.length - 10}</span>}
                                  </div>
                               </div>
                            </div>

                            <div className="flex gap-2">
                               {proposal.toUid === user?.uid && proposal.status === 'pending' && (
                                  <>
                                     <button 
                                       onClick={() => updateProposalStatus(proposal.id, 'accepted')}
                                       className="flex-1 bg-green-500 text-white py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-600 shadow-lg shadow-green-500/20 transition-all"
                                     >
                                       Aceptar e Intercambiar
                                     </button>
                                     <button 
                                       onClick={() => updateProposalStatus(proposal.id, 'rejected')}
                                       className="flex-1 bg-gray-100 dark:bg-white/5 text-gray-500 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-500/10 hover:text-red-500 transition-all"
                                     >
                                       Rechazar
                                     </button>
                                  </>
                               )}
                               {proposal.fromUid === user?.uid && proposal.status === 'pending' && (
                                  <button 
                                    onClick={() => updateProposalStatus(proposal.id, 'cancelled')}
                                    className="flex-1 bg-gray-100 dark:bg-white/5 text-gray-500 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:text-red-500 transition-all"
                                  >
                                    Cancelar Mi Propuesta
                                  </button>
                               )}
                               {proposal.fromUid === user?.uid && proposal.status === 'accepted' && (
                                  <button 
                                    onClick={() => updateProposalStatus(proposal.id, 'completed')}
                                    className="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all"
                                  >
                                    Aplicar a mi Álbum
                                  </button>
                               )}
                               {proposal.toUid === user?.uid && proposal.status === 'accepted' && (
                                  <div className="flex-1 text-center py-3 text-green-500 text-[10px] font-black uppercase bg-green-50 dark:bg-green-500/10 rounded-2xl">
                                     Esperando a que {friends[proposal.fromId]?.nickname || proposal.fromId} confirme
                                  </div>
                               )}
                            </div>
                         </div>
                       ))}
                    </div>
                  )}
               </motion.div>
            ) : (
               <motion.div 
                key="summary-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="col-span-full space-y-8"
               >

                  {/* Comparison Summary */}
                  {isComparing && comparisonDeal && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="bg-green-500/10 dark:bg-green-500/20 border border-green-500/20 dark:border-green-500/30 p-6 rounded-[32px] space-y-4">
                            <div className="flex items-center gap-3">
                               <div className="p-2 bg-green-500 rounded-xl"><ArrowLeftRight className="text-white w-5 h-5"/></div>
                               <div>
                                 <h4 className="font-black uppercase tracking-tight text-green-700 dark:text-green-400">Me sirven de {compareData?.name}</h4>
                                 <p className="text-[9px] font-bold text-green-600/60 dark:text-green-400/60 uppercase">Toca para pedir en cambio</p>
                               </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                               {comparisonDeal.meSirven.length > 0 ? comparisonDeal.meSirven.map(id => (
                                 <button 
                                   key={id} 
                                   onClick={() => toggleTradeSticker(id, 'get')}
                                   className={cn(
                                     "text-[10px] font-black px-2 py-1 rounded-lg border transition-all",
                                     tradeProposal.get.includes(id) 
                                      ? "bg-green-500 text-white border-green-500 shadow-lg shadow-green-500/20" 
                                      : "bg-white dark:bg-gray-800 text-green-600 dark:text-green-400 border-green-500/30 hover:bg-green-500/10"
                                   )}
                                 >
                                   {id}
                                 </button>
                               )) : <p className="text-xs text-green-600/50">No hay intercambios directos que me sirvan.</p>}
                            </div>
                         </div>
                         <div className="bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 dark:border-amber-500/30 p-6 rounded-[32px] space-y-4">
                            <div className="flex items-center gap-3">
                               <div className="p-2 bg-amber-500 rounded-xl"><ArrowLeftRight className="text-white w-5 h-5"/></div>
                               <div>
                                 <h4 className="font-black uppercase tracking-tight text-amber-700 dark:text-amber-400">Le sirven a {compareData?.name}</h4>
                                 <p className="text-[9px] font-bold text-amber-600/60 dark:text-amber-400/60 uppercase">Toca para ofrecer en cambio</p>
                               </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                               {comparisonDeal.leSirven.length > 0 ? comparisonDeal.leSirven.map(id => (
                                 <button 
                                   key={id} 
                                   onClick={() => toggleTradeSticker(id, 'give')}
                                   className={cn(
                                     "text-[10px] font-black px-2 py-1 rounded-lg border transition-all",
                                     tradeProposal.give.includes(id) 
                                      ? "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20" 
                                      : "bg-white dark:bg-gray-800 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                                   )}
                                 >
                                   {id}
                                 </button>
                               )) : <p className="text-xs text-amber-600/50">Tu amigo ya tiene todo lo que tú tienes repetido.</p>}
                            </div>
                         </div>
                      </div>

                      {/* Trade Proposal Summary Bar */}
                      {(tradeProposal.give.length > 0 || tradeProposal.get.length > 0) && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white dark:bg-gray-900 p-6 rounded-[32px] border-2 border-blue-500 shadow-2xl flex flex-col md:flex-row items-center gap-6"
                        >
                          <div className="flex-1 flex items-center justify-center gap-6 text-sm">
                            <div className="flex flex-col items-center">
                              <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">Doy ({tradeProposal.give.length})</span>
                              <div className="flex -space-x-1">
                                {tradeProposal.give.slice(0, 5).map(id => (
                                  <div key={id} className="h-6 px-1.5 rounded-md bg-amber-500 border border-white dark:border-gray-800 flex items-center justify-center text-[8px] font-bold text-white shadow-sm">{id}</div>
                                ))}
                                {tradeProposal.give.length > 5 && <div className="h-6 px-1.5 rounded-md bg-amber-100 dark:bg-amber-900 text-[8px] font-black text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-white/10">+{tradeProposal.give.length - 5}</div>}
                              </div>
                            </div>
                            <ArrowLeftRight className="w-5 h-5 text-blue-500 animate-pulse shrink-0" />
                            <div className="flex flex-col items-center">
                              <span className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">Recibo ({tradeProposal.get.length})</span>
                              <div className="flex -space-x-1">
                                {tradeProposal.get.slice(0, 5).map(id => (
                                  <div key={id} className="h-6 px-1.5 rounded-md bg-green-500 border border-white dark:border-gray-800 flex items-center justify-center text-[8px] font-bold text-white shadow-sm">{id}</div>
                                ))}
                                {tradeProposal.get.length > 5 && <div className="h-6 px-1.5 rounded-md bg-green-100 dark:bg-green-900 text-[8px] font-black text-green-700 dark:text-green-400 border border-green-200 dark:border-white/10">+{tradeProposal.get.length - 5}</div>}
                              </div>
                            </div>
                          </div>
                             <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                              <button 
                                onClick={() => {
                                  setIsViewingFriendAlbum(true);
                                  setIsComparing(false); // Hide comparison bar when viewing full album
                                }}
                                className="flex-1 bg-amber-500 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-amber-600 shadow-xl shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                              >
                                Ver Álbum de {compareData.name} <Trophy className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={sendInAppProposal}
                                className="flex-1 bg-blue-600 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                              >
                               Enviar Propuesta <Users className="w-4 h-4" />
                             </button>
                             <button 
                               onClick={shareTradeRequest}
                               className="flex-1 bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 dark:hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                             >
                               Copiar para WhatsApp <Share2 className="w-4 h-4" />
                             </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}


                      <div className="flex flex-wrap gap-3 mb-8">
                        <button 
                          onClick={() => setQuickView(quickView === 'escudos' ? null : 'escudos')}
                          className={cn(
                            "flex-1 min-w-[140px] px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 border-2",
                            quickView === 'escudos'
                              ? "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20"
                              : "bg-white dark:bg-gray-900 border-gray-200 dark:border-white/5 text-gray-500 hover:border-amber-500/50 shadow-sm"
                          )}
                        >
                          <Trophy className="w-4 h-4" />
                          Escudos
                        </button>
                        <button 
                          onClick={() => setQuickView(quickView === 'equipos' ? null : 'equipos')}
                          className={cn(
                            "flex-1 min-w-[140px] px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 border-2",
                            quickView === 'equipos'
                              ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20"
                              : "bg-white dark:bg-gray-900 border-gray-200 dark:border-white/5 text-gray-500 hover:border-blue-500/50 shadow-sm"
                          )}
                        >
                          <Users className="w-4 h-4" />
                          Equipos
                        </button>
                      </div>

                      {quickView && (
                        <div className="mb-12 p-8 bg-gray-100/50 dark:bg-white/5 rounded-[40px] border border-gray-200 dark:border-white/5">
                          <h3 className="text-2xl font-black uppercase tracking-tighter mb-8 flex items-center gap-3">
                            <div className={cn("w-2 h-8 rounded-full", quickView === 'escudos' ? "bg-amber-500" : "bg-blue-600")} />
                            Vista Rápida: {quickView === 'escudos' ? 'Todos los Escudos' : 'Todos los Equipos'}
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                            {TEAMS.map(team => {
                              const num = quickView === 'escudos' ? 1 : 13;
                              const sId = `${team.id}-${num}`;
                              const count = stickers[sId] || 0;
                              const isSpecial = true;
                              const playerName = PLAYER_NAMES[team.id]?.[num];
                              
                              return (
                                <div key={sId} className="space-y-1">
                                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">{team.id}</div>
                                  <StickerButton 
                                    id={sId}
                                    label={String(num)}
                                    count={count}
                                    onClick={() => updateSticker(sId, 1)}
                                    onLongPress={() => updateSticker(sId, -1)}
                                    isSpecial={isSpecial}
                                    playerName={playerName}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     {/* Missing List */}
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                           <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                              <div className="w-1.5 h-6 bg-red-500 rounded-full" />
                              Faltantes ({stats.missing})
                           </h3>
                           <button 
                             onClick={copyMissingList}
                             className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-white/5 hover:bg-red-500/10 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-500 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest text-gray-500"
                           >
                             <Copy className="w-3 h-3" />
                             Copiar Texto
                           </button>
                        </div>
                        <div className="flex flex-wrap gap-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar content-start">
                           {missingStickers.map(item => {
                             const isExpanded = expandedSummaryGroups[`missing-${item.id}`];
                             return (
                               <div key={item.id} className={cn("transition-all duration-300", isExpanded ? "w-full" : "w-auto")}>
                                 <button 
                                   onClick={() => toggleSummaryGroup(`missing-${item.id}`)}
                                   className={cn(
                                     "px-4 h-10 rounded-full flex items-center gap-2 border transition-all font-black text-xs uppercase tracking-widest",
                                     isExpanded 
                                       ? "bg-red-500 border-red-500 text-white w-full" 
                                       : "bg-white dark:bg-gray-900 border-gray-200 dark:border-white/10 text-gray-400 hover:border-red-500/50 shadow-sm"
                                   )}
                                 >
                                   <span>{item.id}</span>
                                   {isExpanded && <span className="opacity-80 font-bold ml-1 flex-1 text-left line-clamp-1">{item.name}</span>}
                                   <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px]", isExpanded ? "bg-white/20" : "bg-gray-200 dark:bg-white/5")}>
                                     {item.stickers.length}
                                   </div>
                                 </button>
                                 <AnimatePresence>
                                   {isExpanded && (
                                     <motion.div 
                                       initial={{ height: 0, opacity: 0 }}
                                       animate={{ height: 'auto', opacity: 1 }}
                                       exit={{ height: 0, opacity: 0 }}
                                       className="overflow-hidden"
                                     >
                                       <div className="p-4 mt-2 bg-gray-50 dark:bg-white/5 rounded-3xl border border-gray-200 dark:border-white/5">
                                          <div className="flex flex-wrap gap-3">
                                            {item.stickers.map(num => {
                                              const playerName = PLAYER_NAMES[item.id]?.[num];
                                              return (
                                                <button 
                                                 key={num}
                                                 onClick={() => setSelectedTeam(item.id)}
                                                 className="relative h-14 min-w-[60px] px-2 flex flex-col items-center justify-center bg-white dark:bg-gray-900 rounded-2xl font-black text-gray-900 dark:text-white shadow-sm border border-gray-100 dark:border-white/5 hover:border-red-500/50 transition-all active:scale-95"
                                                >
                                                  <span className={cn(playerName ? "text-[11px]" : "text-sm")}>{num}</span>
                                                  {playerName && (
                                                    <span className="text-[8px] leading-tight uppercase font-bold text-center opacity-70 truncate w-full mt-0.5">
                                                      {playerName}
                                                    </span>
                                                  )}
                                                </button>
                                              );
                                            })}
                                          </div>
                                       </div>
                                     </motion.div>
                                   )}
                                 </AnimatePresence>
                               </div>
                             );
                           })}
                        </div>
                     </div>

                     {/* Repeated List */}
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                           <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                              <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                              Repetidas ({stats.repeated})
                           </h3>
                           <button 
                             onClick={copyRepeatedList}
                             className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-white/5 hover:bg-amber-500/10 dark:hover:bg-amber-500/20 hover:text-amber-600 dark:hover:text-amber-500 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest text-gray-500"
                           >
                             <Copy className="w-3 h-3" />
                             Copiar Texto
                           </button>
                        </div>
                        <div className="flex flex-wrap gap-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar content-start">
                           {repeatedStickers.length > 0 ? repeatedStickers.map(item => {
                             const isExpanded = expandedSummaryGroups[`repeated-${item.id}`];
                             return (
                               <div key={item.id} className={cn("transition-all duration-300", isExpanded ? "w-full" : "w-auto")}>
                                 <button 
                                   onClick={() => toggleSummaryGroup(`repeated-${item.id}`)}
                                   className={cn(
                                     "px-4 h-10 rounded-full flex items-center gap-2 border transition-all font-black text-xs uppercase tracking-widest",
                                     isExpanded 
                                       ? "bg-amber-500 border-amber-500 text-white w-full" 
                                       : "bg-white dark:bg-gray-900 border-gray-200 dark:border-white/10 text-gray-400 hover:border-amber-500/50 shadow-sm"
                                   )}
                                 >
                                   <span>{item.id}</span>
                                   {isExpanded && <span className="opacity-80 font-bold ml-1 flex-1 text-left line-clamp-1">{item.name}</span>}
                                   <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px]", isExpanded ? "bg-white/20" : "bg-gray-200 dark:bg-white/5")}>
                                     {item.stickers.length}
                                   </div>
                                 </button>
                                 <AnimatePresence>
                                   {isExpanded && (
                                     <motion.div 
                                       initial={{ height: 0, opacity: 0 }}
                                       animate={{ height: 'auto', opacity: 1 }}
                                       exit={{ height: 0, opacity: 0 }}
                                       className="overflow-hidden"
                                     >
                                       <div className="p-4 mt-2 bg-gray-50 dark:bg-white/5 rounded-3xl border border-gray-200 dark:border-white/5">
                                          <div className="flex flex-wrap gap-3">
                                            {item.stickers.map(s => {
                                              const playerName = PLAYER_NAMES[item.id]?.[s.num];
                                              return (
                                                <button 
                                                 key={s.num}
                                                 onClick={() => setSelectedTeam(item.id)}
                                                 className="relative h-14 min-w-[60px] px-2 flex flex-col items-center justify-center bg-white dark:bg-gray-900 text-amber-600 dark:text-amber-400 rounded-2xl font-black border border-gray-100 dark:border-white/5 shadow-sm hover:border-amber-500/50 transition-all active:scale-95"
                                                >
                                                  <span className={cn(playerName ? "text-[11px]" : "text-sm")}>{s.num}</span>
                                                  {playerName && (
                                                    <span className="text-[8px] leading-tight uppercase font-bold text-center opacity-70 truncate w-full mt-0.5">
                                                      {playerName}
                                                    </span>
                                                  )}
                                                  <span className="absolute -top-2 -right-1 bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black shadow-lg">x{s.count - 1}</span>
                                                </button>
                                              );
                                            })}
                                          </div>
                                       </div>
                                     </motion.div>
                                   )}
                                 </AnimatePresence>
                               </div>
                             );
                           }) : (
                             <div className="w-full text-center py-12 text-gray-400 italic text-sm">
                                No tienes repetidas aún. ¡Sigue coleccionando!
                             </div>
                           )}
                        </div>
                     </div>

                     {/* Multi-Repeated List (+2) */}
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                           <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                              <div className="w-1.5 h-6 bg-red-600 rounded-full" />
                              Multi-Repetidas ({stats.multiRepeated})
                           </h3>
                           <button 
                             onClick={copyMultiRepeatedList}
                             className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-white/5 hover:bg-red-600/10 dark:hover:bg-red-600/20 hover:text-red-600 dark:hover:text-red-500 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest text-gray-500"
                           >
                             <Copy className="w-3 h-3" />
                             Copiar Texto
                           </button>
                        </div>
                        <div className="flex flex-wrap gap-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar content-start">
                           {multiRepeatedStickers.length > 0 ? multiRepeatedStickers.map(item => {
                             const isExpanded = expandedSummaryGroups[`multi-${item.id}`];
                             return (
                               <div key={item.id} className={cn("transition-all duration-300", isExpanded ? "w-full" : "w-auto")}>
                                 <button 
                                   onClick={() => toggleSummaryGroup(`multi-${item.id}`)}
                                   className={cn(
                                     "px-4 h-10 rounded-full flex items-center gap-2 border transition-all font-black text-xs uppercase tracking-widest",
                                     isExpanded 
                                       ? "bg-red-600 border-red-600 text-white w-full" 
                                       : "bg-white dark:bg-gray-900 border-gray-200 dark:border-white/10 text-gray-400 hover:border-red-600/50 shadow-sm"
                                   )}
                                 >
                                   <span>{item.id}</span>
                                   {isExpanded && <span className="opacity-80 font-bold ml-1 flex-1 text-left line-clamp-1">{item.name}</span>}
                                   <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px]", isExpanded ? "bg-white/20" : "bg-gray-200 dark:bg-white/5")}>
                                     {item.stickers.length}
                                   </div>
                                 </button>
                                 <AnimatePresence>
                                   {isExpanded && (
                                     <motion.div 
                                       initial={{ height: 0, opacity: 0 }}
                                       animate={{ height: 'auto', opacity: 1 }}
                                       exit={{ height: 0, opacity: 0 }}
                                       className="overflow-hidden"
                                     >
                                       <div className="p-4 mt-2 bg-gray-50 dark:bg-white/5 rounded-3xl border border-gray-200 dark:border-white/5">
                                          <div className="flex flex-wrap gap-3">
                                            {item.stickers.map(s => {
                                              const playerName = PLAYER_NAMES[item.id]?.[s.num];
                                              return (
                                                <button 
                                                 key={s.num}
                                                 onClick={() => setSelectedTeam(item.id)}
                                                 className="relative h-14 min-w-[60px] px-2 flex flex-col items-center justify-center bg-white dark:bg-gray-900 text-red-600 dark:text-red-400 rounded-2xl font-black border border-gray-100 dark:border-white/5 shadow-sm hover:border-red-600/50 transition-all active:scale-95"
                                                >
                                                  <span className={cn(playerName ? "text-[11px]" : "text-sm")}>{s.num}</span>
                                                  {playerName && (
                                                    <span className="text-[8px] leading-tight uppercase font-bold text-center opacity-70 truncate w-full mt-0.5">
                                                      {playerName}
                                                    </span>
                                                  )}
                                                  <span className="absolute -top-2 -right-1 bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black shadow-lg">x{s.count - 1}</span>
                                                </button>
                                              );
                                            })}
                                          </div>
                                       </div>
                                     </motion.div>
                                   )}
                                 </AnimatePresence>
                               </div>
                             );
                           }) : (
                             <div className="w-full text-center py-12 text-gray-400 italic text-sm">
                                No tienes fichas repetidas más de una vez.
                             </div>
                           )}
                        </div>
                     </div>
                  </div>
               </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>{selectedTeam && <TeamDetail teamId={selectedTeam} onClose={()=>setSelectedTeam(null)} compareData={isComparing || isViewingFriendAlbum ? compareData : null} isFriendView={isViewingFriendAlbum} />}</AnimatePresence>
      
      {/* Mobile Nav */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 sm:hidden">
          <div className="flex bg-white/90 dark:bg-white/10 backdrop-blur-xl p-2 rounded-3xl border border-gray-200 dark:border-white/20 shadow-2xl items-center gap-2">
             <button onClick={()=>setActiveTab('album')} className={cn("p-4 rounded-2xl", activeTab === 'album' ? "bg-blue-600 text-white" : "text-gray-400")}><Trophy className="w-6 h-6" /></button>
             <button onClick={()=>setActiveTab('specials')} className={cn("p-4 rounded-2xl", activeTab === 'specials' ? "bg-blue-600 text-white" : "text-gray-400")}><LayoutGrid className="w-6 h-6" /></button>
             <button onClick={shareAlbum} className="p-4 rounded-2xl text-gray-400"><Share2 className="w-6 h-6" /></button>
          </div>
      </div>
    </div>
  );
}

function TeamCard({ team, ownedCount, onClick, isComparing, compareData, myStickers, isViewingFriendAlbum }: { 
  team: typeof TEAMS[0]; 
  ownedCount: number; 
  onClick: () => void; 
  isComparing: boolean; 
  compareData: { userId: string; name: string; stickers: Record<string, number>; shortId: string } | null; 
  myStickers: Record<string, number>;
  isViewingFriendAlbum: boolean;
}) {
  const progress = (ownedCount/20)*100;
  const colors = COUNTRY_COLORS[team.id] || { primary: '#2563eb', secondary: '#ffffff', text: '#ffffff' };
  
  return (
    <motion.button 
      whileHover={{ y: -4 }} 
      onClick={onClick} 
      className="bg-white dark:bg-gray-900 p-5 rounded-[28px] border border-gray-100 dark:border-white/5 text-left shadow-2xl hover:border-blue-500/30 transition-all relative overflow-hidden group"
    >
      {/* Flag Background Wash */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-25 pointer-events-none transition-transform group-hover:scale-110">
        <img src={getFlagUrl(team.id)} className="w-full h-full object-contain -translate-y-4 translate-x-4 rotate-12" alt="" referrerPolicy="no-referrer" />
      </div>

      <div className="flex items-center gap-4 mb-4 relative z-10">
        <div 
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-lg border-2 border-white dark:border-gray-800"
          style={{ backgroundColor: colors.primary }}
        >
          {team.flag}
        </div>
        <div>
          <h3 className="font-black text-lg text-gray-900 dark:text-white uppercase leading-none mb-1">
            {team.name} <span className="text-gray-500 font-bold ml-1 text-sm">({team.id})</span>
          </h3>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Grupo {team.group} • {ownedCount}/20</p>
        </div>
      </div>
      
      <div className="h-2 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden mb-2 relative z-10">
        <motion.div 
          initial={{width:0}} 
          animate={{width:`${progress}%`}} 
          className="h-full"
          style={{ backgroundColor: progress === 100 ? '#10b981' : colors.primary }}
        />
      </div>
      
      {isComparing && compareData && <div className="relative z-10"><ComparisonBadge teamId={team.id} myStickers={myStickers} theirStickers={compareData.stickers} count={20} /></div>}
      {isViewingFriendAlbum && <div className="absolute inset-0 bg-amber-500/5 pointer-events-none" />}
    </motion.button>
  );
}

function ComparisonBadge({ teamId, myStickers, theirStickers, count }: { 
  teamId: string; 
  myStickers: Record<string, number>; 
  theirStickers: Record<string, number>; 
  count: number 
}) {
  let meSirven = 0; let leSirven = 0;
  for (let i = 1; i <= count; i++) {
    const sId = `${teamId}-${i}`; const my = myStickers[sId] || 0; const their = theirStickers[sId] || 0;
    if (my === 0 && their > 1) meSirven++; if (their === 0 && my > 1) leSirven++;
  }
  if (meSirven === 0 && leSirven === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {meSirven > 0 && <span className="text-[10px] bg-green-500/10 text-green-600 border border-green-500/20 px-2 py-0.5 rounded-lg font-black">+{meSirven} ME SIRVE</span>}
      {leSirven > 0 && <span className="text-[10px] bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2 py-0.5 rounded-lg font-black">+{leSirven} LE SIRVE</span>}
    </div>
  );
}

function TeamDetail({ teamId, onClose, compareData, isFriendView }: { 
  teamId: string; 
  onClose: () => void; 
  compareData: { userId: string; name: string; stickers: Record<string, number>; shortId: string } | null;
  isFriendView?: boolean;
}) {
  const { stickers, updateSticker } = useAlbum();
  const team = TEAMS.find(t => t.id === teamId) || (SPECIALS as Record<string, { name: string; count: number; flag?: string }>)[teamId];
  const count = team.count || 20;
  const colors = COUNTRY_COLORS[teamId] || { primary: '#2563eb', secondary: '#ffffff', text: '#ffffff' };

  const effectiveStickers = isFriendView && compareData ? compareData.stickers : stickers;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-xl" />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative w-full max-w-4xl bg-white dark:bg-gray-950 sm:rounded-[40px] rounded-t-[40px] shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="relative p-8 overflow-hidden shrink-0">
          {/* Flag Background Wash */}
          <div className="absolute inset-0 opacity-[0.2] dark:opacity-[0.3] scale-150 rotate-12 blur-2xl pointer-events-none">
             <img src={getFlagUrl(teamId)} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
          </div>
          
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-6">
               <div 
                 className="w-20 h-20 rounded-[28px] flex items-center justify-center text-5xl shadow-2xl border-4 border-white dark:border-gray-800"
                 style={{ backgroundColor: colors.primary }}
               >
                 {team.flag || '⚽'}
               </div>
               <div>
                 <h3 className="text-4xl font-black uppercase tracking-tighter text-gray-900 dark:text-white">
                   {team.name} <span className="text-gray-500 font-bold ml-2">({teamId})</span>
                 </h3>
                 <div className="flex items-center gap-3">
                   <p className="text-gray-500 dark:text-gray-400 text-xs font-black uppercase tracking-widest">{count} fichas totales</p>
                   <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                   <span className="text-[10px] bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-black">
                     {isFriendView ? 'MODO LECTURA' : 'MANTÉN PARA QUITAR'}
                   </span>
                 </div>
               </div>
            </div>
            <button 
              onClick={onClose} 
              className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/20 dark:bg-white/5 backdrop-blur-md hover:bg-white/30 dark:hover:bg-white/10 transition-colors border border-white/20"
            >
              <ChevronRight className="rotate-90 w-6 h-6 text-gray-900 dark:text-white" />
            </button>
          </div>
        </div>

        <div className="flex-1 p-8 pt-6 overflow-y-auto overflow-x-hidden">
          {compareData && (
            <motion.div 
               initial={{ opacity: 0, y: -10 }}
               animate={{ opacity: 1, y: 0 }}
               className="mb-10 p-5 rounded-[24px] bg-green-500/10 border border-green-500/20 flex items-center gap-4"
            >
               <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center shadow-lg"><ArrowLeftRight className="text-white w-5 h-5" /></div>
               <div className="flex-1">
                 <p className="font-black text-green-600 dark:text-green-400 uppercase text-xs">Comparando con {compareData.name}</p>
                 <p className="text-[10px] text-green-600/70 font-bold uppercase tracking-tight">Verde te falta a ti • Naranja le falta a él</p>
               </div>
            </motion.div>
          )}

          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-x-3 gap-y-6 pb-12">
            {Array.from({ length: count }, (_, i) => i + 1).map(num => {
              const sId = `${teamId}-${num}`; const my = effectiveStickers[sId] || 0; const their = isFriendView ? stickers[sId] : (compareData?.stickers[sId] || 0);
              const isSpecial = (teamId === '00' || teamId === 'FWC' || teamId === 'CC') || (num === 1 || num === 13);
              const playerName = PLAYER_NAMES[teamId]?.[num];
              
              // Highlight logic for comparisons
              let ring = ""; 
              if (compareData) {
                const myCount = stickers[sId] || 0;
                const friendCount = compareData.stickers[sId] || 0;
                
                // Verde (Green): I lack it and friend has it repeated (can give it to me)
                if (myCount === 0 && friendCount > 1) {
                  ring = "ring-4 ring-green-500 ring-offset-4 dark:ring-offset-gray-950";
                }
                // Naranja (Orange): Friend lacks it and I have it repeated (can give it to him)
                else if (friendCount === 0 && myCount > 1) {
                  ring = "ring-4 ring-amber-500 ring-offset-4 dark:ring-offset-gray-950";
                }
              }

              return (
                <div key={sId} className="relative">
                   <StickerButton 
                     id={sId} 
                     label={teamId === '00' ? '00' : (teamId === 'FWC' || teamId === 'CC') ? `${teamId}${num}` : `${num}`} 
                     count={my} 
                     onClick={() => !isFriendView && updateSticker(sId, 1)} 
                     onLongPress={() => !isFriendView && updateSticker(sId, -1)} 
                     className={ring}
                     isSpecial={isSpecial}
                     playerName={playerName}
                   />
                   {((!isFriendView && compareData && their > 0) || (isFriendView && their > 0)) && (
                     <div className={cn(
                       "absolute -top-1.5 -left-1.5 flex h-5 w-5 rounded-full border-2 border-white dark:border-gray-950 z-20 shadow-sm flex items-center justify-center",
                       isFriendView ? "bg-blue-600" : "bg-green-500"
                     )}>
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                     </div>
                   )}
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
