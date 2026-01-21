import React, { useState, useRef } from 'react';
import { StatusBar } from 'react-native';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  downloadFile,
  extractZip,
  findEntryFile,
  getDownloadFileUrl,
  downloadExists,
  deleteDownload,
} from '../services/LocalServer';

export default function DownloadsScreen() {
  const navigation = useNavigation();
  const [modalVisible, setModalVisible] = useState(false);
  const [downloads, setDownloads] = useState([
    {
      id: 'static-patina-maldives',
      imageUrl: 'https://www.dropbox.com/scl/fi/5toaj8fdfhws76m3m169j/DJI_0399.jpg?rlkey=7bqwf8kolcs3arx8osrrw4b6b&st=bibrgpit&dl=1',
      title: 'Patina Maldives',
      description: 'Experience the stunning beauty of Patina Maldives in this immersive 360° tour.',
      downloadUrl: 'https://pub-bf6c0cea15654fe9899ee509ab1786b8.r2.dev/PatinaMaldivesv2.zip',
      status: 'pending', // Change to pending initially
      entryFile: null,   // Let the check find it
      imageError: false,
    }
  ]);
  const [downloadProgress, setDownloadProgress] = useState({});

  const [formData, setFormData] = useState({
    imageUrl: '',
    downloadUrl: '',
    title: '',
    description: '',
  });

  const slideAnim = useRef(new Animated.Value(0)).current;

  // Check if downloads exist on mount
  // React.useEffect(() => {
  //   const checkExistingDownloads = async () => {
  //     console.log('DEBUG: Checking existing downloads...');
  //     const updatedDownloads = await Promise.all(
  //       downloads.map(async (item) => {
  //         const exists = await downloadExists(item.id);
  //         console.log(`DEBUG: Checking ${item.id}, exists: ${exists}`);
          
  //         if (exists) {
  //           const entryFile = await findEntryFile(item.id);
  //           if (entryFile) {
  //             console.log(`DEBUG: Found entry file for ${item.id}: ${entryFile}`);
  //             return { ...item, status: 'ready', entryFile };
  //           }
  //         }
          
  //         return { ...item, status: 'pending', entryFile: null };
  //       })
  //     );
  //     setDownloads(updatedDownloads);
  //   };
  //   checkExistingDownloads();
  // }, []);

  const openModal = () => {
    setModalVisible(true);
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      setFormData({ imageUrl: '', downloadUrl: '', title: '', description: '' });
    });
  };

  const handleAdd = () => {
    if (!formData.imageUrl || !formData.downloadUrl) {
      Alert.alert('Missing Fields', 'Please provide both Image URL and Download URL');
      return;
    }

    const newDownload = {
      id: Date.now().toString(),
      imageUrl: formData.imageUrl.trim(),
      title: formData.title || 'Untitled',
      description: formData.description || '',
      downloadUrl: formData.downloadUrl,
      status: 'pending', // pending, downloading, extracting, ready, error
      entryFile: null,
      imageError: false,
    };

    setDownloads([...downloads, newDownload]);
    closeModal();
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDownload = async (item) => {
    try {
      console.log('RAW downloadUrl:', JSON.stringify(item.downloadUrl));
      // Update status to downloading
      setDownloads(prev => prev.map(d =>
        d.id === item.id ? { ...d, status: 'downloading' } : d
      ));
      setDownloadProgress(prev => ({ ...prev, [item.id]: { progress: 0, phase: 'Downloading...' } }));

      // Download the ZIP file
      const zipPath = await downloadFile(
        item.downloadUrl,
        item.id,
        (progress, downloaded, total) => {
          setDownloadProgress(prev => ({
            ...prev,
            [item.id]: {
              progress: progress * 0.7, // 70% for download
              phase: `Downloading... ${formatBytes(downloaded)} / ${formatBytes(total)}`,
            }
          }));
        }
      );

      // Update status to extracting
      setDownloads(prev => prev.map(d =>
        d.id === item.id ? { ...d, status: 'extracting' } : d
      ));
      setDownloadProgress(prev => ({
        ...prev,
        [item.id]: { progress: 0.7, phase: 'Extracting files...' }
      }));

      // Extract the ZIP file
      await extractZip(
        zipPath,
        item.id,
        (progress, extracted, total) => {
          setDownloadProgress(prev => ({
            ...prev,
            [item.id]: {
              progress: 0.7 + (progress * 0.2), // 20% for extraction
              phase: `Extracting... ${extracted}/${total} files`,
            }
          }));
        }
      );

      // Find the entry HTML file
      setDownloadProgress(prev => ({
        ...prev,
        [item.id]: { progress: 0.95, phase: 'Finding entry file...' }
      }));

      const entryFile = await findEntryFile(item.id);

      if (!entryFile) {
        throw new Error('No HTML file found in the downloaded content');
      }

      // Update status to ready
      setDownloads(prev => prev.map(d =>
        d.id === item.id ? { ...d, status: 'ready', entryFile } : d
      ));
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[item.id];
        return newProgress;
      });

      Alert.alert(
        'Download Complete!',
        `${item.title.trim()} is ready to view.\nEntry file: ${entryFile}`,
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Open Now', onPress: () => handleOpen({ ...item, entryFile }) },
        ]
      );
    } catch (error) {
      console.error('Download error:', error);
      setDownloads(prev => prev.map(d =>
        d.id === item.id ? { ...d, status: 'error' } : d
      ));
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[item.id];
        return newProgress;
      });
      Alert.alert('Download Failed', error.message);
    }
  };

  const handleOpen = (item) => {
    if (!item.entryFile) {
      Alert.alert('Download Required', 'Please download this tour first before viewing.');
      return;
    }
    
    Alert.alert(
      'View Mode',
      'Choose how you want to view this tour',
      [
        {
          text: 'Virtual Tour',
          onPress: () => navigation.navigate('WebView', {
            title: item.title,
            downloadId: item.id,
            entryFile: item.entryFile,
          }),
        },
        {
          text: 'Live Record',
          onPress: () => navigation.navigate('LiveRecord', {
            title: item.title,
            downloadId: item.id,
            entryFile: item.entryFile,
          }),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleRemove = async (id) => {
    Alert.alert(
      'Remove Download',
      'This will remove the item and delete all downloaded files. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDownload(id);
              setDownloads(downloads.filter(item => item.id !== id));
            } catch (error) {
              console.error('Failed to remove:', error);
            }
          },
        },
      ]
    );
  };

  const handleImageError = (id) => {
    setDownloads(prev => prev.map(d => 
      d.id === id ? { ...d, imageError: true } : d
    ));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ready': return '#4caf50';
      case 'downloading':
      case 'extracting': return '#ff9800';
      case 'error': return '#f44336';
      default: return '#666';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'ready': return 'Ready';
      case 'downloading': return 'Downloading';
      case 'extracting': return 'Extracting';
      case 'error': return 'Error';
      default: return 'Not Downloaded';
    }
  };

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Downloads</Text>
          <Text style={styles.headerSubtitle}>Manage your 360° tours</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openModal}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Empty State */}
      {downloads.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>↓</Text>
          <Text style={styles.emptyTitle}>No Downloads</Text>
          <Text style={styles.emptyText}>Tap the + button to add a 360° tour</Text>
        </View>
      )}

      {/* Downloads List */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {downloads.map((item) => (
          <View key={item.id} style={styles.downloadCard}>
            {/* Thumbnail */}
            <View style={styles.thumbnailContainer}>
              {item.imageError ? (
                <View style={[styles.thumbnail, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#333' }]}>
                   <Text style={{color: '#888', fontSize: 10, textAlign: 'center'}}>No Image</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                  onError={() => handleImageError(item.id)}
                />
              )}
              {/* Status Badge */}
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
              </View>
              {/* Remove Button */}
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemove(item.id)}
              >
                <Text style={styles.removeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>

              {/* Progress Bar */}
              {downloadProgress[item.id] && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${downloadProgress[item.id].progress * 100}%` }
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>{downloadProgress[item.id].phase}</Text>
                </View>
              )}

              {/* Actions */}
              {item.status === 'ready' && (
                <TouchableOpacity
                  style={styles.openButton}
                  onPress={() => handleOpen(item)}
                >
                  <Text style={styles.openButtonText}>Open Tour</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Download Button */}
            {(item.status === 'pending' || item.status === 'error') && (
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={() => handleDownload(item)}
              >
                <Text style={styles.downloadIcon}>↓</Text>
              </TouchableOpacity>
            )}

            {/* Loading State */}
            {(item.status === 'downloading' || item.status === 'extracting') && (
              <View style={styles.loadingButton}>
                <ActivityIndicator size="small" color="#ffffff" />
              </View>
            )}

            {/* Ready State - Play Button */}
            {item.status === 'ready' && (
              <TouchableOpacity
                style={styles.playButton}
                onPress={() => handleOpen(item)}
              >
                <Text style={styles.playIcon}>▶</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Add Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={closeModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeModal}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
            style={styles.keyboardView}
          >
            <Animated.View
              style={[
                styles.modalContent,
                { transform: [{ translateY }] },
              ]}
            >
              <TouchableOpacity activeOpacity={1}>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={closeModal}
                >
                  <Text style={styles.modalCloseText}>×</Text>
                </TouchableOpacity>

                <Text style={styles.modalTitle}>Add 360° Tour</Text>

                <ScrollView 
                  style={styles.formScroll} 
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ flexGrow: 1 }} 
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.form}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Thumbnail URL *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="https://example.com/thumbnail.jpg"
                        placeholderTextColor="#666"
                        value={formData.imageUrl}
                        onChangeText={(text) => setFormData({ ...formData, imageUrl: text.trim() })}
                        autoCapitalize="none"
                        keyboardType="url"
                      />
                      <Text style={styles.hint}>Small image for preview (JPG/PNG)</Text>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Download URL * (ZIP File)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="https://example.com/tour.zip"
                        placeholderTextColor="#666"
                        value={formData.downloadUrl}
                        onChangeText={(text) =>
                          setFormData({ ...formData, downloadUrl: text.replace(/\s+/g, '') })
                        }
                        autoCapitalize="none"
                        keyboardType="url"
                      />
                      <Text style={styles.hint}>Direct link to ZIP file containing HTML + assets</Text>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Title</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g., Office Virtual Tour"
                        placeholderTextColor="#666"
                        value={formData.title}
                        onChangeText={(text) => setFormData({ ...formData, title: text })}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Description</Text>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Brief description of the tour..."
                        placeholderTextColor="#666"
                        value={formData.description}
                        onChangeText={(text) => setFormData({ ...formData, description: text })}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                    </View>
                  </View>
                </ScrollView>

                <View style={[styles.modalActions, { paddingBottom: 20 }]} >
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={closeModal}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addModalButton}
                    onPress={handleAdd}
                  >
                    <Text style={styles.addModalButtonText}>Add Tour</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
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
  addButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ff4081',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  addButtonText: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: '300',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyIcon: {
    fontSize: 64,
    color: '#333',
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
  downloadCard: {
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
  },
  thumbnailContainer: {
    position: 'relative',
    width: 100,
  },
  thumbnail: {
    width: 100,
    height: 130,
    backgroundColor: '#333333', // Placeholder color
  },
  statusBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 4,
    alignItems: 'center',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  removeButton: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: -2,
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
  cardDescription: {
    fontSize: 12,
    color: '#aaaaaa',
    lineHeight: 16,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#3a3a3a',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff4081',
  },
  progressText: {
    fontSize: 10,
    color: '#888',
    marginTop: 4,
  },
  openButton: {
    marginTop: 8,
    backgroundColor: '#3a3a3a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  openButtonText: {
    color: '#ff4081',
    fontSize: 12,
    fontWeight: '600',
  },
  downloadButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4caf50',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginRight: 12,
  },
  downloadIcon: {
    fontSize: 22,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  loadingButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ff9800',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginRight: 12,
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ff4081',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginRight: 12,
  },
  playIcon: {
    fontSize: 18,
    color: '#ffffff',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingTop: 10,
    maxHeight: '85%',
    paddingBottom: 30,
    maxHeight: '90%',
  },
  modalCloseButton: {
    alignSelf: 'flex-end',
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalCloseText: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: '300',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
  },
  formScroll: {
    maxHeight: 300,
  },
  form: {
    marginBottom: 10,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 14,
    color: '#ffffff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  hint: {
    fontSize: 11,
    color: '#666',
    marginTop: 6,
  },
  textArea: {
    height: 70,
    paddingTop: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 50,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  addModalButton: {
    flex: 1,
    backgroundColor: '#ff4081',
    borderRadius: 8,
    padding: 16,
    marginLeft: 10,
    alignItems: 'center',
  },
  addModalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
