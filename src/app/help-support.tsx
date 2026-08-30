import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';

import { useAppTheme } from '@/theme/provider';
import { apiRequest } from '@/services/api/client';
import { ApiError } from '@/services/api/errors';
import { ApiResponse, Profile } from '@/types/profile';

export default function HelpSupportScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = createStyles(theme.colors);

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [prefilled, setPrefilled] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (prefilled) {
        return;
      }

      let cancelled = false;

      apiRequest<ApiResponse<Profile>>('/api/profile')
        .then((response) => {
          if (cancelled) {
            return;
          }

          setName((current) => current || response.data.name || '');
          setContact((current) => current || response.data.phoneNumber || '');
          setPrefilled(true);
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }

          if (error instanceof ApiError && error.status === 404) {
            setPrefilled(true);
            return;
          }

          console.error('Help & Support profile prefill error:', error);
          setPrefilled(true);
        });

      return () => {
        cancelled = true;
      };
    }, [prefilled]),
  );

  const submitMessage = async () => {
    if (!message.trim()) {
      Alert.alert('Message Required', 'Please describe how we can help.');
      return;
    }

    try {
      setSubmitting(true);

      await apiRequest<ApiResponse<unknown>>('/api/support', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          contact: contact.trim(),
          message: message.trim(),
        }),
      });

      Alert.alert(
        'Message Sent',
        'Thanks for reaching out. Our team will get back to you soon.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (error) {
      console.error('Help & Support submit error:', error);
      Alert.alert('Send Failed', 'Unable to send your message right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={theme.statusBarStyle} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} allowFontScaling={false}>
          Help & Support
        </Text>
        <View style={styles.headerButton} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.helperText}>
            Send us a message and our team will get back to you as soon as possible.
          </Text>

          <Text style={styles.inputLabel}>Your Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={theme.colors.textMuted}
          />

          <Text style={styles.inputLabel}>Contact Information</Text>
          <TextInput
            value={contact}
            onChangeText={setContact}
            style={styles.input}
            placeholder="Phone number or email"
            placeholderTextColor={theme.colors.textMuted}
          />

          <Text style={styles.inputLabel}>Message</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            style={[styles.input, styles.messageInput]}
            placeholder="How can we help?"
            placeholderTextColor={theme.colors.textMuted}
            multiline
          />

          <Pressable
            onPress={submitMessage}
            disabled={submitting}
            style={[styles.submitButton, submitting && styles.disabledButton]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Send Message</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: {
  background: string;
  surface: string;
  elevated: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primarySoft: string;
}) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1 },
    content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 },
    header: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },
    headerButton: { width: 32, alignItems: 'center', justifyContent: 'center' },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      color: colors.text,
      fontSize: 17,
      fontWeight: '600',
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 20,
    },
    inputLabel: {
      marginBottom: 7,
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    input: {
      minHeight: 52,
      marginBottom: 18,
      paddingHorizontal: 14,
      borderRadius: 14,
      color: colors.text,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: 16,
    },
    messageInput: {
      minHeight: 130,
      paddingTop: 14,
      textAlignVertical: 'top',
    },
    submitButton: {
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: colors.primary,
      marginTop: 6,
    },
    disabledButton: {
      opacity: 0.6,
    },
    submitText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
  });
