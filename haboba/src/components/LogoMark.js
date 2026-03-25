// JuNubin — JB Logo Mark (SVG)
// Instagram-style flowing script "JB" with gradient fill + optional pulse animation.

import React, { useEffect, useRef } from 'react';
import Svg, {
  Path,
  G,
  Text as SvgText,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
} from 'react-native-svg';
import { View, Animated, Easing } from 'react-native';
import { useTheme } from '../theme';

const J_CROSSBAR = 'M 62,132 C 66,128 80,126 92,127 C 97,127.5 100,130 98,133 C 96,136 84,137 74,136.5 C 66,136 60,135 62,132 Z';

const J_STEM = 'M 88,133 C 89,133 92,133 93,134 C 95,140 96,155 96,168 C 96,180 94,190 88,198 C 82,206 72,212 60,212 C 50,212 42,206 40,198 C 38,192 40,186 46,183 C 50,181 54,182 58,185 C 62,188 64,190 62,194 C 60,196 56,196 54,194 C 52,192 52,188 55,186 C 52,184 48,184 46,186 C 43,189 43,195 46,200 C 50,206 60,208 68,205 C 76,202 82,194 84,184 C 86,174 86,160 85,148 C 84,140 83,135 82,133 C 83,132 86,132 88,133 Z';

const B_PATH = 'M 90,198 C 92,192 96,182 100,172 C 104,162 108,148 110,138 C 112,130 113,126 116,124 C 120,122 126,122 132,126 C 140,130 146,138 146,148 C 146,156 140,162 132,164 C 126,165.5 120,164 116,162 C 120,164 128,166 136,170 C 146,176 152,184 152,194 C 152,204 146,212 136,216 C 128,219 118,217 110,212 C 104,208 100,202 98,198 C 96,204 92,208 88,210 C 86,208 86,204 88,200 C 89,198 90,198 90,198 Z M 116,158 C 122,157 130,155 134,150 C 138,145 138,138 134,133 C 130,128 124,127 120,128 C 116,130 114,134 113,140 C 112,148 114,155 116,158 Z M 114,170 C 112,176 110,184 110,190 C 110,198 114,206 122,210 C 130,214 140,210 144,202 C 148,194 146,184 138,178 C 132,173 124,170 118,170 C 116,170 114,170 114,170 Z';

export default function LogoMark({ size = 120, light = false, animated = false }) {
  const { colors, isDark } = useTheme();
  const showSub = size >= 80;
  const vbW = 220;
  const vbH = showSub ? 170 : 115;
  const totalH = size * (vbH / vbW);

  // ── Pulse + glow animation for loading states ──
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (!animated) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.85,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    glow.start();
    return () => { pulse.stop(); glow.stop(); };
  }, [animated, pulseAnim, glowAnim]);

  // Gradient fill for the JB letters — Instagram warm gradient (orange → pink → purple)
  const letterFill = 'url(#jbGrad)';
  // Subtitle: translucent white on dark bg, translucent accent on light bg
  const subFill = (light || isDark) ? 'rgba(255,255,255,0.55)' : `${colors.accent}88`;

  const svgContent = (
    <View style={{ width: size, height: totalH, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={totalH} viewBox={`0 115 ${vbW} ${vbH}`}>
        <Defs>
          <SvgGradient id="jbGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#1A1A1A" />
            <Stop offset="0.25" stopColor="#DC2626" />
            <Stop offset="0.5" stopColor="#009739" />
            <Stop offset="0.75" stopColor="#16A34A" />
            <Stop offset="1" stopColor="#2563EB" />
          </SvgGradient>
        </Defs>

        <G>
          <Path d={J_CROSSBAR} fill={letterFill} />
          <Path d={J_STEM} fill={letterFill} />
          <Path d={B_PATH} fill={letterFill} fillRule="evenodd" />
        </G>

        {showSub && (
          <SvgText
            x="110"
            y="268"
            textAnchor="middle"
            fontFamily="DancingScript-Bold"
            fontSize="30"
            fill={subFill}
            letterSpacing={0.5}
          >
            AnaJunubin
          </SvgText>
        )}
      </Svg>
    </View>
  );

  if (animated) {
    return (
      <Animated.View style={{ opacity: glowAnim, transform: [{ scale: pulseAnim }] }}>
        {svgContent}
      </Animated.View>
    );
  }

  return svgContent;
}
