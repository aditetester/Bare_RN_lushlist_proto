import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import { WebView } from 'react-native-webview';
import { getDownloadFileUrl } from '../services/LocalServer';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function RecordingResultScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { videoUri, downloadId, entryFile, title } = route.params || {};
  const [webUrl, setWebUrl] = useState(null);

  useEffect(() => {
    const init = async () => {
        if (downloadId && entryFile) {
            const url = await getDownloadFileUrl(downloadId, entryFile);
            setWebUrl(url);
        }
    };
    init();
  }, [downloadId, entryFile]);

  const handleShare = async () => {
    try {
      await Share.share({
        title: `My Tour Recording: ${title}`,
        url: videoUri, // iOS
        message: `Check out my tour recording!`, // Android
      });
    } catch (error) {
      console.error(error.message);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Main Video Playback */}
      <View style={styles.videoContainer}>
        <Video
            source={{ uri: videoUri }}
            style={styles.video}
            resizeMode="contain"
            controls={true}
            muted={false}
            ignoreSilentSwitch="ignore"
        />
      </View>

      {/* Overlay UI */}
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
          <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.navigate('Tabs', { screen: 'Downloads' })} style={styles.homeButton}>
                  <Text style={styles.homeButtonText}>Home</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
                  <Text style={styles.shareButtonText}>Share</Text>
              </TouchableOpacity>
          </View>

          <View style={styles.footer}>
              <Text style={styles.titleText}>{title}</Text>
              <Text style={styles.subtitleText}>Recorded Session</Text>
          </View>
      </SafeAreaView>
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    opacity: 0.3, // Dim background to highlight video
  },
  webviewPlaceholder: {
      flex: 1,
      backgroundColor: '#1a1a1a',
  },
  videoContainer: {
    position: 'absolute',
    top: 0, 
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 5
  },
  video: {
      flex: 1,
  },
  overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'space-between',
      zIndex: 20
  },
  header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: 20,
  },
  homeButton: {
      backgroundColor: '#333',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
  },
  homeButtonText: {
      color: '#fff',
      fontWeight: 'bold',
  },
  shareButton: {
      backgroundColor: '#ff4081',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
  },
  shareButtonText: {
      color: '#fff',
      fontWeight: 'bold',
  },
  footer: {
      padding: 30,
      alignItems: 'center',
  },
  titleText: {
      color: '#fff',
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 5,
  },
  subtitleText: {
      color: '#aaa',
      fontSize: 14,
  }
});
