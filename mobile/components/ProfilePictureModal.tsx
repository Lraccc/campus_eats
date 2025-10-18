import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    Image,
    Alert,
    ActivityIndicator,
    StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';
import { API_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY, useAuthentication } from '../services/authService';

interface ProfilePictureModalProps {
    visible: boolean;
    onClose: () => void;
    currentProfilePicture?: string | null;
    userId: string;
    onSuccess: (newProfilePictureUrl: string) => void;
}

const ProfilePictureModal: React.FC<ProfilePictureModalProps> = ({
    visible,
    onClose,
    currentProfilePicture,
    userId,
    onSuccess,
}) => {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const { getAccessToken } = useAuthentication();

    const pickImage = async (source: 'camera' | 'gallery') => {
        try {
            let result;

            if (source === 'camera') {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
                    return;
                }
                result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.7,
                });
            } else {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission Denied', 'Gallery permission is required to select photos.');
                    return;
                }
                result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.7,
                });
            }

            if (!result.canceled && result.assets[0]) {
                setSelectedImage(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to pick image. Please try again.');
        }
    };

    const uploadProfilePicture = async () => {
        if (!selectedImage) {
            Alert.alert('No Image Selected', 'Please select an image first.');
            return;
        }

        setUploading(true);

        try {
            // Get authentication token
            let token = await getAccessToken();
            if (!token) {
                token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
            }

            if (!token) {
                Alert.alert('Authentication Error', 'Please log in again.');
                setUploading(false);
                return;
            }

            // Check if file exists
            const fileInfo = await FileSystem.getInfoAsync(selectedImage);
            if (!fileInfo.exists) {
                Alert.alert('Error', 'Image file does not exist');
                setUploading(false);
                return;
            }

            // Create form data
            const formData = new FormData();
            const fileName = selectedImage.split('/').pop() || 'profile.jpg';
            const mimeType = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';

            // @ts-ignore - FormData typing issue in React Native
            formData.append('image', {
                uri: selectedImage,
                name: fileName,
                type: mimeType,
            });

            // Upload to backend
            const response = await axios.post(
                `${API_URL}/api/users/update-profile-picture/${userId}`,
                formData,
                {
                    headers: {
                        Authorization: token,
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            if (response.data && response.data.profilePictureUrl) {
                Alert.alert('Success', 'Profile picture updated successfully!');
                onSuccess(response.data.profilePictureUrl);
                setSelectedImage(null);
                onClose();
            }
        } catch (error: any) {
            console.error('Error uploading profile picture:', error);
            Alert.alert(
                'Upload Failed',
                error?.response?.data?.error || 'Failed to upload profile picture. Please try again.'
            );
        } finally {
            setUploading(false);
        }
    };

    const handleClose = () => {
        setSelectedImage(null);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Update Profile Picture</Text>
                        <TouchableOpacity onPress={handleClose} disabled={uploading}>
                            <Ionicons name="close" size={28} color="#333" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.imagePreviewContainer}>
                        {selectedImage || currentProfilePicture ? (
                            <Image
                                source={{ uri: selectedImage || currentProfilePicture || '' }}
                                style={styles.imagePreview}
                            />
                        ) : (
                            <View style={styles.placeholderContainer}>
                                <Ionicons name="person" size={80} color="#ccc" />
                                <Text style={styles.placeholderText}>No profile picture</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={styles.optionButton}
                            onPress={() => pickImage('camera')}
                            disabled={uploading}
                        >
                            <Ionicons name="camera" size={24} color="#BC4A4D" />
                            <Text style={styles.optionButtonText}>Take Photo</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.optionButton}
                            onPress={() => pickImage('gallery')}
                            disabled={uploading}
                        >
                            <Ionicons name="images" size={24} color="#BC4A4D" />
                            <Text style={styles.optionButtonText}>Choose from Gallery</Text>
                        </TouchableOpacity>
                    </View>

                    {selectedImage && (
                        <TouchableOpacity
                            style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
                            onPress={uploadProfilePicture}
                            disabled={uploading}
                        >
                            {uploading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Ionicons name="cloud-upload" size={20} color="white" />
                                    <Text style={styles.uploadButtonText}>Upload Picture</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={handleClose}
                        disabled={uploading}
                    >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 20,
        width: '90%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    imagePreviewContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    imagePreview: {
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#f0f0f0',
    },
    placeholderContainer: {
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        marginTop: 10,
        color: '#999',
        fontSize: 14,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    optionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        padding: 15,
        borderRadius: 10,
        marginHorizontal: 5,
        borderWidth: 1,
        borderColor: '#BC4A4D',
    },
    optionButtonText: {
        marginLeft: 8,
        color: '#BC4A4D',
        fontWeight: '600',
        fontSize: 12,
    },
    uploadButton: {
        backgroundColor: '#BC4A4D',
        padding: 15,
        borderRadius: 10,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    uploadButtonDisabled: {
        opacity: 0.6,
    },
    uploadButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
        marginLeft: 8,
    },
    cancelButton: {
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#666',
        fontSize: 16,
    },
});

export default ProfilePictureModal;
