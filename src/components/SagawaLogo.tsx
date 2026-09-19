import React from 'react';
import { Image } from 'react-native';

type SagawaLogoProps = {
  width?: number;
  height?: number;
};

const SAGAWA_LOGO = require('../../assets/images/sagawa-about-logo-exact.png');

export function SagawaLogo({ width = 150, height = 150 }: SagawaLogoProps) {
  return (
    <Image
      source={SAGAWA_LOGO}
      style={{ width, height }}
      resizeMode="contain"
      fadeDuration={0}
      accessibilityLabel="Sagawa flower logo"
    />
  );
}
