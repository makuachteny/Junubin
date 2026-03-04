import React from 'react';
import Svg, { Path } from 'react-native-svg';

function GraffitiStar({ size = 24, color = '#000', filled = false, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M12 2.5l2.8 5.8 6.4.8c.3 0 .4.4.2.6l-4.7 4.5 1.2 6.3c.1.3-.3.5-.5.4L12 17.8l-5.4 3.1c-.2.1-.6-.1-.5-.4l1.2-6.3L2.6 9.7c-.2-.2-.1-.6.2-.6l6.4-.8L12 2.5z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default React.memo(GraffitiStar);
