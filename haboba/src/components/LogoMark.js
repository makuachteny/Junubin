// JuNubin — JB Crown Logo Mark (SVG)
// Instagram-style flowing script "JB" with royal crown.
// Crown jewels use South Sudanese flag colours (blue, red, green).

import React from 'react';
import Svg, {
  Path, Circle, G, Text as SvgText,
  Defs, LinearGradient, Stop, Rect,
} from 'react-native-svg';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, FontFamily } from '../theme';

export default function LogoMark({ size = 120, light = false }) {
  const { colors, isDark } = useTheme();
  const fill = light ? '#FFFFFF' : isDark ? '#FFFFFF' : colors.primary;
  const showSub = size >= 80;
  const totalH = showSub ? size * 1.2 : size;

  // JB script only (no crown). ViewBox shows full JB letters.
  const vbW = 200;
  const vbH = showSub ? 170 : 130;

  return (
    <View style={{ width: size, height: totalH, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={totalH} viewBox={`10 118 ${vbW} ${vbH}`}>
        <Defs />

        {/* ═══ "JB" SCRIPT — Instagram / Billabong style ═══ */}
        {/* Rendered as filled calligraphic outlines for reliability */}
        <G>
          {/* ── J ── */}
          {/* Crossbar dot / flourish */}
          <Path
            d={`
              M 62,132
              C 66,128 80,126 92,127
              C 97,127.5 100,130 98,133
              C 96,136 84,137 74,136.5
              C 66,136 60,135 62,132
              Z
            `}
            fill={fill}
          />

          {/* J stem + hook — thick calligraphic outline */}
          <Path
            d={`
              M 88,133
              C 89,133 92,133 93,134
              C 95,140 96,155 96,168
              C 96,180 94,190 88,198
              C 82,206 72,212 60,212
              C 50,212 42,206 40,198
              C 38,192 40,186 46,183
              C 50,181 54,182 58,185
              C 62,188 64,190 62,194
              C 60,196 56,196 54,194
              C 52,192 52,188 55,186
              C 52,184 48,184 46,186
              C 43,189 43,195 46,200
              C 50,206 60,208 68,205
              C 76,202 82,194 84,184
              C 86,174 86,160 85,148
              C 84,140 83,135 82,133
              C 83,132 86,132 88,133
              Z
            `}
            fill={fill}
          />

          {/* ── B ── */}
          {/* The B connects via a flowing upstroke from the J region */}
          <Path
            d={`
              M 90,198
              C 92,192 96,182 100,172
              C 104,162 108,148 110,138
              C 112,130 113,126 116,124
              C 120,122 126,122 132,126
              C 140,130 146,138 146,148
              C 146,156 140,162 132,164
              C 126,165.5 120,164 116,162

              C 120,164 128,166 136,170
              C 146,176 152,184 152,194
              C 152,204 146,212 136,216
              C 128,219 118,217 110,212
              C 104,208 100,202 98,198

              C 96,204 92,208 88,210
              C 86,208 86,204 88,200
              C 89,198 90,198 90,198
              Z

              M 116,158
              C 122,157 130,155 134,150
              C 138,145 138,138 134,133
              C 130,128 124,127 120,128
              C 116,130 114,134 113,140
              C 112,148 114,155 116,158
              Z

              M 114,170
              C 112,176 110,184 110,190
              C 110,198 114,206 122,210
              C 130,214 140,210 144,202
              C 148,194 146,184 138,178
              C 132,173 124,170 118,170
              C 116,170 114,170 114,170
              Z
            `}
            fill={fill}
            fillRule="evenodd"
          />
        </G>

        {/* ═══ Subtitle ═══ */}
        {showSub && (
          <SvgText
            x="110"
            y="252"
            textAnchor="middle"
            fontFamily="DancingScript-Bold"
            fontSize="30"
            fill={fill}
            opacity={0.6}
            letterSpacing={0.5}
          >
            AnaJunubin
          </SvgText>
        )}
      </Svg>
    </View>
  );
}
