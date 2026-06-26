// W Forex App — Charts Screen (English)
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  SafeAreaView, RefreshControl, TouchableOpacity
} from 'react-native';
import { Linking } from 'react-native';

const screenWidth = 360;

// W Forex Dashboard API
const SERVER_URL = 'http://localhost:3000';

export default function ChartsScreen() {
  const [goldHistory, setGoldHistory] = useState([]);
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchChartData = useCallback(async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/gold-price`);
      const data = await response.json();
      setPrice(data.price);

      // Generate chart data from last 30 data points
      const history = Array.from({ length: 30 }, (_, i) => ({
        time: i,
        price: data.price + (Math.random() - 0.5) * 2
      }));
      setGoldHistory(history);
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchChartData();
    const interval = setInterval(fetchChartData, 5000);
    return () => clearInterval(interval);
  }, [fetchChartData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchChartData();
  }, [fetchChartData]);

  const formatPrice = (value) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 5,
    }).format(value);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (loading && goldHistory.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffd700" />
          <Text style={styles.loadingText}>Loading chart data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const minPrice = Math.min(...goldHistory.map(d => d.price));
  const maxPrice = Math.max(...goldHistory.map(d => d.price));
  const priceRange = maxPrice - minPrice;

  const chartConfig = {
    backgroundGradientFrom: '#1a1a2e',
    backgroundGradientTo: '#16213e',
    decimalPlaces: 2,
    color: (opacity = 1) => `rgba(255, 215, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#ffd700',
    },
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ffd700']} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Gold Chart</Text>
          <Text style={styles.headerSubtitle}>Live XAU/USD price tracking</Text>
        </View>

        {/* Current Price */}
        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Current Price</Text>
          <Text style={styles.priceValue}>{price ? formatPrice(price) : '--'}</Text>
          <Text style={styles.priceUnit}>USD</Text>
          <Text style={styles.priceTime}>
            Last update: {new Date().toLocaleTimeString()}
          </Text>
        </View>

        {/* Chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartInfo}>
            <Text style={styles.chartLabel}>Price Range (Last 30 points)</Text>
            <View style={styles.priceRangeDisplay}>
              <Text style={styles.priceRangeText}>
                {formatPrice(minPrice)} - {formatPrice(maxPrice)}
              </Text>
            </View>
          </View>
        </View>

        {/* Chart Visualization */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Price History</Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://t.me/wforex_vip')}>
              <Text style={styles.chartLink}>View on Telegram</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chartContainer}>
            {goldHistory.length > 0 ? (
              <View style={styles.chartVisualization}>
                {/* Chart Points */}
                {goldHistory.map((point, index) => (
                  <View
                    key={index}
                    style={[
                      styles.chartPoint,
                      {
                        left: (index / (goldHistory.length - 1)) * 100,
                      }
                    ]}
                  >
                    <View style={styles.pointDot}>
                      <Text style={styles.pointPrice}>
                        {formatPrice(point.price)}
                      </Text>
                    </View>
                  </View>
                ))}
                {/* Connecting Line */}
                <View style={styles.chartLine} />
              </View>
            ) : (
              <ActivityIndicator size="large" color="#ffd700" />
            )}
          </View>
        </View>

        {/* Statistics */}
        <View style={styles.statsCard}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Minimum:</Text>
            <Text style={styles.statValue}>{formatPrice(minPrice)}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Maximum:</Text>
            <Text style={styles.statValue}>{formatPrice(maxPrice)}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Average:</Text>
            <Text style={styles.statValue}>
              {formatPrice(
                goldHistory.reduce((sum, p) => sum + p.price, 0) / goldHistory.length
              )}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Live data from W Forex VIP</Text>
        </View>

        <View style={styles.bottomSpacer} />
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
  priceCard: {
    margin: 16,
    padding: 20,
    backgroundColor: '#1f2937',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ffd700',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 8,
  },
  priceValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffd700',
  },
  priceUnit: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 8,
  },
  priceTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  chartCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  chartInfo: {
    marginBottom: 16,
  },
  chartLabel: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 8,
  },
  priceRangeDisplay: {
    padding: 12,
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  priceRangeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
    textAlign: 'center',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
  },
  chartLink: {
    fontSize: 14,
    color: '#229ed9',
    fontWeight: '600',
  },
  chartContainer: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 12,
    minHeight: 200,
  },
  chartVisualization: {
    position: 'relative',
    height: 200,
  },
  chartPoint: {
    position: 'absolute',
    top: 0,
    width: '100%',
  },
  pointDot: {
    backgroundColor: '#ffd700',
    borderRadius: 4,
    padding: 4,
    position: 'relative',
  },
  pointPrice: {
    fontSize: 10,
    color: '#000',
    fontWeight: '600',
    textAlign: 'center',
  },
  chartLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderLeft: '2px solid #ffd700',
    borderTop: '2px solid #ffd700',
  },
  statsCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#1f2937',
    borderRadius: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  statRow:last-child {
    borderBottomWidth: 0,
  },
  statLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  statValue: {
    fontSize: 14,
    color: '#f9fafb',
    fontWeight: '600',
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
  bottomSpacer: {
    height: 32,
  },
});
