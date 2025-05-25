import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
  Linking
} from 'react-native';
import { router } from 'expo-router';
import axios, { AxiosError } from 'axios';
import { API_URL } from '../../config';
import { useAuthentication } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../services/authService';
import { MaterialIcons, Ionicons, FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import BottomNavigation from '../../components/BottomNavigation';

interface ShopData {
  id: string;
  name: string;
  description?: string;
  desc?: string;
  address: string;
  googleLink?: string;
  imageUrl: string;
  categories: string[];
  deliveryFee?: number;
  acceptGCASH: boolean;
  wallet?: number;
  timeOpen?: string;
  timeClose?: string;
  gcashName?: string;
  gcashNumber?: string;
}

const CATEGORIES = [
  'food', 'drinks', 'clothing', 'chicken', 'sisig', 'samgyupsal',
  'burger steak', 'pork', 'bbq', 'street food', 'desserts', 'milk tea',
  'coffee', 'snacks', 'breakfast', 'others'
];

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  formContainer: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sublabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoIcon: {
    marginLeft: 8,
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
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  timeInput: {
    width: '100%',
  },
  gcashOptions: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  gcashOption: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  selectedGcashOption: {
    backgroundColor: '#BC4A4D',
  },
  gcashOptionText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedGcashOptionText: {
    color: '#FFFFFF',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
  },
  phonePrefix: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  phoneInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  imageUpload: {
    height: 200,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
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
  uploadedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  categoryChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    margin: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  selectedCategoryChip: {
    backgroundColor: '#BC4A4D',
    borderColor: '#BC4A4D',
  },
  categoryText: {
    color: '#666',
    fontSize: 14,
  },
  selectedCategoryText: {
    color: '#FFFFFF',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
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
  submitButton: {
    flex: 1,
    backgroundColor: '#BC4A4D',
    padding: 16,
    borderRadius: 8,
    marginLeft: 10,
  },
  disabledButton: {
    opacity: 0.7,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default function ShopUpdate() {
  const { getAccessToken } = useAuthentication();
  const [shopData, setShopData] = useState<ShopData | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [googleLink, setGoogleLink] = useState('https://maps.app.goo.gl/');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Record<string, boolean>>({
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
    others: false
  });
  const [acceptGCASH, setAcceptGCASH] = useState<boolean | null>(null);
  const [gcashName, setGcashName] = useState('');
  const [gcashNumber, setGcashNumber] = useState('');
  const [shopOpen, setShopOpen] = useState('');
  const [shopClose, setShopClose] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);

  useEffect(() => {
    fetchShopId();
  }, []);

  const fetchShopId = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (userId) {
        setShopId(userId);
        fetchShopData(userId);
      }
    } catch (error) {
      console.error("Error fetching shop ID:", error);
      setIsLoading(false);
    }
  };

  const fetchShopData = async (id: string) => {
    try {
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error("No token available");
        setIsLoading(false);
        return;
      }

      const config = { headers: { Authorization: token } };
      const response = await axios.get(`${API_URL}/api/shops/${id}`, config);
      
      const shop = response.data;
      setShopData(shop);
      
      // Set form fields with shop data
      setName(shop.name || '');
      setDescription(shop.description || shop.desc || '');
      setAddress(shop.address || '');
      setGoogleLink(shop.googleLink || 'https://maps.app.goo.gl/');
      setDeliveryFee(shop.deliveryFee ? shop.deliveryFee.toString() : '0');
      setImage(shop.imageUrl || null);
      setAcceptGCASH(shop.acceptGCASH !== undefined ? shop.acceptGCASH : null);
      setGcashName(shop.gcashName || '');
      setGcashNumber(shop.gcashNumber || '');
      setShopOpen(shop.timeOpen || '');
      setShopClose(shop.timeClose || '');
      
      // Reset categories first
      const initialCategories: Record<string, boolean> = {};
      Object.keys(selectedCategories).forEach((cat: string) => {
        initialCategories[cat] = false;
      });
      
      // Set selected categories
      if (shop.categories && Array.isArray(shop.categories)) {
        shop.categories.forEach((category: string) => {
          initialCategories[category] = true;
        });
      }
      setSelectedCategories(initialCategories);
      
    } catch (error) {
      // Check if error is a 404 and handle silently
      const axiosError = error as AxiosError;
      if (axiosError.response && axiosError.response.status === 404) {
        // Shop not found - this is expected for new users
        console.log("Shop not found for this user - this is normal for new users");
      } else {
        console.error("Error fetching shop data:", error);
      }
      // Silently handle error without showing alert
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert("Permission Required", "You need to allow access to your photos to upload an image.");
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
        // Save the actual file for upload
        setImageFile(result.assets[0]);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      // Silently handle error without showing alert
    }
  };
  
  const openGoogleMapsHelp = () => {
    Linking.openURL('https://support.google.com/maps/answer/9099064?hl=en&co=GENIE.Platform%3DAndroid');
  };

  const getCurrentLocation = async () => {
    try {
      setIsSaving(true); // Reuse the isSaving state to show loading
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
      setIsSaving(false);
    }
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert("Error", "Shop name is required");
      return;
    }

    if (!address.trim()) {
      Alert.alert("Error", "Shop address is required");
      return;
    }

    if (isNaN(parseFloat(deliveryFee)) || parseFloat(deliveryFee) < 0) {
      Alert.alert("Error", "Please enter a valid delivery fee");
      return;
    }

    const categoriesArray = Object.keys(selectedCategories).filter(key => selectedCategories[key]);
    if (categoriesArray.length === 0) {
      Alert.alert("Error", "Please select at least one category");
      return;
    }

    if (!googleLink.startsWith("https://maps.app.goo.gl/")) {
      Alert.alert("Error", "Please provide a valid Google Maps address link.");
      return;
    }

    if (acceptGCASH === null) {
      Alert.alert("Error", "Please select whether you accept GCASH payment.");
      return;
    }

    if (acceptGCASH === true) {
      if (!gcashName.trim()) {
        Alert.alert("Error", "Please provide a GCASH Name.");
        return;
      }
      if (!gcashNumber.startsWith('9') || gcashNumber.length !== 10) {
        Alert.alert("Error", "Please provide a valid GCASH Number.");
        return;
      }
    }

    if (shopOpen && shopClose) {
      if (shopOpen >= shopClose) {
        Alert.alert("Error", "Shop close time must be later than shop open time.");
        return;
      }
    }

    if (!image) {
      Alert.alert("Error", "Please upload a shop image.");
      return;
    }

    if (!description.trim()) {
      Alert.alert("Warning", "You haven't provided a description. Are you sure you want to continue?", [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Continue",
          onPress: () => updateShop()
        }
      ]);
      return;
    }

    updateShop();
  };

  const updateShop = async () => {
    if (!shopId) {
      Alert.alert("Error", "Shop ID not found");
      return;
    }

    setIsSaving(true);

    try {
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error("No token available");
        Alert.alert("Error", "Authentication failed");
        setIsSaving(false);
        return;
      }

      const config = { headers: { Authorization: token } };

      // Prepare categories array
      const categoriesArray = Object.keys(selectedCategories).filter(key => selectedCategories[key]);

      // Create form data
      const formData = new FormData();
      
      // Add shop data
      const shopUpdateData = {
        name,
        desc: description, // Use desc instead of description to match backend
        address,
        googleLink,
        deliveryFee: parseFloat(deliveryFee),
        categories: categoriesArray,
        acceptGCASH,
        timeOpen: shopOpen,
        timeClose: shopClose,
        gcashName: acceptGCASH ? gcashName : '',
        gcashNumber: acceptGCASH ? gcashNumber : ''
      };
      
      formData.append('shop', JSON.stringify(shopUpdateData));
      formData.append('shopId', shopId);

      // Add image if changed
      if (imageFile && image) {
        const uriParts = image.split('.') || [];
        const fileType = uriParts.length > 0 ? uriParts[uriParts.length - 1] : 'jpg';
        
        // Create a properly typed image object for FormData
        const imageObject: any = {
          uri: Platform.OS === 'ios' ? image.replace('file://', '') : image,
          name: `photo.${fileType}`,
          type: `image/${fileType}`
        };
        
        formData.append('image', imageObject);
      }

      // Send request
      const response = await axios.put(
        `${API_URL}/api/shops/shop-update/${shopId}`, // Updated endpoint to match web version
        formData,
        {
          ...config,
          headers: {
            ...config.headers,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      Alert.alert("Success", "Shop updated successfully");
      setTimeout(() => {
        router.push('/profile' as any);
      }, 1000);
    } catch (error) {
      console.error("Error updating shop:", error);
      
      // Provide more specific error messages based on the error type
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        if (axiosError.response.status === 400) {
          Alert.alert("Error", "Invalid shop data. Please check your inputs and try again.");
        } else if (axiosError.response.status === 401) {
          Alert.alert("Error", "Authentication failed. Please log in again.");
        } else if (axiosError.response.status === 413) {
          Alert.alert("Error", "Image file is too large. Please choose a smaller image.");
        } else {
          Alert.alert("Error", "Failed to update shop. Please try again later.");
        }
      } else if (axiosError.request) {
        // The request was made but no response was received
        Alert.alert("Error", "Network error. Please check your internet connection.");
      } else {
        // Something happened in setting up the request that triggered an Error
        Alert.alert("Error", "An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#BC4A4D" />
          <Text style={styles.loadingText}>Loading shop details...</Text>
        </View>
        <BottomNavigation activeTab="Profile" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Update Shop</Text>
          <Text style={styles.headerSubtitle}>
            Update your shop details to keep your customers informed about your business.
          </Text>
        </View>
        <View style={styles.formContainer}>
          {/* Shop Name */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Shop Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter shop name"
            />
          </View>

          {/* Shop Address */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="Enter shop address"
            />
          </View>

          {/* Google Maps Link */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Location</Text>
            <View style={styles.locationContainer}>
              <TextInput
                style={[styles.input, styles.locationInput]}
                value={googleLink}
                onChangeText={setGoogleLink}
                placeholder="Enter Google Maps link"
              />
              <TouchableOpacity
                style={[styles.locationButton, isSaving && styles.locationButtonDisabled]}
                onPress={getCurrentLocation}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.locationButtonText}>Pin Location</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Shop Hours */}
          <View style={styles.rowContainer}>
            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Text style={styles.label}>Opening Time</Text>
              <TouchableOpacity 
                style={styles.timeInput}
                onPress={() => {
                  // On a real device, this would open a time picker
                  // For now, just use a text input
                }}
              >
                <TextInput
                  style={styles.input}
                  value={shopOpen}
                  onChangeText={setShopOpen}
                  placeholder="08:00"
                />
              </TouchableOpacity>
            </View>
            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Text style={styles.label}>Closing Time</Text>
              <TouchableOpacity 
                style={styles.timeInput}
                onPress={() => {
                  // On a real device, this would open a time picker
                  // For now, just use a text input
                }}
              >
                <TextInput
                  style={styles.input}
                  value={shopClose}
                  onChangeText={setShopClose}
                  placeholder="17:00"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Delivery Fee */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Delivery Fee</Text>
            <TextInput
              style={styles.input}
              value={deliveryFee}
              onChangeText={setDeliveryFee}
              placeholder="0.00"
              keyboardType="numeric"
            />
          </View>

          {/* Description */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter shop description"
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Accept GCASH */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Accept GCASH Payment</Text>
            <View style={styles.gcashOptions}>
              <TouchableOpacity
                style={[styles.gcashOption, acceptGCASH === true && styles.selectedGcashOption]}
                onPress={() => setAcceptGCASH(true)}
              >
                <Text style={[styles.gcashOptionText, acceptGCASH === true && styles.selectedGcashOptionText]}>
                  Yes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.gcashOption, acceptGCASH === false && styles.selectedGcashOption]}
                onPress={() => setAcceptGCASH(false)}
              >
                <Text style={[styles.gcashOptionText, acceptGCASH === false && styles.selectedGcashOptionText]}>
                  No
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* GCASH Details - Only show if acceptGCASH is true */}
          {acceptGCASH === true && (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>GCASH Name</Text>
                <TextInput
                  style={styles.input}
                  value={gcashName}
                  onChangeText={setGcashName}
                  placeholder="Enter GCASH name"
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>GCASH Number</Text>
                <View style={styles.phoneInputContainer}>
                  <Text style={styles.phonePrefix}>+63</Text>
                  <TextInput
                    style={styles.phoneInput}
                    value={gcashNumber}
                    onChangeText={setGcashNumber}
                    placeholder="9XXXXXXXXX"
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
              </View>
            </>
          )}

          {/* Image Upload */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Shop Image</Text>
            <TouchableOpacity style={styles.imageUpload} onPress={pickImage}>
              {image ? (
                <Image source={{ uri: image }} style={styles.uploadedImage} />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Ionicons name="cloud-upload-outline" size={40} color="#999" />
                  <Text style={styles.uploadText}>Tap to upload image</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Categories */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Categories</Text>
            <View style={styles.categoriesContainer}>
              {Object.keys(selectedCategories).map(category => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryChip,
                    selectedCategories[category] && styles.selectedCategoryChip
                  ]}
                  onPress={() => toggleCategory(category)}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      selectedCategories[category] && styles.selectedCategoryText
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.cancelButton]} 
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.submitButton, isSaving && styles.disabledButton]} 
              onPress={handleSubmit}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <BottomNavigation activeTab="Profile" />
    </View>
  );
}
