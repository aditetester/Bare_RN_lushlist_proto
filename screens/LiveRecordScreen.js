import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
  PermissionsAndroid,
  StatusBar,
  AppState,
  PixelRatio,
  TouchableWithoutFeedback
} from 'react-native';
import RecordScreen from 'react-native-record-screen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { 
  Camera, 
  useCameraDevice, 
  useCameraPermission, 
  useMicrophonePermission 
} from 'react-native-vision-camera';
import KeepAwake from 'react-native-keep-awake';
import { getDownloadFileUrl, stopServer } from '../services/LocalServer';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function LiveRecordScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { downloadId, entryFile, title } = route.params || {};

  // Permissions
  const { hasPermission: cameraHasPermission, requestPermission: requestCameraPermission } = useCameraPermission();
  const { hasPermission: micHasPermission, requestPermission: requestMicPermission } = useMicrophonePermission();

  // Camera Device
  const device = useCameraDevice('front');
  const camera = useRef(null);

  // State
  const [status, setStatus] = useState('idle'); // idle, recording, paused
  const [webUrl, setWebUrl] = useState(null);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [appState, setAppState] = useState(AppState.currentState);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  // const [fullscreenMode, setFullscreenMode] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const timerRef = useRef(null);

  // Initialize Tour
  useEffect(() => {
    let mounted = true;
    console.log('LiveRecordScreen Params:', { downloadId, entryFile, title });
    
    const init = async () => {
      try {
        if (downloadId && entryFile) {
          const url = await getDownloadFileUrl(downloadId, entryFile);
          console.log('Generated Web URL:', url);
          if (mounted) setWebUrl(url);
        } else {
          console.warn('Missing downloadId or entryFile');
        }
      } catch (e) {
        console.error('Failed to init tour:', e);
      }
    };
    init();
    return () => {
      mounted = false;
      stopServer();
    };
  }, [downloadId, entryFile]);

  // Handle Permissions
  useEffect(() => {
    const checkPermissions = async () => {
      if (!cameraHasPermission) await requestCameraPermission();
      if (!micHasPermission) await requestMicPermission();
    };
    checkPermissions();
  }, []);

  // Cleanup when navigating away
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      // Reset state when leaving screen
      setStatus('idle');
      setRecordedVideo(null);
      setRecordingDuration(0);
    });

    return unsubscribe;
  }, [navigation]);

  // Handle Recording Timer
  useEffect(() => {
    if (status === 'recording') {
      KeepAwake.activate();
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      KeepAwake.deactivate();
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      KeepAwake.deactivate();
    };
  }, [status]);

  // Handle App State (Stop recording if backgrounded)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground!
      } else if (appState === 'active' && nextAppState.match(/inactive|background/)) {
        // App has gone to the background!
         if (status === 'recording') {
            stopRecording();
         }
      }
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, [appState, status]);


  const startRecording = async () => {
    try {
      if (!cameraHasPermission || !micHasPermission) {
        Alert.alert('Permissions Required', 'Camera and Audio permissions are needed to record.');
        return;
      }

      console.log('Starting recording...');
      const res = await RecordScreen.startRecording({
        mic: true,
        bitrate: 1024000,
        fps: 30
      }).catch((error) => {
        console.error('Recording error:', error);
        Alert.alert('Recording Failed', error.message || 'Unknown error');
        setStatus('idle');
      });

      console.log('Start recording response:', res);

      if (res === 'STARTED' || res === 'started') {
        setStatus('recording');
        setRecordingDuration(0);
      } else {
        console.warn('Unexpected start recording response:', res);
        // Fallback: If we got a response but it isn't "started", assume it started if no error was thrown
        // However, safest to trust the module. If it returns void/null but doesn't throw, we might assume started?
        // Based on Java code: startPromise!!.resolve("started"); -> it returns "started".
      }
    } catch (e) {
      console.error('Failed to start recording:', e);
      setStatus('idle');
    }
  };

  const stopRecording = async () => {
    try {
      const res = await RecordScreen.stopRecording();
      if (res) {
        console.log('Recording finished:', res);
        const videoUri = res.result.outputURL;
        
        // Navigate immediately to prevent camera session error
        navigation.navigate('RecordingResult', {
          videoUri: videoUri,
          downloadId,
          entryFile,
          title
        });
        
        // Reset state after navigation
        setStatus('idle');
        setRecordedVideo(null);
      }
    } catch (e) {
      console.error('Failed to stop recording:', e);
      Alert.alert('Stop Recording Failed', e.message);
      setStatus('idle');
    }
  };

  const handleSave = () => {
    if (recordedVideo) {
      // Navigate immediately to prevent camera reactivation
      navigation.navigate('RecordingResult', {
        videoUri: recordedVideo.path,
        downloadId,
        entryFile,
        title
      });
      // Reset state after navigation
      setStatus('idle');
      setRecordedVideo(null);
    }
  };

  const handleDiscard = () => {
    setStatus('idle');
    setRecordedVideo(null);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handlePauseResume = async () => {
    if (isPaused) {
      await RecordScreen.resumeRecording();
    } else {
      await RecordScreen.pauseRecording();
    }
    setIsPaused(!isPaused);
  };


  const handleRestart = async () => {
    try {
      await RecordScreen.stopRecording();
      setRecordingDuration(0);
      setIsPaused(false);
      // Start new recording
      const res = await RecordScreen.startRecording({
        mic: audioEnabled,
        bitrate: 1024000,
        fps: 30
      });
      if (res === 'STARTED' || res === 'started') {
        setStatus('recording');
      }
    } catch (e) {
      console.error('Failed to restart recording:', e);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Recording',
      'Are you sure you want to delete this recording?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await RecordScreen.stopRecording();
              setStatus('idle');
              setRecordingDuration(0);
              setIsPaused(false);
            } catch (e) {
              console.error('Failed to delete recording:', e);
            }
          },
        },
      ]
    );
  };

  const handleSaveRecording = async () => {
    await stopRecording();
  };

  const toggleCamera = () => {
    setCameraEnabled(!cameraEnabled);
  };

  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled);
  };

  // const lastTap = useRef(null);
  // const handleDoubleTap = () => {
  //   const now = Date.now();
  //   const DOUBLE_PRESS_DELAY = 300;
    
  //   if (lastTap.current && (now - lastTap.current) < DOUBLE_PRESS_DELAY) {
  //     setFullscreenMode(!fullscreenMode);
  //     lastTap.current = null;
  //   } else {
  //     lastTap.current = now;
  //   }
  // };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      
      {/* Background Tour */}
      {webUrl ? (
          <View style={{ flex: 1 }}>
            <WebView
              source={{ uri: webUrl }}
              style={styles.webview}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              allowFileAccess={true}
              allowsInlineMediaPlayback={true}
            />
          </View>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading Tour...</Text>
        </View>
      )}

      {/* Camera Preview - Only show during recording if enabled */}
      {device && cameraHasPermission && status === 'recording' && cameraEnabled && (
         <View style={[
           styles.cameraContainer, 
           styles.cameraRecording
         ]}>
            <Camera
              ref={camera}
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={true}
              video={true}
              audio={true}
            />
         </View>
      )}
      
      {/* Controls Overlay */}
      <SafeAreaView style={styles.controlsLayer} pointerEvents="box-none">

        {/* Recording Control Panel (Before Recording) */}
        {status === 'idle' && (
          <View style={styles.controlPanel}>
            <TouchableOpacity 
              style={styles.homeButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.homeButtonText}>🏠</Text>
              <Text style={styles.homeButtonLabel}>Back to Dashboard</Text>
            </TouchableOpacity>
            
            <View style={styles.panelContent}>
              {/* <TouchableOpacity 
                style={styles.settingRow}
                onPress={() => setFullscreenMode(true)}
              >
                <Text style={styles.settingIcon}>📺</Text>
                <Text style={styles.settingText}>Full screen</Text>
              </TouchableOpacity> */}
              
              <TouchableOpacity 
                style={styles.settingRow}
                onPress={toggleCamera}
              >
                <Text style={styles.settingIcon}>{cameraEnabled ? '🎥' : '🚫'}</Text>
                <Text style={styles.settingText}>{cameraEnabled ? 'Camera On' : 'No Camera'}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.settingRow}
                onPress={toggleAudio}
              >
                <Text style={styles.settingIcon}>{audioEnabled ? '🎤' : '🔇'}</Text>
                <Text style={styles.settingText}>{audioEnabled ? 'Microphone On' : 'Microphone Off'}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.startRecordingButton}
                onPress={startRecording}
              >
                <Text style={styles.startRecordingText}>Start Recording</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom Recording Controls (During Recording) */}
        {status === 'recording' && (
          <View style={styles.bottomRecordingBar}>
            <TouchableOpacity 
              style={styles.saveRecordButton}
              onPress={handleSaveRecording}
            >
              <View style={styles.saveRecordIcon} />
            </TouchableOpacity>
            
            <Text style={styles.recordingTimer}>{formatTime(recordingDuration)}</Text>
            
            {/* <TouchableOpacity 
              style={styles.pauseButton}
              onPress={handlePauseResume}
            >
              <Text style={styles.pauseIcon}>{isPaused ? '▶️' : '⏸️'}</Text>
            </TouchableOpacity> */}
            
            <TouchableOpacity 
              style={styles.restartButton}
              onPress={handleRestart}
            >
              <Text style={styles.restartIcon}>↻</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={handleDelete}
            >
              <Text style={styles.deleteIcon}>🗑️</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.cameraToggleButton}
              onPress={toggleCamera}
            >
              <Text style={styles.cameraToggleIcon}>{cameraEnabled ? '🎥' : '📷'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.audioToggleButton}
              onPress={toggleAudio}
            >
              <Text style={styles.audioToggleIcon}>{audioEnabled ? '🎤' : '🔇'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom Controls */}
        {/* <View style={styles.bottomControls}>
          
          {status === 'idle' && (
             <TouchableOpacity style={styles.recordButton} onPress={startRecording}>
               <View style={styles.recordButtonInner} />
             </TouchableOpacity>
          )}

          {status === 'recording' && (
            <View style={styles.recordingControls}>
               <Text style={styles.timerText}>{formatTime(recordingDuration)}</Text>
               <TouchableOpacity style={styles.stopButton} onPress={stopRecording}>
                 <View style={styles.stopButtonIcon} />
               </TouchableOpacity>
            </View>
          )}

          {status === 'review' && (
             <View style={styles.reviewControls}>
               <Text style={styles.reviewTitle}>Preview Booking?</Text>
               <View style={styles.reviewButtons}>
                 <TouchableOpacity style={styles.discardButton} onPress={handleDiscard}>
                   <Text style={styles.buttonText}>Discard</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                   <Text style={styles.buttonText}>Save & View</Text>
                 </TouchableOpacity>
               </View>
             </View>
          )}

        </View> */}
      </SafeAreaView>
      
      {/* Setup Permissions Check display */}
      {(!cameraHasPermission || !micHasPermission) && (
        <View style={styles.permissionOverlay}>
          <Text style={styles.permissionText}>Camera and Microphone access needed</Text>
          <TouchableOpacity 
            style={styles.permissionButton}
            onPress={async () => {
              await requestCameraPermission();
              await requestMicPermission();
            }}
          >
            <Text style={styles.permissionButtonText}>Grant Permissions</Text>
          </TouchableOpacity>
        </View>
      )}

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
    opacity: 1, // Full opacity for tour
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
  },
  cameraContainer: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: '#000',
    borderRadius: 100,
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  cameraIdle: {
    top: 60,
    right: 20,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  cameraRecording: {
    top: 60,
    right: 20,
    width: 180,
    height: 135,
    borderRadius: 12,
    borderColor: '#fff',
    borderWidth: 2,
  },
  controlsLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  controlPanel: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderRadius: 12,
    padding: 8,
    minWidth: 50,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    opacity: 0.8,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
  },
  panelContent: {
    marginTop: 10,
  },
  panelTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  settingIcon: {
    fontSize: 12,
    marginRight: 12,
  },
  settingText: {
    color: '#aaa',
    fontSize: 14,
  },
  startRecordingButton: {
    backgroundColor: '#ff4081',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  startRecordingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    // marginBottom: 2,
  },
  homeButtonText: {
    fontSize: 15,
    marginRight: 8,
  },
  homeButtonLabel: {
    color: '#fff',
    fontSize: 12,
  },
  saveRecordButton: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: '#ff4081',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveRecordIcon: {
    width: 14,
    height: 14,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  pauseButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseIcon: {
    fontSize: 18,
  },
  restartButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restartIcon: {
    fontSize: 22,
    color: '#fff',
  },
  deleteButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIcon: {
    fontSize: 18,
  },
  cameraToggleButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraToggleIcon: {
    fontSize: 18,
  },
  audioToggleButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioToggleIcon: {
    fontSize: 18,
  },
  leftSidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: 'rgba(100, 150, 200, 0.3)',
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  sidebarButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ff4081',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
  },
  sidebarIcon: {
    fontSize: 20,
  },
  sidebarDivider: {
    width: 30,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginVertical: 8,
  },
  bottomRecordingBar: {
  position: 'absolute',
  bottom: 40,
  width: '90%',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  paddingHorizontal: 20,
  paddingVertical: 12,
  borderRadius: 30,
  gap: 10,
},

  recordControlButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordControlIcon: {
    fontSize: 20,
  },
  recordingTimer: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    minWidth: 50,
    textAlign: 'center',
  },
  stopRecordButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ff4081',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopRecordIcon: {
    width: 16,
    height: 16,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  header: {
    padding: 20,
  },
  backButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  bottomControls: {
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ff4081',
  },
  recordingControls: {
    alignItems: 'center',
  },
  timerText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  stopButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButtonIcon: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: '#ff4081',
  },
  reviewControls: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  reviewTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  reviewButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  discardButton: {
    flex: 1,
    padding: 15,
    backgroundColor: '#333',
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
  },
  saveButton: {
    flex: 1,
    padding: 15,
    backgroundColor: '#ff4081',
    borderRadius: 8,
    marginLeft: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  permissionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  permissionText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#ff4081',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  }
});
