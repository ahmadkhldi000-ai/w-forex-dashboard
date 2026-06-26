// W Forex App — شاشة "عن البوت"
import React from 'react';
import { View, Text, ScrollView, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { COLORS, BOT_INFO } from '../config';

const FEATURES = [
  { icon: '🎯', title: 'إغلاق تلقائي للربح',
    desc: 'يغلق كل صفقة بمجرد تحقيق هدف الربح (0.30$) دون تدخل يدوي.' },
  { icon: '🛡️', title: 'حماية من الخسائر',
    desc: 'إغلاق جماعي عند تجاوز 20 صفقة خاسرة، واستئناف ذكي عبر المتوسط المتحرك.' },
  { icon: '⚡', title: 'تنفيذ فوري',
    desc: 'استراتيجية الشبكة تفتح صفقات على مستويات مدروسة، بحد أقصى 15 صفقة نشطة.' },
  { icon: '📡', title: 'إشعارات تيليجرام',
    desc: 'كل صفقة (فتح/إغلاق) تُرسل مباشرة إلى قناة W Forex VIP.' },
  { icon: '📈', title: 'سعر ذهب مطابق',
    desc: 'السعر المعروض مطابق لمنصة MT5 مع تحديث لحظي.' },
  { icon: '📱', title: 'متابعة من أي مكان',
    desc: 'تابع صفقاتك وأرباحك من هاتفك على مدار الساعة.' },
];

export default function AboutScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroBox}>
        <Text style={styles.emoji}>🤖</Text>
        <Text style={styles.title}>بوت <Text style={styles.gold}>W Forex</Text> الذكي</Text>
        <Text style={styles.version}>الإصدار {BOT_INFO.version}</Text>
        <Text style={styles.desc}>
          نظام تداول احترافي للذهب يعمل على MetaTrader 5 باستراتيجية الشبكة (Grid).
          مصمّم لتحقيق أرباح ثابتة مع حماية متقدّمة من المخاطر، ويبثّ كل صفقة مباشرة
          إلى موقعك وتطبيقك وقناة تيليجرام.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>المميزات</Text>
      {FEATURES.map((f, i) => (
        <View key={i} style={styles.feature}>
          <Text style={styles.featureIcon}>{f.icon}</Text>
          <View style={styles.featureBody}>
            <Text style={styles.featureTitle}>{f.title}</Text>
            <Text style={styles.featureDesc}>{f.desc}</Text>
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>إعدادات الاستراتيجية</Text>
      <View style={styles.card}>
        <Row label="الرمز" value={BOT_INFO.symbol} />
        <Row label="هدف الربح للصفقة" value={BOT_INFO.profitTarget + ' $'} />
        <Row label="الحد الأقصى للصفقات" value={String(BOT_INFO.maxTrades)} />
        <Row label="قناة الإشارات" value={BOT_INFO.channel} />
      </View>

      <Text style={styles.sectionTitle}>قناة تيليجرام</Text>
      <TouchableOpacity style={styles.tgBtn}
        onPress={() => Linking.openURL('https://t.me/').catch(() => {})}>
        <Text style={styles.tgBtnText}>💬 انضم إلى W Forex VIP</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>© 2026 W Forex VIP · جميع الحقوق محفوظة</Text>
    </ScrollView>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40 },
  heroBox: { alignItems: 'center', paddingVertical: 20 },
  emoji: { fontSize: 56 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginTop: 8 },
  gold: { color: COLORS.gold },
  version: { color: COLORS.muted, fontSize: 13, marginTop: 4, fontFamily: 'monospace' },
  desc: { color: COLORS.muted, fontSize: 14, lineHeight: 22, marginTop: 14, textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginTop: 24, marginBottom: 12 },
  feature: { flexDirection: 'row', backgroundColor: COLORS.surface, borderColor: COLORS.border,
             borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 10, alignItems: 'flex-start' },
  featureIcon: { fontSize: 28, marginRight: 14 },
  featureBody: { flex: 1 },
  featureTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  featureDesc: { color: COLORS.muted, fontSize: 13, lineHeight: 20 },
  card: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 14, padding: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 8,
         borderBottomColor: COLORS.border, borderBottomWidth: 1 },
  rowLabel: { color: COLORS.muted, fontSize: 14 },
  rowValue: { color: COLORS.text, fontSize: 14, fontWeight: '600', fontFamily: 'monospace' },
  tgBtn: { backgroundColor: COLORS.telegram, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  tgBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  footer: { color: COLORS.muted, fontSize: 12, textAlign: 'center', marginTop: 24 },
});
