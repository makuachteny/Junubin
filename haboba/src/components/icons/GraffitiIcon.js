import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import GraffitiHeart from './GraffitiHeart';
import GraffitiLocation from './GraffitiLocation';
import GraffitiChat from './GraffitiChat';
import GraffitiSparkles from './GraffitiSparkles';
import GraffitiCrown from './GraffitiCrown';
import GraffitiSend from './GraffitiSend';
import GraffitiFlame from './GraffitiFlame';
import GraffitiStar from './GraffitiStar';
import GraffitiUndo from './GraffitiUndo';
import GraffitiSmiley from './GraffitiSmiley';

const ICON_MAP = {
  'heart': GraffitiHeart,
  'heart-outline': GraffitiHeart,
  'location': GraffitiLocation,
  'location-outline': GraffitiLocation,
  'chatbubbles': GraffitiChat,
  'chatbubbles-outline': GraffitiChat,
  'sparkles': GraffitiSparkles,
  'crown': GraffitiCrown,
  'send': GraffitiSend,
  'paper-plane': GraffitiSend,
  'flame': GraffitiFlame,
  'star': GraffitiStar,
  'undo': GraffitiUndo,
  'emoticon-happy-outline': GraffitiSmiley,
};

const FILLED_NAMES = new Set([
  'heart', 'location', 'chatbubbles', 'sparkles', 'crown',
  'send', 'paper-plane', 'flame', 'star',
]);

function GraffitiIcon({ name, size = 24, color = '#000', style }) {
  const Component = ICON_MAP[name];
  if (!Component) {
    return <Ionicons name={name} size={size} color={color} style={style} />;
  }
  const filled = FILLED_NAMES.has(name);
  return <Component size={size} color={color} filled={filled} style={style} />;
}

export default React.memo(GraffitiIcon);
