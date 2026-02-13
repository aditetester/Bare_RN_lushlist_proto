import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'react-native';
import { startServer, stopServer, getDownloadFileUrl } from '../services/LocalServer';


export default function WebViewScreen({ navigation, route }) {
  const { title = 'Web Content', downloadId, entryFile } = route.params || {};

  /**
   *fileUrl is no longer needed
   *The server will generate the URL dynamically. 
  */
  // const fileUrl = getDownloadFileUrl(downloadId, entryFile);

  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [pageTitle, setPageTitle] = useState(title);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState(null);
  const [webUrl, setWebUrl] = useState(null);


  // Stop server when screen unmounts
  useEffect(() => {
  let mounted = true;

  const init = async () => {
    try {
      if (!downloadId || !entryFile) {
        throw new Error('Missing downloadId or entryFile');
      }

      const url = await getDownloadFileUrl(downloadId, entryFile);

      if (mounted) {
        setWebUrl(url);
      }
    } catch (e) {
      console.error('WebView init error:', e);
      setError('Failed to start local server');
    }
  };

  init();

  return () => {
    mounted = false;
    stopServer(); // IMPORTANT
  };
}, [downloadId, entryFile]);



  const handleNavigationStateChange = (navState) => {
    setCanGoBack(navState.canGoBack);
    setCanGoForward(navState.canGoForward);
    setCurrentUrl(navState.url);
    if (navState.title && navState.title !== 'about:blank') {
      setPageTitle(navState.title);
    }
  };

  const goBack = () => {
    if (webViewRef.current && canGoBack) {
      webViewRef.current.goBack();
    }
  };

  const goForward = () => {
    if (webViewRef.current && canGoForward) {
      webViewRef.current.goForward();
    }
  };

  const reload = () => {
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  const close = () => {
    navigation.goBack();
  };

  // Show error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Failed to Load</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => setError(null)}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeErrorButton} onPress={close}>
            <Text style={styles.closeErrorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // No URL provided
  if (!webUrl) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>No Content</Text>
          <Text style={styles.errorText}>No file URL was provided</Text>
          <TouchableOpacity style={styles.closeErrorButton} onPress={close}>
            <Text style={styles.closeErrorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={close}>
          <Text style={styles.closeButtonText}>×</Text>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {pageTitle}
          </Text>
          <Text style={styles.url} numberOfLines={1}>
            {entryFile || 'Local Content'}
          </Text>
        </View>
        <View style={styles.statusIndicator}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Local Server</Text>
        </View>
      </View>

      {/* Progress bar */}
      {loadingProgress > 0 && loadingProgress < 1 && (
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressFill, { width: `${loadingProgress * 100}%` }]} />
        </View>
      )}

      {/* WebView with Android file access enabled */}
      <WebView
        ref={webViewRef}
        source={{ uri: webUrl }}
        style={styles.webview}
        onNavigationStateChange={handleNavigationStateChange}
        onLoadProgress={({ nativeEvent }) => setLoadingProgress(nativeEvent.progress)}
        onLoadStart={() => setLoadingProgress(0)}
        onLoadEnd={() => setLoadingProgress(1)}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
          setError(nativeEvent.description || 'Failed to load content');
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('HTTP error:', nativeEvent);
        }}
        // Essential JavaScript settings
        javaScriptEnabled={true}
        domStorageEnabled={true}
        // Android: Allow loading local files
        allowFileAccess={true}
        // Media settings for 360° tours
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        // Allow fullscreen for videos
        allowsFullscreenVideo={true}
        // Other settings
        startInLoadingState={true}
        originWhitelist={['*']}
        // Enable hardware acceleration for better performance
        androidHardwareAccelerationDisabled={false}
        // Cache settings
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
        renderLoading={() => (
            <View style={styles.webviewLoading}>
              <ActivityIndicator size="large" color="#ff4081" />
              <Text style={styles.loadingText}>Loading 360° Tour...</Text>
            </View>
        )}
      />

      {/* Navigation Bar */}
      <View style={styles.navbar}>
        <TouchableOpacity
          style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}
          onPress={goBack}
          disabled={!canGoBack}
        >
          <Text style={[styles.navButtonText, !canGoBack && styles.navButtonTextDisabled]}>
            ←
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, !canGoForward && styles.navButtonDisabled]}
          onPress={goForward}
          disabled={!canGoForward}
        >
          <Text style={[styles.navButtonText, !canGoForward && styles.navButtonTextDisabled]}>
            →
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={reload}>
          <Text style={styles.navButtonText}>↻</Text>
        </TouchableOpacity>

        <View style={styles.platformInfo}>
          <Text style={styles.platformText}>
            {Platform.OS === 'android' ? 'Android' : 'iOS'} - Local Mode
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff4444',
    marginBottom: 12,
  },
  errorText: {
    color: '#aaaaaa',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#ff4081',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeErrorButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  closeErrorButtonText: {
    color: '#888',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: '300',
  },
  titleContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  url: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3a3a3a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4caf50',
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    color: '#4caf50',
  },
  progressBarContainer: {
    height: 2,
    backgroundColor: '#333',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff4081',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webviewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
    marginTop: 12,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2a2a2a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  navButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    marginRight: 8,
  },
  navButtonDisabled: {
    backgroundColor: '#2a2a2a',
  },
  navButtonText: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: '600',
  },
  navButtonTextDisabled: {
    color: '#555',
  },
  platformInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  platformText: {
    fontSize: 11,
    color: '#666',
  },
});
