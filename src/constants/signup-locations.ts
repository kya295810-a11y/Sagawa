export type SignupCountryCode = 'MY' | 'SG' | 'TH';

export const SIGNUP_COUNTRIES: Array<{ code: SignupCountryCode; label: string }> = [
  { code: 'MY', label: 'Malaysia' },
  { code: 'SG', label: 'Singapore' },
  { code: 'TH', label: 'Thailand' },
];

export const SIGNUP_REGIONS: Record<SignupCountryCode, string[]> = {
  MY: [
    'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Penang',
    'Perak', 'Perlis', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu',
    'Kuala Lumpur', 'Labuan', 'Putrajaya',
  ],
  SG: ['Singapore'],
  TH: [
    'Bangkok', 'Chiang Mai', 'Chiang Rai', 'Chonburi', 'Khon Kaen', 'Krabi',
    'Nakhon Ratchasima', 'Nonthaburi', 'Pathum Thani', 'Phuket',
    'Samut Prakan', 'Songkhla', 'Surat Thani',
  ],
};

export function countryLabel(code: SignupCountryCode) {
  return SIGNUP_COUNTRIES.find((item) => item.code === code)?.label || code;
}
