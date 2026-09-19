import React from 'react';
import Svg, {
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

type SagawaLogoProps = {
  width?: number;
  height?: number;
};

export function SagawaLogo({ width = 112, height = 112 }: SagawaLogoProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 220 220"
      accessibilityRole="image"
      accessibilityLabel="Sagawa flower logo"
    >
      <Defs>
        <LinearGradient id="petal" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.58" stopColor="#F6FBFF" />
          <Stop offset="1" stopColor="#62B8FF" />
        </LinearGradient>
        <LinearGradient id="ribbon" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.55" stopColor="#F7FBFF" />
          <Stop offset="1" stopColor="#89CAFF" />
        </LinearGradient>
      </Defs>

      <G>
        <Ellipse
          cx="111"
          cy="68"
          rx="31"
          ry="52"
          fill="url(#petal)"
          stroke="#3098E8"
          strokeWidth="2.5"
          transform="rotate(-8 111 68)"
        />
        <Ellipse
          cx="73"
          cy="93"
          rx="29"
          ry="49"
          fill="url(#petal)"
          stroke="#3098E8"
          strokeWidth="2.5"
          transform="rotate(-58 73 93)"
        />
        <Ellipse
          cx="149"
          cy="94"
          rx="29"
          ry="49"
          fill="url(#petal)"
          stroke="#3098E8"
          strokeWidth="2.5"
          transform="rotate(57 149 94)"
        />
        <Ellipse
          cx="88"
          cy="126"
          rx="27"
          ry="47"
          fill="url(#petal)"
          stroke="#3098E8"
          strokeWidth="2.5"
          transform="rotate(-128 88 126)"
        />
        <Ellipse
          cx="133"
          cy="126"
          rx="27"
          ry="47"
          fill="url(#petal)"
          stroke="#3098E8"
          strokeWidth="2.5"
          transform="rotate(128 133 126)"
        />

        <G fill="#FFC21A">
          <Ellipse cx="110" cy="105" rx="8" ry="10" />
          <Ellipse cx="99" cy="96" rx="3.5" ry="8" transform="rotate(-28 99 96)" />
          <Ellipse cx="121" cy="96" rx="3.5" ry="8" transform="rotate(28 121 96)" />
          <Ellipse cx="93" cy="108" rx="3" ry="7" transform="rotate(-65 93 108)" />
          <Ellipse cx="127" cy="108" rx="3" ry="7" transform="rotate(65 127 108)" />
        </G>

        <Path
          d="M43 143 C70 126, 111 126, 177 141 C161 153, 150 166, 139 184 C108 173, 79 166, 48 170 C56 161, 55 152, 43 143 Z"
          fill="url(#ribbon)"
          stroke="#2E95E5"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <Path
          d="M48 169 C70 188, 111 197, 157 185 C141 199, 123 207, 102 208 C79 207, 60 193, 48 169 Z"
          fill="none"
          stroke="#2E95E5"
          strokeWidth="4"
          strokeLinecap="round"
        />

        <SvgText
          x="109"
          y="161"
          textAnchor="middle"
          fill="#218BE1"
          fontSize="27"
          fontWeight="700"
          fontStyle="italic"
          fontFamily="serif"
        >
          Sagawa
        </SvgText>
      </G>
    </Svg>
  );
}
