import React from 'react';
import Svg, { Path, Circle, Line, Rect, Ellipse } from 'react-native-svg';

// Hand-drawn graffiti SVG replacements for every identity sticker emoji.
// Each renders inside a 24x24 viewBox, rough strokes, wobbly lines.

const sw = 1.6; // default stroke width
const cap = 'round';
const join = 'round';

function Lion({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="13" r="5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} />
      <Path d="M9.5 12a1 1 0 1 1 0-.1M14.5 12a1 1 0 1 1 0-.1" fill={color} />
      <Path d="M10.5 15c.7.6 1.5.8 2.2.4" fill="none" stroke={color} strokeWidth={1.2} strokeLinecap={cap} />
      <Path d="M7.2 10.5C5.5 9 4.8 6.5 6 5c1-1.2 2.5-.5 3.2.5M16.8 10.5c1.7-1.5 2.4-4 1.2-5.5-1-1.2-2.5-.5-3.2.5M8.5 8.5C7 7.2 6 5 7.5 4M15.5 8.5c1.5-1.3 2.5-3.5 1-5M12 8c0-2 .5-4 1.5-5.5M12 8c0-2-.5-4-1.5-5.5" fill="none" stroke={color} strokeWidth={1.4} strokeLinecap={cap} strokeLinejoin={join} />
      <Path d="M9 17c-.5 1.5-.2 3 .8 3.8M15 17c.5 1.5.2 3-.8 3.8" fill="none" stroke={color} strokeWidth={1.2} strokeLinecap={cap} />
    </Svg>
  );
}

function Leopard({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8 14c-1.5 1-2.5 3-2 5 .5 1.5 2.5 2 4 1.5s2.5-2 3.5-1.5c1.2.5 2.5 1.2 4 .5 1.5-.8 2-2.5 1.5-4-.3-1-1-2-2-2.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
      <Path d="M7 11c-1-2 0-4.5 2-5.5s4.5-.5 5.5 1c.8 1.2.5 2.5 1.5 3s2.5.5 3.5 1.5 1 3 0 4" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
      <Circle cx="9.5" cy="9" r=".8" fill={color} />
      <Circle cx="13" cy="8.5" r=".8" fill={color} />
      <Circle cx="11" cy="12" r="1" fill="none" stroke={color} strokeWidth={1} />
      <Circle cx="14.5" cy="12" r=".8" fill="none" stroke={color} strokeWidth={1} />
      <Circle cx="9" cy="15" r=".9" fill="none" stroke={color} strokeWidth={1} />
      <Circle cx="12.5" cy="16" r=".7" fill="none" stroke={color} strokeWidth={1} />
      <Path d="M5.5 10c-1-.5-2-.2-2.5.5M4.5 12c-1 .2-1.5 1-1 2" fill="none" stroke={color} strokeWidth={1.2} strokeLinecap={cap} />
    </Svg>
  );
}

function Leaf({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 21c1-3 3-6 6-8 3-2.5 6.5-3 9-2.5-1 4-3 7-6 9.5s-7 3-9 1z" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
      <Path d="M6 21c3-3 6-5.5 9-7.5" fill="none" stroke={color} strokeWidth={1.2} strokeLinecap={cap} />
      <Path d="M10 16.5c1.5-1 3-2.5 5-3M8.5 18.5c2-1.5 4-2.5 5.5-4" fill="none" stroke={color} strokeWidth={0.8} strokeLinecap={cap} />
    </Svg>
  );
}

function Globe({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="9.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} />
      <Ellipse cx="12" cy="12" rx="4.5" ry="9.5" fill="none" stroke={color} strokeWidth={1.2} strokeLinecap={cap} />
      <Path d="M3 9.5h18M3 14.5h18" fill="none" stroke={color} strokeWidth={1} strokeLinecap={cap} />
    </Svg>
  );
}

function Temple({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 20h16M5 20v-8M19 20v-8M9 20v-8M12 20v-8M15 20v-8" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} />
      <Path d="M4 12h16M3.5 12l8.5-8 8.5 8" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
      <Line x1="3" y1="20" x2="21" y2="20" stroke={color} strokeWidth={2} strokeLinecap={cap} />
    </Svg>
  );
}

function Masks({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 7c0-2 2-4 5-4s5 2 5 4-1 5-2.5 6.5c-1 1-2 1.5-2.5 1.5s-1.5-.5-2.5-1.5C5 12 4 9 4 7z" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
      <Circle cx="7" cy="7.5" r="1" fill={color} />
      <Circle cx="11" cy="7.5" r="1" fill={color} />
      <Path d="M7.5 10.5c.5.5 1.2.8 1.5.5" fill="none" stroke={color} strokeWidth={1.2} strokeLinecap={cap} />
      <Path d="M14 10c0-1.5 1.5-3 4-3s4 1.5 4 3-.8 4-2 5c-.8.8-1.5 1.2-2 1.2s-1.2-.4-2-1.2C14.8 14 14 11.5 14 10z" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
      <Circle cx="16.5" cy="10" r=".8" fill={color} />
      <Circle cx="19.5" cy="10" r=".8" fill={color} />
      <Path d="M17 12.5c.3-.6 1-.8 1.5-.3" fill="none" stroke={color} strokeWidth={1.2} strokeLinecap={cap} />
    </Svg>
  );
}

function Dancer({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="14" cy="4" r="2" fill="none" stroke={color} strokeWidth={sw} />
      <Path d="M10 22l2-6 3 2.5v3.5M16 22l-1-4-3-2.5-1.5-3.5 3-2 4 2v4" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
      <Path d="M8 10l4.5-2 3 1.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
      <Path d="M7.5 8c-.5-1 0-2 1-2.5" fill="none" stroke={color} strokeWidth={1.2} strokeLinecap={cap} />
    </Svg>
  );
}

function Palette({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.5C6.5 2.5 2 6.5 2 11.5c0 3.5 2 5.5 4.5 5.5 1.5 0 2.5-1 2.5-2.5 0-1-.5-1.5-.5-2.5s1-2 2.5-2h2c4.5 0 8.5-2 8.5-5.5 0-3.5-4-4-9.5-4z" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
      <Circle cx="8" cy="8.5" r="1.3" fill={color} />
      <Circle cx="12" cy="6.5" r="1.3" fill={color} />
      <Circle cx="16" cy="8" r="1.3" fill={color} />
      <Circle cx="17.5" cy="11.5" r="1.1" fill={color} />
    </Svg>
  );
}

function Camera({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3.5 8.5c0-1.5 1-2.5 2.5-2.5h1l1-2h8l1 2h1c1.5 0 2.5 1 2.5 2.5v9c0 1.5-1 2.5-2.5 2.5h-13c-1.5 0-2.5-1-2.5-2.5z" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
      <Circle cx="12" cy="12.5" r="3.5" fill="none" stroke={color} strokeWidth={sw} />
      <Circle cx="12" cy="12.5" r="1.5" fill={color} />
    </Svg>
  );
}

function Plane({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M21 3L10 14M21 3l-5 18-4-8M21 3L3 8l8 4" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
    </Svg>
  );
}

function Party({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 21L9 4l8 8z" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
      <Path d="M6.5 15l3-6 3.5 3.5" fill="none" stroke={color} strokeWidth={0.8} strokeLinecap={cap} />
      <Path d="M14 2c.5 1.5 0 3-1 3.5M18 4c.5 1 .2 2.5-1 3M20 8c-.5 1-1.5 1.5-2.5 1" fill="none" stroke={color} strokeWidth={1.3} strokeLinecap={cap} />
      <Circle cx="14.5" cy="1.5" r=".8" fill={color} />
      <Circle cx="19" cy="3.5" r=".7" fill={color} />
      <Circle cx="21" cy="7.5" r=".6" fill={color} />
    </Svg>
  );
}

function Wave({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M2 12c2-3 4-4 6-2s4 1 6-2 4-3 6-1M2 16c2-3 4-4 6-2s4 1 6-2 4-3 6-1M2 20c2-3 4-4 6-2s4 1 6-2 4-3 6-1" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
    </Svg>
  );
}

function Dress({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8 2h8l-1.5 6 3.5 4v2H6v-2l3.5-4zM6 14l-1 7h14l-1-7" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
      <Path d="M10 2c0 1.5.8 2.5 2 2.5S14 3.5 14 2" fill="none" stroke={color} strokeWidth={1.2} strokeLinecap={cap} />
    </Svg>
  );
}

function Cross({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3v18M6 8h12" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap={cap} strokeLinejoin={join} />
    </Svg>
  );
}

function Runner({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="15" cy="4" r="2" fill="none" stroke={color} strokeWidth={sw} />
      <Path d="M8 22l3-7 4 1v6M18 22l-3-5-4-1-2-5 3-2 5 3" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
      <Path d="M5 10.5l4-2" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} />
    </Svg>
  );
}

function MusicNote({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 18V5l12-3v13" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
      <Circle cx="6.5" cy="18.5" r="2.5" fill="none" stroke={color} strokeWidth={sw} />
      <Circle cx="18.5" cy="15.5" r="2.5" fill="none" stroke={color} strokeWidth={sw} />
    </Svg>
  );
}

function Book({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M2 4c2-1 5-1.5 10 1v16c-5-2.5-8-2-10-1zM22 4c-2-1-5-1.5-10 1v16c5-2.5 8-2 10-1z" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
    </Svg>
  );
}

function Brain({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3c-2 0-3.5 1-4 2.5-.5-.2-1.5 0-2.2.8s-1 2-.5 3c-.8.5-1.5 1.5-1.3 3 .2 1.5 1 2.5 2 3 0 1 .5 2 1.5 2.8 1 .8 2.5 1 3.5.5.5.8 1.5 1.2 2.5.8" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
      <Path d="M12 3c2 0 3.5 1 4 2.5.5-.2 1.5 0 2.2.8s1 2 .5 3c.8.5 1.5 1.5 1.3 3-.2 1.5-1 2.5-2 3 0 1-.5 2-1.5 2.8-1 .8-2.5 1-3.5.5-.5.8-1.5 1.2-2.5.8" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
      <Path d="M12 3v17.4" fill="none" stroke={color} strokeWidth={1} strokeLinecap={cap} />
    </Svg>
  );
}

function Food({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 14c0 4 4 7 9 7s9-3 9-7z" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
      <Path d="M3 14h18" stroke={color} strokeWidth={sw} strokeLinecap={cap} />
      <Path d="M5 14c1-4 3.5-6 7-6s6 2 7 6" fill="none" stroke={color} strokeWidth={1} strokeLinecap={cap} strokeDasharray="2 2" />
      <Path d="M7 11c.5-.5 1.2-.5 1.5 0M11 9.5c.5-.8 1.5-.8 2 0M16 10.5c.5-.5 1-.5 1.5 0" fill="none" stroke={color} strokeWidth={1.2} strokeLinecap={cap} />
    </Svg>
  );
}

function Lipstick({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8 12h8v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1zM8 12l1-8h6l1 8" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
      <Path d="M9 4l1.5-2h3L15 4" fill="none" stroke={color} strokeWidth={1.2} strokeLinecap={cap} strokeLinejoin={join} />
      <Line x1="8" y1="15" x2="16" y2="15" stroke={color} strokeWidth={1} strokeLinecap={cap} />
    </Svg>
  );
}

function Cow({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Ellipse cx="12" cy="14" rx="7" ry="5.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} />
      <Path d="M5 12c-1.5-1-2.5-3-2-5 .3-1 1.2-1.5 2-.8M19 12c1.5-1 2.5-3 2-5-.3-1-1.2-1.5-2-.8" fill="none" stroke={color} strokeWidth={1.4} strokeLinecap={cap} strokeLinejoin={join} />
      <Circle cx="10" cy="13" r="1" fill={color} />
      <Circle cx="14" cy="13" r="1" fill={color} />
      <Ellipse cx="12" cy="17" rx="2" ry="1.2" fill="none" stroke={color} strokeWidth={1.2} />
      <Path d="M8 20c-.5 1.5-.5 2.5 0 2.5M16 20c.5 1.5.5 2.5 0 2.5" fill="none" stroke={color} strokeWidth={1.2} strokeLinecap={cap} />
    </Svg>
  );
}

function Laptop({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3.5 5.5h17v11h-17z" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} rx="1" />
      <Path d="M2 16.5h20l-1.5 3H3.5z" fill="none" stroke={color} strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} />
      <Path d="M9 19.5h6" stroke={color} strokeWidth={1} strokeLinecap={cap} />
    </Svg>
  );
}

function Basketball({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="9.5" fill="none" stroke={color} strokeWidth={sw} />
      <Path d="M12 2.5v19M2.5 12h19" fill="none" stroke={color} strokeWidth={1.2} strokeLinecap={cap} />
      <Path d="M4.5 5c2.5 2 4 5 4 7.5s-1.5 5-3.5 7M19.5 5c-2.5 2-4 5-4 7.5s1.5 5 3.5 7" fill="none" stroke={color} strokeWidth={1.2} strokeLinecap={cap} />
    </Svg>
  );
}

function Soccer({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="9.5" fill="none" stroke={color} strokeWidth={sw} />
      <Path d="M12 2.5l2 5.5h5.5l2-5M12 2.5l-2 5.5H4.5l-2-5M7 18.5L10 14h4l3 4.5M2.8 9.5l5 2-1.5 5-5.5.5M21.2 9.5l-5 2 1.5 5 5.5.5" fill="none" stroke={color} strokeWidth={1} strokeLinecap={cap} strokeLinejoin={join} />
    </Svg>
  );
}

function Sparkle({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.5c.3 1.8.8 3.5 1.8 5 1 1.4 2.6 2.3 4.4 2.8-1.8.5-3.4 1.4-4.4 2.8-1 1.5-1.5 3.2-1.8 5-.3-1.8-.8-3.5-1.8-5-1-1.4-2.6-2.3-4.4-2.8 1.8-.5 3.4-1.4 4.4-2.8 1-1.5 1.5-3.2 1.8-5z" fill={color} stroke={color} strokeWidth={1} strokeLinecap={cap} strokeLinejoin={join} />
    </Svg>
  );
}

function Crown({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3.5 18.5h17l1.8-11.2c.1-.3-.3-.5-.5-.3L18 11.5l-4.5-7.8c-.2-.3-.6-.3-.8 0L8.2 11.5 4.2 7c-.2-.2-.6 0-.5.3z" fill={color} stroke={color} strokeWidth={1} strokeLinecap={cap} strokeLinejoin={join} />
    </Svg>
  );
}

function Flame({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12.5 2.2c.8 2.5 2.5 4.5 3.8 6.5 1.5 2.3 2.2 5 1 7.5-1.5 3.2-5.5 4.8-8.8 3.5-3.2-1.3-4.8-5-3.2-8.2.5-1 1.2-1.8 1.8-2.8.1-.1.3-.1.3.1-.2 1.2 0 2.5.6 3.5.1.2.4.1.4-.1.2-2.2.8-4.3 2-6.2.9-1.5 1.5-3 2.1-3.8z" fill={color} stroke={color} strokeWidth={0.8} strokeLinecap={cap} strokeLinejoin={join} />
    </Svg>
  );
}

// Emoji → graffiti component map
const EMOJI_MAP = {
  '\u{1F981}': Lion,        // 🦁
  '\u{1F406}': Leopard,     // 🐆
  '\u{1F33F}': Leaf,        // 🌿
  '\u{1F30D}': Globe,       // 🌍
  '\u{1F3DB}\uFE0F': Temple,// 🏛️
  '\u{1F3DB}': Temple,      // 🏛 (without variation selector)
  '\u{1F3AD}': Masks,       // 🎭
  '\u{1F483}': Dancer,      // 💃
  '\u{1F3A8}': Palette,     // 🎨
  '\u{1F4F7}': Camera,      // 📷
  '\u2708\uFE0F': Plane,    // ✈️
  '\u2708': Plane,           // ✈
  '\u{1F389}': Party,       // 🎉
  '\u{1F30A}': Wave,        // 🌊
  '\u{1F457}': Dress,       // 👗
  '\u271D\uFE0F': Cross,    // ✝️
  '\u271D': Cross,           // ✝
  '\u{1F3C3}': Runner,      // 🏃
  '\u{1F3B6}': MusicNote,   // 🎶
  '\u{1F3B5}': MusicNote,   // 🎵
  '\u{1F4D6}': Book,        // 📖
  '\u{1F9E0}': Brain,       // 🧠
  '\u{1F372}': Food,        // 🍲
  '\u{1F958}': Food,        // 🥘
  '\u2728': Sparkle,        // ✨
  '\u{1F451}': Crown,       // 👑
  '\u{1F484}': Lipstick,    // 💄
  '\u{1F404}': Cow,         // 🐄
  '\u{1F4BB}': Laptop,      // 💻
  '\u{1F3C0}': Basketball,  // 🏀
  '\u26BD': Soccer,         // ⚽
  '\u{1F525}': Flame,       // 🔥
};

function GraffitiStickerIcon({ emoji, size = 24, color = '#FFF' }) {
  const Component = EMOJI_MAP[emoji];
  if (!Component) {
    // Fallback: render emoji as text (for any unmapped emoji)
    return null;
  }
  return <Component size={size} color={color} />;
}

// Check if we have a graffiti version for a given emoji
const MemoGraffitiStickerIcon = React.memo(GraffitiStickerIcon);
MemoGraffitiStickerIcon.has = (emoji) => !!EMOJI_MAP[emoji];

export default MemoGraffitiStickerIcon;
