import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: ['.open-next/**', '.wrangler/**', 'src/lib/recompry/schema.d.ts'],
  },
  {
    rules: {
      // Las imágenes del API ya vienen en WebP y con tamaños; usamos <img> a propósito.
      '@next/next/no-img-element': 'off',
    },
  },
];

export default config;
