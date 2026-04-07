import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { Star, ShieldCheck, Zap } from 'lucide-react-native';
import Colors from '@/constants/Colors';
import { getDefaultAvatarUrl } from '@/utils/userUtils';

const { width } = Dimensions.get('window');

interface SocialShareCardProps {
  type: 'profile' | 'establishment' | 'review';
  data: any;
  theme: any;
}

export const SocialShareCard: React.FC<SocialShareCardProps> = ({ type, data, theme }) => {
  if (!data) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* TopTop Header */}
      <View style={styles.header}>
        <Zap size={24} color={theme.primary} />
        <Text style={[styles.brandText, { color: theme.text }]}>TopTop</Text>
      </View>

      {type === 'establishment' && (
        <View style={styles.card}>
          <Image 
            source={{ uri: data.photoUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80' }} 
            style={styles.mainImage} 
          />
          <View style={styles.cardContent}>
            <Text style={[styles.title, { color: theme.text }]}>{data.name}</Text>
            <View style={styles.row}>
              <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                <Star size={14} color="#1C1F26" fill="#1C1F26" />
                <Text style={styles.badgeText}>{data.rating || 'N/A'}</Text>
              </View>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {data.category} • {data.address}
              </Text>
            </View>
          </View>
        </View>
      )}

      {type === 'profile' && (
        <View style={styles.profileCard}>
          <View style={[styles.avatarWrapper, { borderColor: data.rankColor }]}>
            <Image source={{ uri: data.photoURL || getDefaultAvatarUrl(data.displayName || data.username || 'User') }} style={styles.avatar} />
            <View style={[styles.rankOrb, { backgroundColor: data.rankColor }]}>
              <Zap size={12} color="#1C1F26" />
            </View>
          </View>
          <Text style={[styles.profileName, { color: theme.text }]}>{data.displayName || data.username}</Text>
          <Text style={[styles.profileUser, { color: theme.textSecondary }]}>@{data.username}</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: theme.text }]}>{data.reviewsCount}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Reviews</Text>
            </View>
            <View style={styles.statSeparation} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: theme.text }]}>{data.points}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Points</Text>
            </View>
          </View>
        </View>
      )}

      {type === 'review' && (
        <View style={styles.reviewCard}>
          <View style={styles.reviewUserRow}>
            <Image source={{ uri: data.user_avatar || getDefaultAvatarUrl(data.user_name || 'User') }} style={styles.smallAvatar} />
            <View>
              <Text style={[styles.reviewUserName, { color: theme.text }]}>{data.user_name}</Text>
              <View style={styles.topTopBadge}>
                <ShieldCheck size={12} color={theme.primary} />
                <Text style={[styles.topTopBadgeText, { color: theme.primary }]}>TopTop Member</Text>
              </View>
            </View>
          </View>
          
          <Text style={[styles.reviewTitle, { color: theme.text }]}>reviewed {data.establishmentName}</Text>
          
          <View style={styles.ratingCircle}>
             <Text style={styles.ratingValue}>{Number(data.rating || 0).toFixed(1)}</Text>
          </View>

          <Text style={[styles.comment, { color: theme.text }]} numberOfLines={4}>
            "{data.comment}"
          </Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.textSecondary }]}>Discover the best on TopTop</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: width * 0.9,
    padding: 24,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  brandText: {
    fontSize: 22,
    fontWeight: '800',
    marginLeft: 8,
    letterSpacing: 1,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  mainImage: {
    width: '100%',
    height: 200,
  },
  cardContent: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
  },
  badgeText: {
    fontWeight: 'bold',
    marginLeft: 4,
    color: '#1C1F26',
  },
  subtitle: {
    flex: 1,
    fontSize: 14,
  },
  profileCard: {
    alignItems: 'center',
    padding: 20,
  },
  avatarWrapper: {
    borderWidth: 3,
    padding: 4,
    borderRadius: 65,
    marginBottom: 16,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  rankOrb: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    padding: 6,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  profileName: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  profileUser: {
    fontSize: 18,
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 30,
    alignItems: 'center',
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statNum: {
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  statSeparation: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  reviewCard: {
    width: '100%',
    padding: 20,
  },
  reviewUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  smallAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  reviewUserName: {
    fontSize: 16,
    fontWeight: '600',
  },
  topTopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topTopBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  reviewTitle: {
    fontSize: 20,
    marginBottom: 20,
  },
  ratingCircle: {
     alignSelf: 'center',
     width: 80,
     height: 80,
     borderRadius: 40,
     backgroundColor: '#FFD700',
     justifyContent: 'center',
     alignItems: 'center',
     marginBottom: 20,
  },
  ratingValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1C1F26',
  },
  comment: {
    fontSize: 18,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 28,
  },
  footer: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    width: '100%',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    letterSpacing: 1,
  },
});
