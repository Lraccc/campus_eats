import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform
} from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config';
import { useAuthentication } from '../../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../../services/authService';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import BottomNavigation from '../../components/BottomNavigation';

const CATEGORIES = [
  'food', 'drinks', 'clothing', 'chicken', 'sisig', 'samgyupsal',
  'burger steak', 'pork', 'bbq', 'street food', 'desserts', 'milk tea',
  'coffee', 'snacks', 'breakfast', 'others'
];

export default function AddItem() {
  const { getAccessToken } = useAuthentication();
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [shopId, setShopId] = useState(null);

  React.useEffect(() => {
    fetchShopId();
  }, []);

  const fetchShopId = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (userId) {
        setShopId(userId);
      }
    } catch (error) {
      console.error("Error fetching shop ID:", error);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const toggleCategory = (category) => {
    setSelectedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const validateForm = () => {
    if (!itemName.trim()) {
      Alert.alert("Input Required", "Please enter an item name");
      return false;
    }

    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      Alert.alert("Input Required", "Please enter a valid price");
      return false;
    }

    if (!quantity || isNaN(parseInt(quantity)) || parseInt(quantity) < 1) {
      Alert.alert("Input Required", "Quantity must be at least 1");
      return false;
    }

    const hasSelectedCategory = Object.values(selectedCategories).some(value => value);
    if (!hasSelectedCategory) {
      Alert.alert("Input Required", "Please select at least one category");
      return false;
    }

    if (!description.trim()) {
      Alert.alert(
        "Important Notice", 
        "You have not set a description. Are you sure you want to continue?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Continue", onPress: () => handleSubmit(true) }
        ]
      );
      return false;
    }

    if (!image) {
      Alert.alert(
        "Important Notice", 
        "You have not set an item image. Are you sure you want to continue?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Continue", onPress: () => handleSubmit(true) }
        ]
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async (skipValidation = false) => {
    if (!skipValidation && !validateForm()) {
      return;
    }

    Alert.alert(
      "Please Confirm",
      "Are you sure you want to add this item?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Add Item", onPress: submitItem }
      ]
    );
  };

  const submitItem = async () => {
    if (!shopId) {
      Alert.alert("Error", "Shop ID not found");
      return;
    }

    setIsLoading(true);

    try {
      let token = await getAccessToken();
      if (!token) {
        token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }

      if (!token) {
        console.error("No token available");
        Alert.alert("Error", "Authentication failed");
        setIsLoading(false);
        return;
      }

      const config = { headers: { Authorization: token } };

      // Prepare categories array
      const categoriesArray = Object.keys(selectedCategories).filter(key => selectedCategories[key]);

      // Create form data
      const formData = new FormData();
      
      // Add item data
      const itemData = {
        name: itemName,
        price: parseFloat(price),
        quantity: parseInt(quantity),
        description: description,
        categories: categoriesArray
      };
      
      formData.append('item', JSON.stringify(itemData));
      formData.append('shopId', shopId);

      // Add image if available
      if (image) {
        const uriParts = image.split('.');
        const fileType = uriParts[uriParts.length - 1];
        
        formData.append('image', {
          uri: Platform.OS === 'ios' ? image.replace('file://', '') : image,
          name: `photo.${fileType}`,
          type: `image/${fileType}`
        });
      }

      // Send request
      const response = await axios.post(
        `${API_URL}/api/items/shop-add-item/${shopId}`, 
        formData,
        {
          headers: {
            ...config.headers,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      Alert.alert(
        "Success", 
        "Item added successfully!",
        [{ text: "OK", onPress: () => router.push('/shop/items') }]
      );
      
      resetForm();
    } catch (error) {
      console.error("Error adding item:", error);
      Alert.alert("Error", "Failed to add item. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setItemName('');
    setPrice('');
    setQuantity('1');
    setDescription('');
    setImage(null);
    setSelectedCategories({});
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#BC4A4D" />
          <Text style={styles.loadingText}>Adding item...</Text>
        </View>
        <BottomNavigation activeTab="AddItems" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.scrollView}>


        <View style={styles.formContainer}>
          {/* Item Name */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Item Name</Text>
            <TextInput
              style={styles.input}
              value={itemName}
              onChangeText={setItemName}
              placeholder="Enter item name"
            />
          </View>

          {/* Price and Quantity */}
          <View style={styles.rowContainer}>
            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Text style={styles.label}>Price</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                placeholder="1"
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter item description"
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Image Upload */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Item Image</Text>
            <TouchableOpacity style={styles.imageUploadContainer} onPress={pickImage}>
              {image ? (
                <Image source={{ uri: image }} style={styles.uploadedImage} />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <MaterialIcons name="file-upload" size={40} color="#BC4A4D" />
                  <Text style={styles.uploadText}>Tap to upload image</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Categories */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Categories</Text>
            <View style={styles.categoriesContainer}>
              {CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryItem,
                    selectedCategories[category] && styles.selectedCategory
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

          {/* Submit Button */}
          <TouchableOpacity 
            style={styles.submitButton}
            onPress={() => handleSubmit()}
          >
            <Text style={styles.submitButtonText}>Add Item</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <BottomNavigation activeTab="AddItems" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
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
    padding: 15,
    backgroundColor: '#FFFFFF',
    margin: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  imageUploadContainer: {
    height: 200,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FAFAFA',
  },
  uploadPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: {
    marginTop: 10,
    color: '#666',
    textAlign: 'center',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryItem: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    margin: 4,
  },
  selectedCategory: {
    backgroundColor: '#BC4A4D',
  },
  categoryText: {
    color: '#333',
    fontSize: 14,
  },
  selectedCategoryText: {
    color: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: '#BC4A4D',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
