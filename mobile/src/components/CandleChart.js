// W Forex App — مكوّن شارت الشموع اليابانية (مخصص خفيف)
import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Line, Rect, Text as SvgText, Path } from 'react-native-svg';
import { COLORS } from '../config';

const { width } = Dimensions.get('window');

export default function CandleChart({ candles = [], height = 320 }) {
  const view = useMemo(() => {
    if (!candles.length) return null;
    const data = candles.slice(-80); // آخر 80 شمعة للوضوح
    const w = width - 32;
    const cw = w / data.length;
    const bodyW = Math.max(2, cw * 0.65);

    const highs = data.map(c => c.high);
    const lows = data.map(c => c.low);
    const max = Math.max(...highs);
    const min = Math.min(...lows);
    const range = (max - min) || 1;
    const pad = range * 0.08;
    const top = max + pad;
    const bot = min - pad;
    const span = top - bot;

    const y = price => ((top - price) / span) * (height - 40) + 10;

    const priceLines = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const p = top - (span * i) / steps;
      priceLines.push({ y: y(p), price: p });
    }

    return { data, w, cw, bodyW, y, priceLines };
  }, [candles, height]);

  if (!view) {
    return (
      <View style={[styles.empty, { height }]}>
        <SvgText>...</SvgText>
      </View>
    );
  }

  const { data, w, cw, bodyW, y, priceLines } = view;

  return (
    <View style={[styles.container, { height }]}>
      <Svg width={width - 16} height={height}>
        {/* شبكة أفقية + علامات السعر */}
        {priceLines.map((pl, i) => (
          <React.Fragment key={'g' + i}>
            <Line x1="0" y1={pl.y} x2={width - 16} y2={pl.y}
                  stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <SvgText x={width - 24} y={pl.y - 3} fill={COLORS.muted} fontSize="9"
                     fontFamily="monospace" textAnchor="end">
              {pl.price.toFixed(1)}
            </SvgText>
          </React.Fragment>
        ))}

        {/* الشموع */}
        {data.map((c, i) => {
          const x = i * cw + cw / 2;
          const isUp = c.close >= c.open;
          const color = isUp ? COLORS.green : COLORS.red;
          const yo = y(c.open), yc = y(c.close), yh = y(c.high), yl = y(c.low);
          const bodyTop = Math.min(yo, yc);
          const bodyH = Math.max(1, Math.abs(yc - yo));
          return (
            <React.Fragment key={'c' + i}>
              <Line x1={x} y1={yh} x2={x} y2={yl} stroke={color} strokeWidth="1" />
              <Rect x={x - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH}
                    fill={color} opacity={isUp ? 0.9 : 0.9} />
            </React.Fragment>
          );
        })}
      </Svg>
      {/* علامة مائية W FOREX */}
      <View style={styles.watermark} pointerEvents="none">
        <SvgText>W FOREX</SvgText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0a12',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  empty: {
    backgroundColor: '#0a0a12',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  watermark: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.05,
  },
});
