import { Team } from '../types/sticker';

export const TEAMS: Team[] = [
  // Grupo A
  { id: 'MEX', name: 'México', flag: '🇲🇽', group: 'A' },
  { id: 'RSA', name: 'Sudáfrica', flag: '🇿🇦', group: 'A' },
  { id: 'KOR', name: 'Corea del Sur', flag: '🇰🇷', group: 'A' },
  { id: 'CZE', name: 'República Checa / Czechia', flag: '🇨🇿', group: 'A' },
  // Grupo B
  { id: 'CAN', name: 'Canadá', flag: '🇨🇦', group: 'B' },
  { id: 'BIH', name: 'Bosnia y Herzegovina', flag: '🇧🇦', group: 'B' },
  { id: 'QAT', name: 'Catar / Qatar', flag: '🇶🇦', group: 'B' },
  { id: 'SUI', name: 'Suiza', flag: '🇨🇭', group: 'B' },
  // Grupo C
  { id: 'BRA', name: 'Brasil', flag: '🇧🇷', group: 'C' },
  { id: 'MAR', name: 'Marruecos', flag: '🇲🇦', group: 'C' },
  { id: 'HAI', name: 'Haití', flag: '🇭🇹', group: 'C' },
  { id: 'SCO', name: 'Escocia', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', group: 'C' },
  // Grupo D
  { id: 'USA', name: 'Estados Unidos', flag: '🇺🇸', group: 'D' },
  { id: 'PAR', name: 'Paraguay', flag: '🇵🇾', group: 'D' },
  { id: 'AUS', name: 'Australia', flag: '🇦🇺', group: 'D' },
  { id: 'TUR', name: 'Turquía / Türkiye', flag: '🇹🇷', group: 'D' },
  // Grupo E
  { id: 'GER', name: 'Alemania', flag: '🇩🇪', group: 'E' },
  { id: 'CUW', name: 'Curazao', flag: '🇨🇼', group: 'E' },
  { id: 'CIV', name: 'Costa de Marfil', flag: '🇨🇮', group: 'E' },
  { id: 'ECU', name: 'Ecuador', flag: '🇪🇨', group: 'E' },
  // Grupo F
  { id: 'NED', name: 'Países Bajos', flag: '🇳🇱', group: 'F' },
  { id: 'JPN', name: 'Japón', flag: '🇯🇵', group: 'F' },
  { id: 'SWE', name: 'Suecia', flag: '🇸🇪', group: 'F' },
  { id: 'TUN', name: 'Túnez', flag: '🇹🇳', group: 'F' },
  // Grupo G
  { id: 'BEL', name: 'Bélgica', flag: '🇧🇪', group: 'G' },
  { id: 'EGY', name: 'Egipto', flag: '🇪🇬', group: 'G' },
  { id: 'IRN', name: 'Irán', flag: '🇮🇷', group: 'G' },
  { id: 'NZL', name: 'Nueva Zelanda', flag: '🇳🇿', group: 'G' },
  // Grupo H
  { id: 'ESP', name: 'España', flag: '🇪🇸', group: 'H' },
  { id: 'CPV', name: 'Cabo Verde', flag: '🇨🇻', group: 'H' },
  { id: 'KSA', name: 'Arabia Saudita', flag: '🇸🇦', group: 'H' },
  { id: 'URU', name: 'Uruguay', flag: '🇺🇾', group: 'H' },
  // Grupo I
  { id: 'FRA', name: 'Francia', flag: '🇫🇷', group: 'I' },
  { id: 'SEN', name: 'Senegal', flag: '🇸🇳', group: 'I' },
  { id: 'IRQ', name: 'Irak', flag: '🇮🇶', group: 'I' },
  { id: 'NOR', name: 'Noruega', flag: '🇳🇴', group: 'I' },
  // Grupo J
  { id: 'ARG', name: 'Argentina', flag: '🇦🇷', group: 'J' },
  { id: 'ALG', name: 'Argelia', flag: '🇩🇿', group: 'J' },
  { id: 'AUT', name: 'Austria', flag: '🇦🇹', group: 'J' },
  { id: 'JOR', name: 'Jordania', flag: '🇯🇴', group: 'J' },
  // Grupo K
  { id: 'POR', name: 'Portugal', flag: '🇵🇹', group: 'K' },
  { id: 'COD', name: 'RD Congo / Congo DR', flag: '🇨🇩', group: 'K' },
  { id: 'UZB', name: 'Uzbekistán', flag: '🇺🇿', group: 'K' },
  { id: 'COL', name: 'Colombia', flag: '🇨🇴', group: 'K' },
  // Grupo L
  { id: 'ENG', name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', group: 'L' },
  { id: 'CRO', name: 'Croacia', flag: '🇭🇷', group: 'L' },
  { id: 'GHA', name: 'Ghana', flag: '🇬🇭', group: 'L' },
  { id: 'PAN', name: 'Panamá', flag: '🇵🇦', group: 'L' },
];

export const SPECIALS: Record<string, { name: string; count: number }> = {
  '00': { name: 'Especial 00', count: 1 },
  FWC: { name: 'FIFA World Cup', count: 19 },
  CC: { name: 'Coca-Cola', count: 14 }
};
