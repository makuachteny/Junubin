import React from 'react';
import LogoMark from './LogoMark';

export default function HabobaLogo({ size = 'medium', light = false }) {
  const dims = {
    small: 44,
    medium: 64,
    large: 108,
  }[size] || 64;

  return <LogoMark size={dims} light={light} />;
}
