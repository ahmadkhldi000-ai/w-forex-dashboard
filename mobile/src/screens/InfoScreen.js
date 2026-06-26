// W Forex App — Info Screen (English)
import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity
} from 'react-native';
import { Linking } from 'react-native';

export default function InfoScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>About W Forex VIP</Text>
          <Text style={styles.headerSubtitle}>Smart Grid Trading Bot</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Welcome to W Forex VIP — the official dashboard for our advanced
            trading bot that uses MetaTrader 5 Grid Strategy.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>📊</Text>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Live Dashboard</Text>
              <Text style={styles.featureDescription}>
                Real-time display of all trading positions and gold prices
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🤖</Text>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Auto Trading Bot</Text>
              <Text style={styles.featureDescription}>
                Smart Grid EA manages up to 15 trades with automatic profit closure
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>📈</Text>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Gold Price Updates</Text>
              <Text style={styles.featureDescription}>
                Live XAU/USD prices from multiple data sources
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>✈️</Text>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Telegram Channel</Text>
              <Text style={styles.featureDescription}>
                Join W Forex VIP for instant trade notifications and signals
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>📱</Text>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Mobile Access</Text>
              <Text style={styles.featureDescription}>
                Access your trading data from anywhere on your mobile device
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Technical Details</Text>

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Platform:</Text>
            <Text style={styles.detailValue}>MetaTrader 5</Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Strategy:</Text>
            <Text style={styles.detailValue}>Smart Grid</Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Max Trades:</Text>
            <Text style={styles.detailValue}>15 positions</Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Risk Management:</Text>
            <Text style={styles.detailValue}>
              Auto profit closure + smart loss protection
            </Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Data Feed:</Text>
            <Text style={styles.detailValue}>
              XAU/USD (GC=F) via Yahoo Finance
            </Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Dashboard URL:</Text>
            <Text style={styles.detailValue}>
              http://localhost:3000
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Status</Text>

          <View style={styles.statusCard}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Server:</Text>
              <Text style={styles.statusValue}>Online ✓</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Data Feed:</Text>
              <Text style={styles.statusValue}>Active ✓</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Telegram:</Text>
              <Text style={styles.statusValue}>Connected ✓</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>

          <TouchableOpacity
            style={styles.supportButton}
            onPress={() => Linking.openURL('https://t.me/wforex_vip')}
          >
            <Text style={styles.supportButtonText}>Join W Forex VIP Channel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.supportButton}
            onPress={() => Linking.openURL('https://t.me/wforex_vip')}
          >
            <Text style={styles.supportButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2026 W Forex VIP</Text>
          <Text style={styles.footerTextSmall}>Smart Trading Bot</Text>
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
  infoCard: {
    margin: 16,
    padding: 20,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  infoText: {
    fontSize: 15,
    color: '#f9fafb',
    lineHeight: 1.6,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    marginBottom: 12,
  },
  featureIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 1.5,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  detailValue: {
    fontSize: 14,
    color: '#f9fafb',
    fontWeight: '600',
  },
  statusCard: {
    padding: 16,
    backgroundColor: '#1f2937',
    borderRadius: 12,
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  statusItem:last-child {
    borderBottomWidth: 0,
  },
  statusLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  statusValue: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  supportButton: {
    padding: 16,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  supportButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f9fafb',
    textAlign: 'center',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffd700',
  },
  footerTextSmall: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  bottomSpacer: {
    height: 32,
  },
});
