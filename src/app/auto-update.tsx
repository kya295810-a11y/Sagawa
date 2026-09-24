import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { checkForAppUpdate, openAppStoreUpdate } from '@/services/updates/app-update';
import { useSettingsStore } from '@/store/settings-store';
import { useAppTheme } from '@/theme/provider';

export default function AutoUpdateScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = createStyles(theme.colors, theme.isDark);
  const enabled = useSettingsStore((s) => s.autoUpdateEnabled);
  const setEnabled = useSettingsStore((s) => s.setAutoUpdateEnabled);
  const [checking, setChecking] = useState(false);

  const checkNow = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const result = await checkForAppUpdate(true);
      if (!result?.available) {
        Alert.alert('You are up to date', `Sagawa ${result?.currentVersion ?? ''} is the latest version.`);
      } else {
        Alert.alert(
          'Update available',
          `Sagawa ${result.latestVersion} is available.`,
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Open Store',
              onPress: () => void openAppStoreUpdate(result.storeUrl).catch(() => {
                Alert.alert('Store unavailable', 'The store link is not configured yet.');
              }),
            },
          ],
        );
      }
    } catch {
      Alert.alert('Unable to check', 'Please check your connection and try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style={theme.statusBarStyle} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Auto Update</Text><View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="cloud-download-outline" size={30} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Keep Sagawa current</Text>
            <Text style={styles.description}>Check for new releases automatically without constant polling.</Text>
          </View>
        </View>

        <Text style={styles.label}>UPDATE SETTINGS</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}><Ionicons name="sync-outline" size={21} color={theme.colors.primary} /></View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Automatic update checks</Text>
              <Text style={styles.rowSubtitle}>{enabled ? 'Sagawa checks at most once a day' : 'Automatic checks are off'}</Text>
            </View>
            <Switch value={enabled} onValueChange={setEnabled} thumbColor="#fff" />
          </View>
          <View style={styles.divider} />
          <Pressable onPress={checkNow} disabled={checking} style={styles.actionRow}>
            <Text style={styles.actionText}>{checking ? 'Checking…' : 'Check for update now'}</Text>
            <Ionicons name="chevron-forward" size={17} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={19} color={theme.colors.textMuted} />
          <Text style={styles.noteText}>Native Android/iPhone installation is controlled by Google Play or the App Store. This setting controls Sagawa's own low-frequency update check; store auto-update settings still decide silent installation.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c:any,d:boolean)=>StyleSheet.create({
  safeArea:{flex:1,backgroundColor:c.background},header:{height:52,flexDirection:'row',alignItems:'center',paddingHorizontal:12},back:{width:44,height:44,justifyContent:'center'},headerTitle:{flex:1,textAlign:'center',color:c.text,fontSize:17,fontWeight:'600'},spacer:{width:44},
  content:{padding:18,paddingTop:22,paddingBottom:40},hero:{flexDirection:'row',alignItems:'center',gap:16,marginBottom:30},heroIcon:{width:62,height:62,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:c.primary,...Platform.select({android:{elevation:4}})},title:{color:c.text,fontSize:22,fontWeight:'700'},description:{color:c.textMuted,fontSize:13,lineHeight:19,marginTop:3},
  label:{color:c.textMuted,fontSize:11,fontWeight:'600',letterSpacing:.7,marginLeft:12,marginBottom:8},card:{borderRadius:20,overflow:'hidden',backgroundColor:c.surface,borderWidth:StyleSheet.hairlineWidth,borderColor:c.border},row:{minHeight:82,flexDirection:'row',alignItems:'center',paddingHorizontal:16},rowIcon:{width:38},rowText:{flex:1,paddingRight:12},rowTitle:{color:c.text,fontSize:16,fontWeight:'600'},rowSubtitle:{color:c.textMuted,fontSize:12,lineHeight:17,marginTop:2},divider:{height:StyleSheet.hairlineWidth,marginLeft:16,backgroundColor:c.border},actionRow:{minHeight:58,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16},actionText:{color:c.primary,fontSize:15,fontWeight:'600'},note:{flexDirection:'row',gap:10,marginTop:18,padding:14,borderRadius:16,backgroundColor:d?'#171719':'#F4F6F8'},noteText:{flex:1,color:c.textMuted,fontSize:12,lineHeight:18}
});
