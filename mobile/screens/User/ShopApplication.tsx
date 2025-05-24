import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '../../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthentication } from '../../services/authService';
import BottomNavigation from '@/components/BottomNavigation';

interface Category {
  [key: string]: boolean;
}

const ShopApplication = () => {
  const { getAccessToken } = useAuthentication();
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [shopName, setShopName] = useState('');
  const [shopDesc, setShopDesc] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [googleLink, setGoogleLink] = useState('');
  const [shopOpen, setShopOpen] = useState('');
  const [shopClose, setShopClose] = useState('');
  const [GCASHName, setGCASHName] = useState('');
  const [GCASHNumber, setGCASHNumber] = useState('');
  const [acceptGCASH, setAcceptGCASH] = useState(false);
  const [categories, setCategories] = useState<Category>({
    food: false,
    drinks: false,
    clothing: false,
    electronics: false,
    chicken: false,
    sisig: false,
    samgyupsal: false,
    'burger steak': false,
    pork: false,
    bbq: false,
    'street food': false,
    desserts: false,
    'milk tea': false,
    coffee: false,
    snacks: false,
    breakfast: false,
  });
  const [locationLoading, setLocationLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleCategoryToggle = (category: string) => {
    setCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      // Validation checks
      const hasCategorySelected = Object.values(categories).some(selected => selected);
      if (!hasCategorySelected) {
        Alert.alert('Action Needed', 'Please select at least one category.');
        return;
      }

      if (!image) {
        Alert.alert('Action Needed', 'Please upload a shop image.');
        return;
      }

      if (!googleLink) {
        Alert.alert('Action Needed', 'Please provide a valid Google Maps address link.');
        return;
      }

      if (shopOpen >= shopClose) {
        Alert.alert('Invalid Time', 'Shop close time must be later than shop open time.');
        return;
      }

      if (acceptGCASH && (!GCASHNumber.startsWith('9') || GCASHNumber.length !== 10)) {
        Alert.alert('Invalid Number', 'Please provide a valid GCASH Number.');
        return;
      }

      // Get user ID and token
      const userId = await AsyncStorage.getItem('userId');
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem('@CampusEats:AuthToken');
      }

      if (!userId || !token) {
        Alert.alert('Error', 'Authentication required. Please log in again.');
        return;
      }

      // Prepare shop data
      const selectedCategories = Object.keys(categories).filter(category => categories[category]);
      const shop = {
        gcashName: GCASHName,
        gcashNumber: GCASHNumber,
        categories: selectedCategories,
        deliveryFee: 0,
        googleLink,
        address: shopAddress,
        name: shopName,
        desc: shopDesc,
        timeOpen: shopOpen,
        timeClose: shopClose,
        acceptGCASH,
      };

      // Create form data
      const formData = new FormData();
      formData.append('shop', JSON.stringify(shop));
      formData.append('userId', userId);

      // Add image
      const imageUri = image;
      const imageName = imageUri.split('/').pop();
      const match = /\.(\w+)$/.exec(imageName || '');
      const imageType = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('image', {
        uri: imageUri,
        name: imageName,
        type: imageType,
      } as any);

      // Submit application
      const response = await axios.post(`${API_URL}/api/shops/apply`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: token,
        },
      });

      if (response.status === 200 || response.status === 201) {
        Alert.alert(
          'Success',
          'Shop application submitted successfully! Please wait for admin approval.',
          [{ text: 'OK', onPress: () => router.replace('/profile') }]
        );
      }
    } catch (error: any) {
      console.error('Error submitting form:', error);
      Alert.alert(
        'Error',
        error.response?.data || 'Failed to submit shop application. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this feature.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      
      // Open Google Maps with the current location
      const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      await Linking.openURL(url);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get your current location. Please try again.');
    } finally {
      setLocationLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Shop Application</Text>
          <Text style={styles.headerSubtitle}>
            Partner with CampusEats to help drive growth and take your business to the next level.
          </Text>
        </View>

        <View style={styles.formContainer}>
          {/* Shop Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Shop Name</Text>
            <TextInput
              style={styles.input}
              value={shopName}
              onChangeText={setShopName}
              placeholder="Enter shop name"
            />
          </View>

          {/* Shop Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Shop Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={shopDesc}
              onChangeText={setShopDesc}
              placeholder="Enter shop description"
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Shop Address */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Shop Address</Text>
            <TextInput
              style={styles.input}
              value={shopAddress}
              onChangeText={setShopAddress}
              placeholder="Enter shop address"
            />
          </View>

          {/* Location */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location</Text>
            <View style={styles.locationContainer}>
              <TextInput
                style={[styles.input, styles.locationInput]}
                value={googleLink}
                onChangeText={setGoogleLink}
                placeholder="Enter Google Maps link"
              />
              <TouchableOpacity
                style={[styles.locationButton, locationLoading && styles.locationButtonDisabled]}
                onPress={getCurrentLocation}
                disabled={locationLoading}
              >
                {locationLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.locationButtonText}>Pin Location</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* GCASH Section */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Accept GCASH Payment</Text>
            <View style={styles.gcashToggle}>
              <TouchableOpacity
                style={[styles.toggleButton, acceptGCASH && styles.toggleButtonActive]}
                onPress={() => setAcceptGCASH(true)}
              >
                <Text style={[styles.toggleButtonText, acceptGCASH && styles.toggleButtonTextActive]}>
                  Yes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, !acceptGCASH && styles.toggleButtonActive]}
                onPress={() => setAcceptGCASH(false)}
              >
                <Text style={[styles.toggleButtonText, !acceptGCASH && styles.toggleButtonTextActive]}>
                  No
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {acceptGCASH && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>GCASH Name</Text>
                <TextInput
                  style={styles.input}
                  value={GCASHName}
                  onChangeText={setGCASHName}
                  placeholder="Enter GCASH name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>GCASH Number</Text>
                <View style={styles.gcashNumberContainer}>
                  <Text style={styles.gcashPrefix}>+63 </Text>
                  <TextInput
                    style={[styles.input, styles.gcashInput]}
                    value={GCASHNumber}
                    onChangeText={setGCASHNumber}
                    placeholder="Enter GCASH number"
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
              </View>
            </>
          )}

          {/* Operating Hours */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Operating Hours</Text>
            <View style={styles.timeContainer}>
              <View style={styles.timeInputGroup}>
                <Text style={styles.timeLabel}>Open</Text>
                <TextInput
                  style={styles.timeInput}
                  value={shopOpen}
                  onChangeText={setShopOpen}
                  placeholder="00:00"
                />
              </View>
              <View style={styles.timeInputGroup}>
                <Text style={styles.timeLabel}>Close</Text>
                <TextInput
                  style={styles.timeInput}
                  value={shopClose}
                  onChangeText={setShopClose}
                  placeholder="00:00"
                />
              </View>
            </View>
          </View>

          {/* Shop Image */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Shop Logo/Banner</Text>
            <TouchableOpacity style={styles.imageUpload} onPress={pickImage}>
              {image ? (
                <Image source={{ uri: image }} style={styles.uploadedImage} />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Ionicons name="cloud-upload-outline" size={40} color="#666" />
                  <Text style={styles.uploadText}>Tap to upload image</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Categories */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Shop Categories</Text>
            <View style={styles.categoriesContainer}>
              {Object.keys(categories).map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryButton,
                    categories[category] && styles.categoryButtonActive,
                  ]}
                  onPress={() => handleCategoryToggle(category)}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      categories[category] && styles.categoryButtonTextActive,
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Submit Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.back()}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <BottomNavigation activeTab="Profile" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#DFD6C5',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFAF1',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  formContainer: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationInput: {
    flex: 1,
    marginRight: 10,
  },
  locationButton: {
    backgroundColor: '#BC4A4D',
    padding: 12,
    borderRadius: 8,
  },
  locationButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  locationButtonDisabled: {
    opacity: 0.7,
  },
  gcashToggle: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  toggleButton: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#BC4A4D',
  },
  toggleButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
  gcashNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gcashPrefix: {
    fontSize: 16,
    color: '#666',
    marginRight: 8,
  },
  gcashInput: {
    flex: 1,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeInputGroup: {
    flex: 1,
    marginRight: 10,
  },
  timeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  timeInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  imageUpload: {
    height: 200,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  uploadPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: {
    marginTop: 8,
    color: '#666',
    fontSize: 16,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  categoryButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    margin: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryButtonActive: {
    backgroundColor: '#BC4A4D',
    borderColor: '#BC4A4D',
  },
  categoryButtonText: {
    color: '#666',
    fontSize: 14,
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 40,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelButtonText: {
    color: '#666',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#BC4A4D',
    padding: 16,
    borderRadius: 8,
    marginLeft: 10,
  },
  submitButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ShopApplication; 