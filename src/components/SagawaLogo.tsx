import React from 'react';
import Svg, {
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

type SagawaLogoProps = {
  width?: number;
  height?: number;
};

export function SagawaLogo({ width = 132, height = 132 }: SagawaLogoProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 320 320"
      accessibilityRole="image"
      accessibilityLabel="Sagawa flower logo"
    >
      <Defs>
        <LinearGradient id="petalTop" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.48" stopColor="#F8FCFF" />
          <Stop offset="0.78" stopColor="#CBE9FF" />
          <Stop offset="1" stopColor="#58B4FF" />
        </LinearGradient>

        <LinearGradient id="petalSide" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#67B9FA" />
          <Stop offset="0.28" stopColor="#EAF7FF" />
          <Stop offset="0.72" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#75C0FA" />
        </LinearGradient>

        <RadialGradient id="flowerCenter" cx="0.5" cy="0.45" rx="0.65" ry="0.65">
          <Stop offset="0" stopColor="#FFF7B8" />
          <Stop offset="0.42" stopColor="#FFD83E" />
          <Stop offset="1" stopColor="#F2A900" />
        </RadialGradient>

        <LinearGradient id="ribbonFill" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#DDF2FF" />
          <Stop offset="0.18" stopColor="#FFFFFF" />
          <Stop offset="0.72" stopColor="#F9FCFF" />
          <Stop offset="1" stopColor="#73BEF7" />
        </LinearGradient>

        <LinearGradient id="tailFill" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FDFEFF" />
          <Stop offset="0.62" stopColor="#B9E0FF" />
          <Stop offset="1" stopColor="#2F9AE9" />
        </LinearGradient>
      </Defs>

      <G>
        <Path
          d="M151 144 C120 105 102 63 120 27 C132 4 156 4 177 26 C198 49 205 88 194 122 C186 145 172 158 160 165 C158 157 155 150 151 144 Z"
          fill="url(#petalTop)"
          stroke="#168EE8"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />

        <Path
          d="M147 151 C111 143 65 127 42 96 C25 73 31 52 56 46 C90 38 126 54 149 84 C166 106 170 129 165 147 C159 148 153 150 147 151 Z"
          fill="url(#petalSide)"
          stroke="#168EE8"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />

        <Path
          d="M172 151 C204 137 245 120 276 126 C301 131 310 151 297 171 C280 197 244 207 207 195 C187 188 173 176 166 164 C168 160 170 155 172 151 Z"
          fill="url(#petalSide)"
          stroke="#168EE8"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />

        <Path
          d="M152 162 C126 173 88 190 62 214 C43 231 45 253 66 263 C91 274 126 260 153 231 C171 212 179 189 174 171 C166 167 159 164 152 162 Z"
          fill="url(#petalTop)"
          stroke="#168EE8"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />

        <Path
          d="M169 166 C190 172 221 190 239 216 C252 235 248 255 228 264 C206 274 177 263 160 238 C147 219 143 194 151 176 C157 171 163 168 169 166 Z"
          fill="url(#petalTop)"
          stroke="#168EE8"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />

        <Path
          d="M154 157 C146 145 145 133 151 125 C159 114 174 114 184 124 C195 134 194 149 184 160 C177 167 167 170 158 166 Z"
          fill="url(#flowerCenter)"
        />

        <G stroke="#F0AE00" strokeWidth="3.4" strokeLinecap="round">
          <Path d="M159 146 L147 119" />
          <Path d="M164 143 L159 112" />
          <Path d="M170 143 L173 112" />
          <Path d="M176 147 L188 120" />
          <Path d="M181 153 L201 134" />
        </G>

        <G fill="#FFC928" stroke="#EAA300" strokeWidth="1.2">
          <Path d="M142 117 C140 111 144 106 149 108 C154 110 154 116 151 120 C148 123 144 122 142 117 Z" />
          <Path d="M155 109 C154 103 158 99 163 101 C168 103 168 109 165 113 C162 116 157 114 155 109 Z" />
          <Path d="M171 109 C171 103 175 99 180 101 C185 103 185 109 181 113 C178 116 173 114 171 109 Z" />
          <Path d="M187 118 C187 112 191 108 196 110 C201 112 201 118 197 122 C194 125 189 123 187 118 Z" />
          <Path d="M199 132 C201 126 206 124 210 127 C214 131 212 136 207 139 C203 141 199 137 199 132 Z" />
        </G>

        <Path
          d="M45 189 C89 164 137 166 188 181 C225 192 255 191 290 171 C278 191 278 211 289 229 C247 248 208 250 166 239 C123 228 83 223 42 237 C54 220 55 204 45 189 Z"
          fill="url(#ribbonFill)"
          stroke="#158FE8"
          strokeWidth="3.2"
          strokeLinejoin="round"
        />

        <Path
          d="M43 188 C32 199 24 210 20 226 C31 222 41 221 53 223 C56 211 53 199 43 188 Z"
          fill="url(#tailFill)"
          stroke="#158FE8"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        <Path
          d="M290 171 C301 166 309 160 316 151 C312 171 310 188 312 205 C301 211 294 219 289 229 C279 211 280 191 290 171 Z"
          fill="url(#tailFill)"
          stroke="#158FE8"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        <Path
          d="M58 237 C80 268 119 288 162 290 C204 292 238 279 267 252 C246 284 207 306 163 307 C115 306 75 281 58 237 Z"
          fill="none"
          stroke="#1695EA"
          strokeWidth="5"
          strokeLinecap="round"
        />

        <SvgText
          x="172"
          y="222"
          textAnchor="middle"
          fill="#168EE8"
          stroke="#0E70C3"
          strokeWidth="0.45"
          fontSize="42"
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
