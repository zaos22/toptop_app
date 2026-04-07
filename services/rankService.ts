
export interface RankLevel {
    name: string;
    minPoints: number;
    color: string;
    badgeName: string;
    description: string;
}

/**
 * Curated list of ranks designed to be:
 * - Easy at start (retention)
 * - Competitive in middle (engagement)
 * - Prestigious at the end (status)
 */
export const RANKS: RankLevel[] = [
    { name: 'Novato', minPoints: 0, color: '#94A3B8', badgeName: 'Seed', description: 'Acabas de aterrizar en TopTop.' },
    { name: 'Explorador', minPoints: 50, color: '#38BDF8', badgeName: 'Compass', description: 'Empiezas a conocer los mejores sitios.' },
    { name: 'Comensal', minPoints: 200, color: '#4ADE80', badgeName: 'Utensils', description: 'Tus reseñas ya tienen peso en la comunidad.' },
    { name: 'Crítico', minPoints: 500, color: '#FACC15', badgeName: 'PenTool', description: 'Tienes un ojo clínico para la calidad.' },
    { name: 'Gourmet', minPoints: 1200, color: '#FB923C', badgeName: 'Grape', description: 'Solo recomiendas lo verdaderamente Top.' },
    { name: 'Experto', minPoints: 2500, color: '#F87171', badgeName: 'Award', description: 'La comunidad confía plenamente en tu criterio.' },
    { name: 'Élite', minPoints: 5000, color: '#C084FC', badgeName: 'Crown', description: 'Pocos llegan a este nivel de exigencia.' },
    { name: 'Leyenda', minPoints: 10000, color: '#D6B25E', badgeName: 'Trophy', description: 'Tu nombre es sinónimo de calidad suprema.' },
    { name: 'Mítico', minPoints: 20000, color: '#2DD4BF', badgeName: 'Zap', description: 'Un ser casi místico en el mundo del ranking.' },
    { name: 'TopTop God', minPoints: 50000, color: '#94A3B8', badgeName: 'Infinity', description: 'El máximo nivel de excelencia alcanzable.' },
];

export const getRankByPoints = (points: number): RankLevel => {
    for (let i = RANKS.length - 1; i >= 0; i--) {
        if (points >= RANKS[i].minPoints) {
            return RANKS[i];
        }
    }
    return RANKS[0];
};

export const getNextRank = (points: number): RankLevel | null => {
    for (let i = 0; i < RANKS.length; i++) {
        if (points < RANKS[i].minPoints) {
            return RANKS[i];
        }
    }
    return null;
};

export const getRankProgress = (points: number): number => {
    const currentRank = getRankByPoints(points);
    const nextRank = getNextRank(points);

    if (!nextRank) return 100;

    const range = nextRank.minPoints - currentRank.minPoints;
    const progress = points - currentRank.minPoints;

    return Math.min(Math.round((progress / range) * 100), 100);
};

/**
 * Balanced points system to keep users engaged.
 * Quality (Likes) > Quantity (just posting)
 */
export const POINTS_CONFIG = {
    REVIEW_SUBMITTED: 40,      // Basic post
    PHOTO_ADDED: 15,          // Bonus for visual content
    REVIEW_LIKE_RECEIVED: 20,  // Reward for quality (support from others)
    FIRST_VISIT_PLACE: 10,     // Discovery bonus
    BADGE_EARNED: 100,         // Milestone bonus
};
