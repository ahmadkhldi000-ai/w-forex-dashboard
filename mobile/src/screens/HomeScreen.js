// W Forex App — Home Screen (English)
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator, SafeAreaView
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Chart, LineChart, XAxis, YAxis, Grid, Tooltip, CartesianChart } from 'react-native-chart-kit';

const screenWidth = 360;
const screenHeight = 640;

// W Forex Dashboard API
const SERVER_URL = 'http://localhost:3000';

// Gold chart config
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

export default function HomeScreen() {
  const [positions, setPositions] = useState([]);
  const [goldPrice, setGoldPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalProfit, setTotalProfit] = useState(0);
  const [activeTrades, setActiveTrades] = useState(0);

  const fetchPositions = useCallback(async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/positions`);
      const data = await response.json();
      setPositions(data);

      const active = data.filter(p => !p.closed_at).length;
      const profit = data.reduce((sum, p) => sum + (p.profit || 0), 0);
      setActiveTrades(active);
      setTotalProfit(profit);
    } catch (error) {
      console.error('Error fetching positions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchGoldPrice = useCallback(async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/gold-price`);
      const data = await response.json();
      setGoldPrice(data.price);
    } catch (error) {
      console.error('Error fetching gold price:', error);
    }
  }, []);

  useEffect(() => {
    fetchPositions();
    fetchGoldPrice();
    const interval = setInterval(() => {
      fetchPositions();
      fetchGoldPrice();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchPositions, fetchGoldPrice]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPositions();
    fetchGoldPrice();
  }, [fetchPositions, fetchGoldPrice]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPrice = (value) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 5,
    }).format(value);
  };

  if (loading && positions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffd700" />
          <Text style={styles.loadingText}>Loading...</Text>
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>W Forex VIP</Text>
          <Text style={styles.headerSubtitle}>Smart Trading Bot</Text>
        </View>

        {/* Gold Price Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>XAU/USD Gold Price</Text>
            <View style={styles.priceContainer}>
              <Text style={styles.priceValue}>{goldPrice ? formatPrice(goldPrice) : '--'}</Text>
              <Text style={styles.priceUnit}>USD</Text>
            </View>
          </View>
          <View style={styles.lastUpdate}>
            <Text style={styles.lastUpdateText}>
              Last update: {new Date().toLocaleTimeString()}
            </Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>📊</Text>
            <Text style={styles.statLabel}>Active Trades</Text>
            <Text style={styles.statValue}>{activeTrades}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>📈</Text>
            <Text style={styles.statLabel}>Total Profit</Text>
            <Text style={styles.statValue}>{formatCurrency(totalProfit)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>💎</Text>
            <Text style={styles.statLabel}>Positions</Text>
            <Text style={styles.statValue}>{positions.length}</Text>
          </View>
        </View>

        {/* Gold Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gold Chart</Text>
          <View style={styles.chartContainer}>
            <View style={styles.chart}>
              <LineChart
                data={{
                  labels: positions.slice(-10).map((_, i) => i + 1),
                  datasets: [{
                    data: positions.slice(-10).map(p => p.profit || 0),
                  }]
                }}
                width={screenWidth - 32}
                height={220}
                chartConfig={chartConfig}
                withDots={false}
                bezier
                style={styles.chartStyle}
              />
            </View>
          </View>
        </View>

        {/* Positions Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Open Positions</Text>
          <View style={styles.table}>
            {positions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No open positions</Text>
              </View>
            ) : (
              <ScrollView style={styles.tableScrollView}>
                {positions.map((position) => (
                  <View key={position.id} style={styles.row}>
                    <View style={styles.rowLeft}>
                      <Text style={styles.symbol}>{position.symbol}</Text>
                      <Text style={styles.type}>
                        {position.type === 'BUY' ? '🟢 BUY' : '🔴 SELL'}
                      </Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={styles.volume}>{position.volume} lots</Text>
                      <Text style={styles.price}>
                        {formatPrice(position.open_price)}
                      </Text>
                      {position.profit && (
                        <Text
                          style={[
                            styles.profit,
                            position.profit > 0 ? styles.profitPositive : styles.profitNegative
                          ]}
                        >
                          {formatCurrency(position.profit)}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>

        {/* Telegram Link */}
        <TouchableOpacity
          style={styles.telegramButton}
          onPress={() => Linking.openURL('https://t.me/wforex_vip')}
        >
          <View style={styles.telegramButtonContent}>
            <Text style={styles.telegramIcon}>✈️</Text>
            <Text style={styles.telegramButtonText}>Join W Forex VIP Channel</Text>
          </View>
          <Text style={styles.telegramButtonTextSmall}>Live signals & notifications</Text>
        </TouchableOpacity>

        {/* Bottom Spacer */}
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
  card: {
    margin: 16,
    padding: 20,
    backgroundColor: '#1f2937',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '600',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffd700',
    marginRight: 4,
  },
  priceUnit: {
    fontSize: 12,
    color: '#9ca3af',
  },
  lastUpdate: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  lastUpdateText: {
    fontSize: 12,
    color: '#6b7280',
  },
  statsGrid: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f9fafb',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 12,
  },
  chartContainer: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  chart: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartStyle: {
    marginVertical: 8,
    borderRadius: 16,
  },
  table: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    overflow: 'hidden',
    maxHeight: 400,
  },
  tableScrollView: {
    maxHeight: 400,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  rowLeft: {
    flex: 1,
  },
  rowRight: {
    flex: 2,
    alignItems: 'flex-end',
  },
  symbol: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f9fafb',
  },
  type: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  buy: {
    color: '#10b981',
  },
  sell: {
    color: '#ef4444',
  },
  volume: {
    fontSize: 14,
    color: '#9ca3af',
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
    marginTop: 4,
  },
  profit: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  profitPositive: {
    color: '#10b981',
  },
  profitNegative: {
    color: '#ef4444',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  telegramButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    backgroundColor: 'linear-gradient(135deg, #0088cc 0%, #229ed9 100%)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#229ed9',
  },
  telegramButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  telegramIcon: {
    fontSize: 32,
  },
  telegramButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  telegramButtonTextSmall: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 8,
  },
  bottomSpacer: {
    height: 32,
  },
});
