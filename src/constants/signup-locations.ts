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

export const SIGNUP_CITIES: Record<SignupCountryCode, Record<string, string[]>> = {
  MY: {
    Johor: ['Johor Bahru','Batu Pahat','Kluang','Muar','Pasir Gudang','Segamat'],
    Kedah: ['Alor Setar','Kulim','Sungai Petani','Langkawi'],
    Kelantan: ['Kota Bharu','Pasir Mas','Tanah Merah'],
    Melaka: ['Melaka City','Alor Gajah','Jasin'],
    'Negeri Sembilan': ['Seremban','Port Dickson','Nilai'],
    Pahang: ['Kuantan','Bentong','Temerloh','Cameron Highlands'],
    Penang: ['George Town','Bayan Lepas','Butterworth','Bukit Mertajam','Seberang Jaya'],
    Perak: ['Ipoh','Taiping','Teluk Intan','Sitiawan','Lumut'],
    Perlis: ['Kangar','Arau','Kuala Perlis'],
    Sabah: ['Kota Kinabalu','Sandakan','Tawau','Lahad Datu'],
    Sarawak: ['Kuching','Miri','Sibu','Bintulu'],
    Selangor: ['Shah Alam','Petaling Jaya','Subang Jaya','Klang','Kajang','Puchong','Cyberjaya'],
    Terengganu: ['Kuala Terengganu','Dungun','Kemaman'],
    'Kuala Lumpur': ['Kuala Lumpur'],
    Labuan: ['Labuan'],
    Putrajaya: ['Putrajaya'],
  },
  SG: { Singapore: ['Singapore'] },
  TH: {
    Bangkok:['Bangkok'], 'Chiang Mai':['Chiang Mai'], 'Chiang Rai':['Chiang Rai'],
    Chonburi:['Chonburi','Pattaya'], 'Khon Kaen':['Khon Kaen'], Krabi:['Krabi'],
    'Nakhon Ratchasima':['Nakhon Ratchasima'], Nonthaburi:['Nonthaburi'],
    'Pathum Thani':['Pathum Thani'], Phuket:['Phuket'], 'Samut Prakan':['Samut Prakan'],
    Songkhla:['Songkhla','Hat Yai'], 'Surat Thani':['Surat Thani','Ko Samui'],
  },
};

export function countryLabel(code: SignupCountryCode) {
  return SIGNUP_COUNTRIES.find((item) => item.code === code)?.label || code;
}
