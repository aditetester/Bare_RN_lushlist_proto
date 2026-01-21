import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import RNFS from 'react-native-fs';

export default function HomeScreen() {
  const navigation = useNavigation();
  const [recordings, setRecordings] = useState([]);

  // Load recordings when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      loadRecordings();
    }, [])
  );

  const loadRecordings = async () => {
    try {
      const recordingsPath = '/storage/emulated/0/Android/data/com.lushlist.proto/files/ReactNativeRecordScreen';
      
      // Check if directory exists
      const exists = await RNFS.exists(recordingsPath);
      if (!exists) {
        setRecordings([]);
        return;
      }

      // Read all files in the directory
      const files = await RNFS.readDir(recordingsPath);
      
      // Filter for video files and sort by date (newest first)
      const videoFiles = files
        .filter(file => file.name.endsWith('.mp4'))
        .sort((a, b) => b.mtime - a.mtime)
        .map(file => ({
          path: file.path,
          name: file.name,
          size: file.size,
          date: new Date(file.mtime),
        }));

      setRecordings(videoFiles);
    } catch (error) {
      console.error('Failed to load recordings:', error);
      setRecordings([]);
    }
  };

  const handlePlayRecording = (recording) => {
    navigation.navigate('RecordingResult', {
      videoUri: recording.path,
      title: 'Recorded Video',
    });
  };

  const handleDeleteRecording = (recording) => {
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
              await RNFS.unlink(recording.path);
              loadRecordings();
            } catch (error) {
              console.error('Failed to delete recording:', error);
              Alert.alert('Error', 'Failed to delete recording');
            }
          },
        },
      ]
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Recordings</Text>
          <Text style={styles.headerSubtitle}>Your live tour recordings</Text>
        </View>
      </View>

      {/* Empty State */}
      {recordings.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎥</Text>
          <Text style={styles.emptyTitle}>No Recordings</Text>
          <Text style={styles.emptyText}>Record a tour to see it here</Text>
        </View>
      )}

      {/* Recordings List */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {recordings.map((recording, index) => (
          <TouchableOpacity
            key={recording.path}
            style={styles.recordingCard}
            onPress={() => handlePlayRecording(recording)}
          >
            {/* Thumbnail Placeholder */}
            <View style={styles.thumbnailContainer}>
              <View style={styles.thumbnail}>
                <Text style={styles.playIcon}>▶</Text>
              </View>
            </View>

            {/* Content */}
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                Recording {recordings.length - index}
              </Text>
              <Text style={styles.cardInfo}>
                {formatFileSize(recording.size)} • {formatDate(recording.date)}
              </Text>
            </View>

            {/* Delete Button */}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteRecording(recording)}
            >
              <Text style={styles.deleteButtonText}>×</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#aaaaaa',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#555',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  recordingCard: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    alignItems: 'center',
  },
  thumbnailContainer: {
    width: 100,
    height: 100,
  },
  thumbnail: {
    width: 100,
    height: 100,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 32,
    color: '#ff4081',
  },
  cardContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  cardInfo: {
    fontSize: 12,
    color: '#aaaaaa',
  },
  deleteButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deleteButtonText: {
    fontSize: 28,
    color: '#ff4081',
    fontWeight: '300',
  },
});
