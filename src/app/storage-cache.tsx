import React, { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { clearAppCache, formatBytes, getCacheInfo } from '@/services/storage/cache-maintenance';
import { queryClient } from '@/lib/query-client';
import { useAppTheme } from '@/theme/provider';

export default function StorageCacheScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = createStyles(theme.colors);
  const [size, setSize] = useState('—');
  const [lastCleared, setLastCleared] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const info = await getCacheInfo();
    setSize(formatBytes(info.bytes));
    setLastCleared(info.lastClearedAt);
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const clear = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await clearAppCache();
      queryClient.clear();
      await refresh();
      Alert.alert('Cache cleared', `${formatBytes(result.bytesBefore)} of temporary cache was cleared.`);
    } catch {
      Alert.alert('Unable to clear cache', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style={theme.statusBarStyle} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}><Ionicons name="chevron-back" size={28} color={theme.colors.primary} /></Pressable>
        <Text style={styles.headerTitle}>Storage & Cache</Text><View style={styles.spacer}/>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="server-outline" size={29} color="#fff"/></View>
          <View style={{flex:1}}><Text style={styles.title}>Keep storage light</Text><Text style={styles.description}>Temporary cache is cleaned automatically every 14 days.</Text></View>
        </View>

        <View style={styles.card}>
          <View style={styles.statRow}><Text style={styles.statLabel}>Current temporary cache</Text><Text style={styles.statValue}>{size}</Text></View>
          <View style={styles.divider}/>
          <View style={styles.statRow}><Text style={styles.statLabel}>Last cleared</Text><Text style={styles.statValue}>{lastCleared ? new Date(lastCleared).toLocaleDateString() : 'Not yet'}</Text></View>
          <View style={styles.divider}/>
          <Pressable onPress={clear} disabled={busy} style={styles.actionRow}>
            <View style={styles.actionLeft}><Ionicons name="trash-outline" size={20} color="#FF3B30"/><Text style={styles.clearText}>{busy?'Clearing…':'Clear cache now'}</Text></View>
            <Ionicons name="chevron-forward" size={17} color={theme.colors.textMuted}/>
          </Pressable>
        </View>
        <View style={styles.note}><Ionicons name="shield-checkmark-outline" size={19} color={theme.colors.primary}/><Text style={styles.noteText}>Clearing cache does not remove your account, login, profile, preferences, or saved security credentials. News and images will download again only when needed.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles=(c:any)=>StyleSheet.create({
 safeArea:{flex:1,backgroundColor:c.background},header:{height:52,flexDirection:'row',alignItems:'center',paddingHorizontal:12},back:{width:44,height:44,justifyContent:'center'},headerTitle:{flex:1,textAlign:'center',color:c.text,fontSize:17,fontWeight:'600'},spacer:{width:44},content:{padding:18,paddingTop:22,paddingBottom:40},
 hero:{flexDirection:'row',alignItems:'center',gap:16,marginBottom:28},heroIcon:{width:62,height:62,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:c.primary,...Platform.select({android:{elevation:4}})},title:{color:c.text,fontSize:22,fontWeight:'700'},description:{color:c.textMuted,fontSize:13,lineHeight:19,marginTop:3},
 card:{borderRadius:20,overflow:'hidden',backgroundColor:c.surface,borderWidth:StyleSheet.hairlineWidth,borderColor:c.border},statRow:{minHeight:62,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16},statLabel:{color:c.text,fontSize:14,fontWeight:'500'},statValue:{color:c.textMuted,fontSize:13,fontWeight:'600'},divider:{height:StyleSheet.hairlineWidth,marginLeft:16,backgroundColor:c.border},actionRow:{minHeight:62,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16},actionLeft:{flexDirection:'row',alignItems:'center',gap:10},clearText:{color:'#FF3B30',fontSize:15,fontWeight:'600'},note:{flexDirection:'row',gap:10,marginTop:18,padding:14,borderRadius:16,backgroundColor:c.surface},noteText:{flex:1,color:c.textMuted,fontSize:12,lineHeight:18}
});
