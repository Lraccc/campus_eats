import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Image,
    Alert,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthentication } from '../../services/authService';

type DayType = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
type DaysState = Record<DayType, boolean>;

const DasherApplication = () => {
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [availableStartTime, setAvailableStartTime] = useState('');
    const [availableEndTime, setAvailableEndTime] = useState('');
    const [GCASHName, setGCASHName] = useState('');
    const [GCASHNumber, setGCASHNumber] = useState('');
    const [days, setDays] = useState<DaysState>({
        MON: false,
        TUE: false,
        WED: false,
        THU: false,
        FRI: false,
        SAT: false,
        SUN: false,
    });

    const { getAccessToken } = useAuthentication();

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant permission to access your photos');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            setUploadedImage(result.assets[0].uri);
            setImageFile(result.assets[0]);
        }
    };

    const handleCategoryChange = (day: DayType) => {
        setDays({
            ...days,
            [day]: !days[day],
        });
    };

    const handleSubmit = async () => {
        const hasCategorySelected = Object.values(days).some(selected => selected);

        if (!hasCategorySelected) {
            Alert.alert('Selection Required', 'Please select at least one day.');
            return;
        }

        if (!uploadedImage) {
            Alert.alert('Image Required', 'Please upload a school ID image.');
            return;
        }

        if (!GCASHNumber.startsWith('9') || GCASHNumber.length !== 10) {
            Alert.alert('Invalid Number', 'Please enter a valid GCASH number.');
            return;
        }

        if (availableStartTime >= availableEndTime) {
            Alert.alert('Invalid Time', 'Available end time must be later than start time.');
            return;
        }

        try {
            const token = await getAccessToken();
            if (!token) {
                Alert.alert('Error', 'Authentication token missing. Please log in again.');
                return;
            }

            const selectedDays = Object.keys(days).filter(day => days[day as DayType]) as DayType[];
            const dasher = {
                daysAvailable: selectedDays,
                availableStartTime,
                availableEndTime,
                gcashName: GCASHName,
                gcashNumber: GCASHNumber
            };

            const formData = new FormData();
            formData.append("dasher", JSON.stringify(dasher));
            
            if (uploadedImage) {
                const imageUri = uploadedImage;
                const imageName = imageUri.split('/').pop() || 'image.jpg';
                const match = /\.(\w+)$/.exec(imageName);
                const imageType = match ? `image/${match[1]}` : 'image/jpeg';
                
                formData.append("image", {
                    uri: imageUri,
                    name: imageName,
                    type: imageType
                } as any);
            }

            const userId = await AsyncStorage.getItem('userId');
            if (userId) {
                formData.append("userId", userId);
            }

            const response = await axios.post(`${API_URL}/api/dashers/apply`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': token
                }
            });

            if (response.status === 200 || response.status === 201) {
                Alert.alert(
                    'Success',
                    'Dasher Application Submitted Successfully',
                    [{ text: 'OK', onPress: () => router.replace('/profile') }]
                );
            }
        } catch (error: any) {
            console.error('Error submitting form:', error);
            Alert.alert(
                'Error',
                error.response?.data || 'Error submitting form. Please try again.'
            );
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Dasher Application</Text>
            </View>

            <View style={styles.content}>
                <Text style={styles.subtitle}>
                    Partner with CampusEats to help drive growth and take your business to the next level.
                </Text>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>GCASH Name</Text>
                        <TextInput
                            style={styles.input}
                            value={GCASHName}
                            onChangeText={setGCASHName}
                            placeholder="Enter your GCASH name"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>GCASH Number</Text>
                        <View style={styles.gcashInputContainer}>
                            <Text style={styles.gcashPrefix}>+63 </Text>
                            <TextInput
                                style={styles.gcashInput}
                                value={GCASHNumber}
                                onChangeText={setGCASHNumber}
                                placeholder="Enter GCASH number"
                                keyboardType="numeric"
                                maxLength={10}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Available Time</Text>
                        <View style={styles.timeContainer}>
                            <View style={styles.timeInput}>
                                <Text style={styles.timeLabel}>Start Time</Text>
                                <TextInput
                                    style={styles.input}
                                    value={availableStartTime}
                                    onChangeText={setAvailableStartTime}
                                    placeholder="HH:MM"
                                />
                            </View>
                            <View style={styles.timeInput}>
                                <Text style={styles.timeLabel}>End Time</Text>
                                <TextInput
                                    style={styles.input}
                                    value={availableEndTime}
                                    onChangeText={setAvailableEndTime}
                                    placeholder="HH:MM"
                                />
                            </View>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>School ID</Text>
                        <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                            {uploadedImage ? (
                                <Image source={{ uri: uploadedImage }} style={styles.uploadedImage} />
                            ) : (
                                <View style={styles.uploadPlaceholder}>
                                    <Ionicons name="cloud-upload-outline" size={32} color="#666" />
                                    <Text style={styles.uploadText}>Upload School ID</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Days Available</Text>
                        <View style={styles.daysContainer}>
                            {(Object.keys(days) as DayType[]).map((day) => (
                                <TouchableOpacity
                                    key={day}
                                    style={[
                                        styles.dayButton,
                                        days[day] && styles.dayButtonSelected
                                    ]}
                                    onPress={() => handleCategoryChange(day)}
                                >
                                    <Text style={[
                                        styles.dayButtonText,
                                        days[day] && styles.dayButtonTextSelected
                                    ]}>
                                        {day}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

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
                        >
                            <Text style={styles.submitButtonText}>Submit</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#DFD6C5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFFAF1',
    },
    backButton: {
        marginRight: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    content: {
        padding: 16,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 24,
        textAlign: 'center',
    },
    form: {
        backgroundColor: '#FFFAF1',
        borderRadius: 8,
        padding: 16,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    gcashInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    gcashPrefix: {
        padding: 12,
        color: '#666',
    },
    gcashInput: {
        flex: 1,
        padding: 12,
    },
    timeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    timeInput: {
        flex: 1,
        marginRight: 8,
    },
    timeLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    uploadButton: {
        borderWidth: 2,
        borderColor: '#ddd',
        borderStyle: 'dashed',
        borderRadius: 8,
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadPlaceholder: {
        alignItems: 'center',
    },
    uploadText: {
        marginTop: 8,
        color: '#666',
    },
    uploadedImage: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
    },
    daysContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -4,
    },
    dayButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#fff',
        margin: 4,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    dayButtonSelected: {
        backgroundColor: '#BC4A4D',
        borderColor: '#BC4A4D',
    },
    dayButtonText: {
        color: '#666',
    },
    dayButtonTextSelected: {
        color: '#fff',
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 24,
    },
    cancelButton: {
        flex: 1,
        padding: 16,
        borderRadius: 8,
        backgroundColor: '#fff',
        marginRight: 8,
        alignItems: 'center',
    },
    submitButton: {
        flex: 1,
        padding: 16,
        borderRadius: 8,
        backgroundColor: '#BC4A4D',
        marginLeft: 8,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#666',
        fontSize: 16,
        fontWeight: 'bold',
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default DasherApplication; 