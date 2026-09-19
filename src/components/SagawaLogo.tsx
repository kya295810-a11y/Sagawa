import React from 'react';
import { Image } from 'react-native';

type SagawaLogoProps = {
  width?: number;
  height?: number;
};

const SAGAWA_LOGO = require('../../assets/images/sagawa-about-logo.png');

export function SagawaLogo({ width = 132, height = 132 }: SagawaLogoProps) {
  return (
    <Image
      source={SAGAWA_LOGO}
      style={{ width, height }}
      resizeMode="contain"
      accessibilityLabel="Sagawa flower logo"
    />
  );
}
