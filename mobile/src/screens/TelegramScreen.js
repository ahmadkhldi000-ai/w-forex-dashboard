// W Forex App — شاشة قناة تيليجرام W Forex VIP
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { fetchTelegram, timeAgo } from '../api';
import { COLORS } from '../config';

export default function TelegramScreen() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await fetchTelegram(20);
      setMessages(d.messages || []);
    } catch (e) {
      console.warn('fetchTelegram failed:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 20000); // كل 20 ثانية
    return () => clearInterval(id);
  }, [load]);

  const renderItem = ({ item }) => (
    <View style={styles.msg}>
      <Text style={styles.msgText}>{item.text}</Text>
      <Text style={styles.msgMeta}>{timeAgo(item.date)} · {item.chat || 'W Forex VIP'}</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>W</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>W Forex VIP</Text>
          <Text style={styles.headerSub}>قناة الإشارات المباشرة</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.gold} />
          <Text style={styles.loadingText}>جارٍ تحميل الرسائل…</Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item, i) => String(item.id || i)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load}
                                           tintColor={COLORS.gold} />}
          ListEmptyComponent={
            <Text style={styles.empty}>لا توجد رسائل بعد. سيظهر هنا كل ما يرسله البوت لقناة W Forex VIP.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderBottomColor: COLORS.border, borderBottomWidth: 1,
    backgroundColor: COLORS.surface,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.telegram,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerInfo: { flex: 1 },
  headerTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  headerSub: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.muted, marginTop: 12 },
  list: { padding: 16 },
  msg: {
    backgroundColor: 'rgba(34,158,217,0.08)', borderColor: 'rgba(34,158,217,0.18)',
    borderWidth: 1, borderRadius: 12, padding: 14,
  },
  msgText: { color: COLORS.text, fontSize: 14, lineHeight: 22 },
  msgMeta: { color: COLORS.muted, fontSize: 11, marginTop: 8 },
  empty: { color: COLORS.muted2, textAlign: 'center', paddingVertical: 30, fontSize: 14 },
});
