import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router, type Href } from 'expo-router';

import SagawaFlowerLogo from '../../assets/images/sagawa-flower-logo.svg';
import { apiRequest } from '@/services/api/client';
import { useAuthStore } from '@/store/auth-store';
import {
  SIGNUP_COUNTRIES, SIGNUP_REGIONS, countryLabel, type SignupCountryCode,
} from '@/constants/signup-locations';

type Channel = 'email' | 'phone';
type Stage = 'details' | 'verify' | 'password';
type PickerKind = 'country' | 'region' | 'date' | null;

const BOLD = Platform.OS === 'android' ? '700' : '800';
const PHONE_CODES: Record<SignupCountryCode, string> = { MY: '+60', SG: '+65', TH: '+66' };

function isoDate(year: string, month: string, day: string) {
  if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) return '';
  const y = Number(year), m = Number(month), d = Number(day);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return '';
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function ageFromDob(dob: string) {
  const birth = new Date(`${dob}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const md = now.getUTCMonth() - birth.getUTCMonth();
  if (md < 0 || (md === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

export default function SignupScreen() {
  const [stage, setStage] = useState<Stage>('details');
  const [channel, setChannel] = useState<Channel>('email');
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [country, setCountry] = useState<SignupCountryCode>('MY');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [agree, setAgree] = useState(false);
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [identifierHint, setIdentifierHint] = useState('');
  const [signupTicket, setSignupTicket] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [picker, setPicker] = useState<PickerKind>(null);
  const [submitting, setSubmitting] = useState(false);

  const dob = useMemo(() => isoDate(birthYear, birthMonth, birthDay), [birthYear, birthMonth, birthDay]);
  const regions = SIGNUP_REGIONS[country];

  const selectCountry = (next: SignupCountryCode) => {
    setCountry(next);
    if (channel === 'phone') setIdentifier('');
    setRegion(next === 'SG' ? 'Singapore' : '');
    setCity(next === 'SG' ? 'Singapore' : '');
    setPicker(null);
  };

  const requestVerification = async () => {
    const trimmedName = name.trim().replace(/\s+/g, ' ');
    if (!trimmedName || trimmedName.length > 100) return Alert.alert('Check your name', 'Enter your name using 100 characters or fewer.');
    if (!dob || ageFromDob(dob) < 18 || ageFromDob(dob) > 120) return Alert.alert('Age requirement', 'Choose a valid date of birth. You must be 18 or older.');
    if (!region || !city.trim()) return Alert.alert('Location required', 'Choose your state/province and enter your city.');
    if (!identifier.trim()) return Alert.alert(channel === 'email' ? 'Email required' : 'Phone required', channel === 'email' ? 'Enter your email address.' : `Enter a valid ${countryLabel(country)} mobile number.`);
    if (!agree) return Alert.alert('Agreement required', 'Please accept the Terms and Privacy Policy.');

    try {
      setSubmitting(true);
      const response = await apiRequest<{ success: boolean; data: { challengeId: string; identifierHint: string } }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName, dateOfBirth: dob, country, state: region, city: city.trim(),
          identifier: identifier.trim(), channel, platform: Platform.OS,
        }),
      });
      setChallengeId(response.data.challengeId);
      setIdentifierHint(response.data.identifierHint);
      setCode('');
      setStage('verify');
    } catch (error) {
      Alert.alert('Unable to send verification code', error instanceof Error ? error.message : 'Please try again.');
    } finally { setSubmitting(false); }
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code.trim())) return Alert.alert('Invalid code', 'Enter the 6-digit verification code.');
    try {
      setSubmitting(true);
      const response = await apiRequest<{ success: boolean; data: { signupTicket: string } }>('/api/auth/register/verify', {
        method: 'POST', body: JSON.stringify({ challengeId, code: code.trim() }),
      });
      setSignupTicket(response.data.signupTicket);
      setPassword('');
      setConfirmPassword('');
      setStage('password');
    } catch (error) {
      Alert.alert('Verification failed', error instanceof Error ? error.message : 'Request a new code and try again.');
    } finally { setSubmitting(false); }
  };

  const createAccount = async () => {
    if (password.length < 6 || password.length > 128) return Alert.alert('Check your password', 'Use between 6 and 128 characters.');
    if (password !== confirmPassword) return Alert.alert('Passwords do not match', 'Enter the same password in both fields.');
    try {
      setSubmitting(true);
      const response = await apiRequest<{ success: boolean; data: {
        accessToken: string; refreshToken: string; expiresAt: string; profileCompleted: boolean;
        user: { id: string; email?: string; phoneNumber?: string };
      } }>('/api/auth/register/complete', {
        method: 'POST',
        body: JSON.stringify({ signupTicket, password, confirmPassword, platform: Platform.OS }),
      });
      await useAuthStore.getState().setSession(
        { expiresAt: response.data.expiresAt, profileCompleted: true, user: response.data.user },
        { accessToken: response.data.accessToken, refreshToken: response.data.refreshToken },
      );
      router.replace('/(tabs)' as Href);
    } catch (error) {
      Alert.alert('Unable to create account', error instanceof Error ? error.message : 'Please try again.');
    } finally { setSubmitting(false); }
  };

  const goBack = () => {
    if (stage === 'password') { setStage('verify'); setPassword(''); setConfirmPassword(''); return; }
    if (stage === 'verify') { setStage('details'); setCode(''); setChallengeId(''); return; }
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Pressable onPress={goBack} style={styles.backButton} hitSlop={8}>
            <Text style={styles.backIcon}>‹</Text><Text style={styles.backText}>Back</Text>
          </Pressable>

          <View style={styles.brand}><SagawaFlowerLogo width={58} height={58} /><Text style={styles.brandName}>Sagawa</Text></View>
          <View style={styles.card}>
            {stage === 'details' && <>
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.subtitle}>Tell us a little about you, then verify your contact.</Text>

              <Field label="Name"><TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#98A2B3" autoCapitalize="words" maxLength={100} style={styles.input} /></Field>

              <Text style={styles.label}>Date of birth</Text>
              <Pressable onPress={()=>setPicker('date')} style={styles.select}>
                <Text style={[styles.selectText,!dob&&styles.placeholder]}>{dob ? `${birthDay.padStart(2,'0')}/${birthMonth.padStart(2,'0')}/${birthYear}` : 'Choose date of birth'}</Text>
                <Ionicons name="calendar-outline" size={20} color="#667085" />
              </Pressable>
              <Text style={styles.help}>You must be 18 or older.</Text>

              <SelectField label="Country" value={countryLabel(country)} onPress={()=>setPicker('country')} />
              <SelectField label="State / Province" value={region || 'Choose state / province'} onPress={()=>setPicker('region')} />
              <Field label="City"><TextInput value={city} onChangeText={setCity} editable={country !== 'SG'} placeholder="Your city" placeholderTextColor="#98A2B3" maxLength={100} style={styles.input} /></Field>

              <View style={styles.segment}>
                {(['email','phone'] as Channel[]).map(item=><Pressable key={item} onPress={()=>{setChannel(item);setIdentifier('');}} style={[styles.segmentButton,channel===item&&styles.segmentActive]}><Text style={[styles.segmentText,channel===item&&styles.segmentTextActive]}>{item==='email'?'Email':'Phone'}</Text></Pressable>)}
              </View>
              <Field label={channel==='email'?'Email':'Phone number'}>
                {channel==='email'
                  ? <TextInput value={identifier} onChangeText={setIdentifier} placeholder="you@example.com" placeholderTextColor="#98A2B3" keyboardType="email-address" autoCapitalize="none" style={styles.input} />
                  : <View style={styles.phoneWrap}>
                      <View style={styles.phoneCode}><Text style={styles.phoneCodeText}>{PHONE_CODES[country]}</Text></View>
                      <TextInput value={identifier} onChangeText={v=>setIdentifier(v.replace(/\D/g,''))} placeholder="Phone number" placeholderTextColor="#98A2B3" keyboardType="phone-pad" maxLength={11} style={styles.phoneInput} />
                    </View>}
              </Field>

              <Pressable onPress={()=>setAgree(v=>!v)} style={styles.termsRow}><View style={[styles.checkbox,agree&&styles.checkboxActive]}>{agree&&<Text style={styles.check}>✓</Text>}</View><Text style={styles.terms}>I agree to the Terms and Privacy Policy.</Text></Pressable>
              <PrimaryButton label={submitting?'Sending code...':'Continue'} disabled={submitting} onPress={requestVerification} />
            </>}

            {stage === 'verify' && <View style={styles.center}>
              <View style={styles.icon}><Ionicons name={channel==='email'?'mail-outline':'phone-portrait-outline'} size={25} color="#1677D2" /></View>
              <Text style={styles.verifyTitle}>{channel==='email'?'Check your email':'Check your phone'}</Text>
              <Text style={styles.verifyText}>Enter the 6-digit code sent to</Text>
              <Text style={styles.destination}>{identifierHint||identifier}</Text>
              <TextInput value={code} onChangeText={v=>setCode(v.replace(/\D/g,'').slice(0,6))} placeholder="000000" keyboardType="number-pad" maxLength={6} autoFocus style={styles.codeInput} />
              <PrimaryButton label={submitting?'Verifying...':'Verify'} disabled={submitting||code.length!==6} onPress={verifyCode} />
              <Pressable onPress={requestVerification} disabled={submitting} style={styles.textButton}><Text style={styles.link}>Resend code</Text></Pressable>
            </View>}

            {stage === 'password' && <View>
              <View style={styles.center}><View style={styles.icon}><Ionicons name="lock-closed-outline" size={24} color="#1677D2" /></View><Text style={styles.verifyTitle}>Create your password</Text><Text style={styles.verifyText}>Your {channel} is verified. Finish creating your Sagawa account.</Text></View>
              <Field label="Password"><View style={styles.passwordWrap}><TextInput value={password} onChangeText={setPassword} secureTextEntry={!showPassword} placeholder="Minimum 6 characters" placeholderTextColor="#98A2B3" style={styles.passwordInput} /><Pressable onPress={()=>setShowPassword(v=>!v)}><Text style={styles.link}>{showPassword?'Hide':'Show'}</Text></Pressable></View></Field>
              <Field label="Confirm password"><TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} placeholder="Enter password again" placeholderTextColor="#98A2B3" style={[styles.input,password&&confirmPassword&&password!==confirmPassword&&styles.inputError]} /></Field>
              {password&&confirmPassword&&password!==confirmPassword?<Text style={styles.error}>Passwords do not match.</Text>:null}
              <PrimaryButton label={submitting?'Creating account...':'Create account'} disabled={submitting||!password||password!==confirmPassword} onPress={createAccount} />
            </View>}

            {stage==='details'&&<View style={styles.loginRow}><Text style={styles.loginText}>Already have an account?</Text><Pressable onPress={()=>router.replace('/login')}><Text style={styles.link}> Log in</Text></Pressable></View>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={picker!==null} transparent animationType="fade" onRequestClose={()=>setPicker(null)}>
        <Pressable style={styles.overlay} onPress={()=>setPicker(null)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{picker==='country'?'Choose country':picker==='region'?'Choose state / province':'Choose date of birth'}</Text>
            {picker==='date' ? <DateChooser year={birthYear} month={birthMonth} day={birthDay} onChange={(y,m,d)=>{setBirthYear(y);setBirthMonth(m);setBirthDay(d);}} onDone={()=>setPicker(null)} /> :
            <ScrollView style={{maxHeight:420}}>
              {(picker==='country'?SIGNUP_COUNTRIES:regions.map(label=>({code:label,label}))).map((item:any)=><Pressable key={item.code} onPress={()=>picker==='country'?selectCountry(item.code):(()=>{setRegion(item.label);setPicker(null);})()} style={styles.option}><Text style={styles.optionText}>{item.label}</Text><Ionicons name="chevron-forward" size={17} color="#98A2B3" /></Pressable>)}
            </ScrollView>}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function DateChooser({year,month,day,onChange,onDone}:{year:string;month:string;day:string;onChange:(y:string,m:string,d:string)=>void;onDone:()=>void}) {
  const now=new Date();
  const selectedYear=Number(year)||now.getFullYear()-18;
  const selectedMonth=Number(month)||1;
  const selectedDay=Number(day)||1;
  const maxYear=now.getFullYear()-18;
  const minYear=maxYear-102;
  const daysInMonth=new Date(selectedYear,selectedMonth,0).getDate();
  const set=(y:number,m:number,d:number)=>onChange(String(y),String(m),String(Math.min(d,new Date(y,m,0).getDate())));
  return <View>
    <View style={styles.datePickerRow}>
      <View style={styles.dateColumn}><Text style={styles.dateCaption}>Day</Text><ScrollView style={styles.dateScroll}>{Array.from({length:daysInMonth},(_,i)=>i+1).map(v=><Pressable key={v} onPress={()=>set(selectedYear,selectedMonth,v)} style={[styles.dateOption,v===selectedDay&&styles.dateOptionActive]}><Text style={v===selectedDay?styles.dateOptionTextActive:styles.dateOptionText}>{v}</Text></Pressable>)}</ScrollView></View>
      <View style={styles.dateColumn}><Text style={styles.dateCaption}>Month</Text><ScrollView style={styles.dateScroll}>{Array.from({length:12},(_,i)=>i+1).map(v=><Pressable key={v} onPress={()=>set(selectedYear,v,selectedDay)} style={[styles.dateOption,v===selectedMonth&&styles.dateOptionActive]}><Text style={v===selectedMonth?styles.dateOptionTextActive:styles.dateOptionText}>{v}</Text></Pressable>)}</ScrollView></View>
      <View style={styles.dateColumn}><Text style={styles.dateCaption}>Year</Text><ScrollView style={styles.dateScroll}>{Array.from({length:maxYear-minYear+1},(_,i)=>maxYear-i).map(v=><Pressable key={v} onPress={()=>set(v,selectedMonth,selectedDay)} style={[styles.dateOption,v===selectedYear&&styles.dateOptionActive]}><Text style={v===selectedYear?styles.dateOptionTextActive:styles.dateOptionText}>{v}</Text></Pressable>)}</ScrollView></View>
    </View>
    <Pressable onPress={()=>{if(!year||!month||!day)set(maxYear,1,1);onDone();}} style={styles.primary}><Text style={styles.primaryText}>Done</Text></Pressable>
  </View>;
}

function Field({label,children}:{label:string;children:React.ReactNode}) { return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}</View>; }
function SelectField({label,value,onPress}:{label:string;value:string;onPress:()=>void}) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><Pressable onPress={onPress} style={styles.select}><Text style={styles.selectText}>{value}</Text><Ionicons name="chevron-down" size={18} color="#667085" /></Pressable></View>; }
function PrimaryButton({label,disabled,onPress}:{label:string;disabled:boolean;onPress:()=>void}) { return <Pressable onPress={onPress} disabled={disabled} style={({pressed})=>[styles.primary,pressed&&{opacity:.85},disabled&&styles.disabled]}><Text style={styles.primaryText}>{label}</Text></Pressable>; }

const styles=StyleSheet.create({
  safeArea:{flex:1,backgroundColor:'#F4F9FF'},container:{flexGrow:1,justifyContent:'center',paddingHorizontal:22,paddingVertical:24},
  backButton:{position:'absolute',top:14,left:20,zIndex:2,minHeight:44,flexDirection:'row',alignItems:'center'},backIcon:{fontSize:28,color:'#344054'},backText:{fontSize:14,fontWeight:'600',color:'#475467'},
  brand:{alignItems:'center',marginBottom:12,gap:4},brandName:{fontSize:18,fontWeight:'700',color:'#172033'},
  card:{width:'100%',maxWidth:520,alignSelf:'center',backgroundColor:'#FFF',borderRadius:26,borderWidth:1,borderColor:'#E2ECF6',padding:22,elevation:3},
  title:{fontSize:28,lineHeight:34,fontWeight:BOLD,color:'#101828',letterSpacing:-.7},subtitle:{marginTop:7,marginBottom:18,fontSize:14,lineHeight:21,color:'#667085'},
  field:{marginBottom:14},label:{fontSize:14,fontWeight:'600',color:'#344054',marginBottom:7},input:{height:50,borderWidth:1,borderColor:'#D9E2EC',borderRadius:14,backgroundColor:'#FBFDFF',paddingHorizontal:15,fontSize:16,color:'#101828'},
  help:{fontSize:12,color:'#98A2B3',marginTop:5,marginBottom:14},placeholder:{color:'#98A2B3'},
  datePickerRow:{height:250,flexDirection:'row',gap:8,marginBottom:14},dateColumn:{flex:1},dateCaption:{fontSize:12,fontWeight:'700',color:'#667085',textAlign:'center',marginBottom:6},dateScroll:{borderWidth:1,borderColor:'#E4E7EC',borderRadius:12},dateOption:{height:42,alignItems:'center',justifyContent:'center'},dateOptionActive:{backgroundColor:'#EEF7FF'},dateOptionText:{fontSize:15,color:'#475467'},dateOptionTextActive:{fontSize:15,fontWeight:'700',color:'#1677D2'},
  select:{height:50,borderWidth:1,borderColor:'#D9E2EC',borderRadius:14,backgroundColor:'#FBFDFF',paddingHorizontal:15,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},selectText:{fontSize:16,color:'#101828'},
  phoneWrap:{height:50,borderWidth:1,borderColor:'#D9E2EC',borderRadius:14,backgroundColor:'#FBFDFF',flexDirection:'row',alignItems:'center',overflow:'hidden'},phoneCode:{height:'100%',minWidth:66,paddingHorizontal:15,alignItems:'center',justifyContent:'center',borderRightWidth:1,borderRightColor:'#E4E7EC',backgroundColor:'#F8FAFC'},phoneCodeText:{fontSize:16,fontWeight:'700',color:'#344054'},phoneInput:{flex:1,height:'100%',paddingHorizontal:14,fontSize:16,color:'#101828'},
  segment:{flexDirection:'row',backgroundColor:'#F2F5F9',borderRadius:12,padding:4,marginBottom:14},segmentButton:{flex:1,height:38,borderRadius:9,alignItems:'center',justifyContent:'center'},segmentActive:{backgroundColor:'#FFF'},segmentText:{color:'#667085',fontWeight:'600'},segmentTextActive:{color:'#1677D2'},
  termsRow:{flexDirection:'row',alignItems:'center',marginBottom:18},checkbox:{width:20,height:20,borderRadius:6,borderWidth:1.5,borderColor:'#C8D2DC',alignItems:'center',justifyContent:'center',marginRight:10},checkboxActive:{backgroundColor:'#3195F5',borderColor:'#3195F5'},check:{color:'#FFF',fontWeight:'800'},terms:{flex:1,fontSize:12,color:'#667085'},
  primary:{height:52,borderRadius:14,backgroundColor:'#3195F5',alignItems:'center',justifyContent:'center',marginTop:4},primaryText:{color:'#FFF',fontSize:16,fontWeight:'700'},disabled:{opacity:.5},
  center:{alignItems:'center'},icon:{width:52,height:52,borderRadius:16,alignItems:'center',justifyContent:'center',backgroundColor:'#EEF7FF',marginBottom:16},verifyTitle:{fontSize:24,fontWeight:BOLD,color:'#101828',textAlign:'center'},verifyText:{marginTop:8,fontSize:14,lineHeight:20,color:'#667085',textAlign:'center'},destination:{marginTop:3,marginBottom:20,fontSize:14,fontWeight:'700',color:'#344054'},
  codeInput:{width:'100%',height:58,borderWidth:1.5,borderColor:'#D3DFEA',borderRadius:14,textAlign:'center',fontSize:23,fontWeight:'700',letterSpacing:10,color:'#101828',marginBottom:10},textButton:{padding:14},link:{fontSize:14,fontWeight:'700',color:'#1677D2'},
  passwordWrap:{height:50,borderWidth:1,borderColor:'#D9E2EC',borderRadius:14,backgroundColor:'#FBFDFF',paddingHorizontal:15,flexDirection:'row',alignItems:'center'},passwordInput:{flex:1,fontSize:16,color:'#101828'},inputError:{borderColor:'#D92D20'},error:{fontSize:12,color:'#D92D20',marginTop:-8,marginBottom:12},
  loginRow:{flexDirection:'row',justifyContent:'center',marginTop:18},loginText:{fontSize:14,color:'#667085'},
  overlay:{flex:1,backgroundColor:'rgba(16,24,40,.35)',justifyContent:'flex-end'},sheet:{backgroundColor:'#FFF',borderTopLeftRadius:24,borderTopRightRadius:24,padding:20,paddingBottom:36},sheetTitle:{fontSize:20,fontWeight:'700',color:'#101828',marginBottom:10},option:{minHeight:50,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#F0F2F5'},optionText:{fontSize:16,color:'#344054'},
});
