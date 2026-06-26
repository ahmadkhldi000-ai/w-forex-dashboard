// W Forex App — News Screen (English)
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  SafeAreaView, TouchableOpacity, RefreshControl
} from 'react-native';
import { Linking } from 'react-native';

const screenWidth = 360;

// W Forex Dashboard API
const SERVER_URL = 'http://localhost:3000';

export default function NewsScreen() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNews = useCallback(async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/news`);
      const data = await response.json();
      setNews(data);
    } catch (error) {
      console.error('Error fetching news:', error);
      // Fallback news
      setNews([
        {
          id: 1,
          title: 'Gold Prices Surge to New Highs',
          description: 'XAU/USD hits record levels amid global uncertainty.',
          time: '2 hours ago',
          url: 'https://t.me/wforex_vip'
        },
        {
          id: 2,
          title: 'Fed Rate Decision Impact',
          description: 'Central bank policy affects gold trading strategies.',
          time: '5 hours ago',
          url: 'https://t.me/wforex_vip'
        },
        {
          id: 3,
          title: 'Market Volatility Analysis',
          description: 'Understanding risk management in volatile conditions.',
          time: '1 day ago',
          url: 'https://t.me/wforex_vip'
        }
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 60000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNews();
  }, [fetchNews]);

  const formatTime = (timeStr) => {
    return timeStr;
  };

  if (loading && news.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffd700" />
          <Text style={styles.loadingText}>Loading news...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ffd700']} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Market News</Text>
          <Text style={styles.headerSubtitle}>Latest updates from W Forex VIP</Text>
        </View>

        {news.map((item) => (
          <View key={item.id} style={styles.newsCard}>
            <TouchableOpacity
              style={styles.newsCardContent}
              onPress={() => Linking.openURL(item.url)}
            >
              <View style={styles.newsIcon}>📰</View>
              <View style={styles.newsInfo}>
                <Text style={styles.newsTitle}>{item.title}</Text>
                <Text style={styles.newsDescription}>{item.description}</Text>
                <Text style={styles.newsTime}>{item.time}</Text>
              </View>
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            All news from <Text style={styles.footerLink}>W Forex VIP</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e17',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffd700',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    padding: 20,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffd700',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  newsCard: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  newsCardContent: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  newsIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  newsInfo: {
    flex: 1,
  },
  newsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 4,
  },
  newsDescription: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 8,
    lineHeight: 1.5,
  },
  newsTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  footerText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  footerLink: {
    color: '#229ed9',
    fontWeight: '600',
  },
});
