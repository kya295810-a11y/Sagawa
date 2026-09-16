import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { getMediaUrl } from '@/utils/media';
import { useAppTheme } from '@/theme/provider';

export type MediaViewerType = 'image' | 'video';

type MediaViewerProps = {
  visible: boolean;
  type: MediaViewerType;
  source?: string | null;
  title?: string;
  onClose: () => void;
};

function resolveMediaUrl(source?: string | null) {
  const url = getMediaUrl(source);

  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function MediaViewer({ visible, type, source, title, onClose }: MediaViewerProps) {
  const { theme } = useAppTheme();
  const styles = createStyles(theme.colors);
  const mediaUrl = resolveMediaUrl(source);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton} accessibilityLabel="Close media viewer">
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
          {!!title && <Text style={styles.title} numberOfLines={1}>{title}</Text>}
          <View style={styles.headerSpacer} />
        </View>

        {!mediaUrl ? (
          <ViewerMessage styles={styles} icon="alert-circle-outline" text="This media is unavailable." />
        ) : type === 'image' ? (
          <ImageViewer url={mediaUrl} styles={styles} />
        ) : (
          <VideoViewer key={mediaUrl} url={mediaUrl} styles={styles} />
        )}
      </View>
    </Modal>
  );
}

function ImageViewer({ url, styles }: { url: string; styles: ReturnType<typeof createStyles> }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <ViewerMessage styles={styles} icon="image-outline" text="Unable to load this image." />;
  }

  return (
    <View style={styles.mediaArea}>
      <ScrollView
        style={styles.imageScroll}
        contentContainerStyle={styles.imageContent}
        maximumZoomScale={4}
        minimumZoomScale={1}
        centerContent
        bouncesZoom
      >
        <Image
          source={{ uri: url }}
          style={styles.fullImage}
          resizeMode="contain"
          onLoadStart={() => setLoading(true)}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
        />
      </ScrollView>
      {loading && <ActivityIndicator size="large" color="#FFFFFF" style={styles.loading} />}
    </View>
  );
}

function VideoViewer({ url, styles }: { url: string; styles: ReturnType<typeof createStyles> }) {
  return <ViewerMessage
    styles={styles}
    icon="videocam-off-outline"
    text="Video playback is unavailable in this app build."
    detail={url}
  />;
}

function ViewerMessage({
  styles,
  icon,
  text,
  detail,
}: {
  styles: ReturnType<typeof createStyles>;
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  detail?: string;
}) {
  return (
    <View style={styles.message}>
      <Ionicons name={icon} size={42} color="#A7B0C0" />
      <Text style={styles.messageText}>{text}</Text>
      {!!detail && <Text style={styles.messageDetail} numberOfLines={2}>{detail}</Text>}
    </View>
  );
}

const createStyles = (colors: { text: string }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05070B' },
  header: { height: 72, paddingHorizontal: 20, paddingTop: 18, flexDirection: 'row', alignItems: 'center' },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center', marginHorizontal: 12 },
  headerSpacer: { width: 40 },
  mediaArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageScroll: { flex: 1, width: '100%' },
  imageContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  fullImage: { width: 390, height: 600, maxWidth: '100%' },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000000' },
  loading: { position: 'absolute' },
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  messageText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', textAlign: 'center', marginTop: 14 },
  messageDetail: { color: '#A7B0C0', fontSize: 13, textAlign: 'center', marginTop: 8 },
});