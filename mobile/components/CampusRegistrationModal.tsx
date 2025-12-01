import React, { useState, useEffect } from 'react'
import { Modal, Pressable, Text, View, ScrollView, ActivityIndicator } from 'react-native'
import { styled } from 'nativewind'
import { Ionicons } from '@expo/vector-icons'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledPressable = styled(Pressable)
const StyledScrollView = styled(ScrollView)

interface Campus {
  id: string
  name: string
  address: string
  city?: string
  state?: string
  isActive: boolean
}

interface Props {
  visible: boolean
  campuses: Campus[]
  onSelectCampus: (campusId: string) => void
  isLoading?: boolean
  error?: string | null
}

export default function CampusRegistrationModal({ 
  visible, 
  campuses, 
  onSelectCampus, 
  isLoading = false,
  error = null 
}: Props) {
  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(null)

  // Reset selection when modal becomes visible
  useEffect(() => {
    if (visible) {
      setSelectedCampusId(null)
    }
  }, [visible])

  const handleSelectCampus = (campusId: string) => {
    setSelectedCampusId(campusId)
  }

  const handleConfirm = () => {
    if (selectedCampusId) {
      onSelectCampus(selectedCampusId)
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {}} // Prevent closing - user must select
    >
      <StyledView className="flex-1 bg-black/60 justify-end">
        <StyledView className="bg-white rounded-t-3xl shadow-2xl" style={{ height: '85%' }}>
          {/* Header Section */}
          <StyledView className="p-4 border-b border-gray-200">
            <StyledView className="items-center mb-1">
              <StyledView className="w-14 h-14 bg-[#BC4A4D]/10 rounded-full items-center justify-center mb-2">
                <Ionicons name="school" size={28} color="#BC4A4D" />
              </StyledView>
              <StyledText className="text-xl font-bold text-[#8B4513] text-center">
                Select Your School
              </StyledText>
            </StyledView>
            <StyledText className="text-sm text-gray-600 text-center leading-5">
              Choose your school from the list below to continue
            </StyledText>
            <StyledView className="mt-2 bg-[#DAA520]/10 px-4 py-2 rounded-lg">
              <StyledText className="text-xs text-[#8B4513] text-center font-medium">
                📍 Tap on a school to select it
              </StyledText>
            </StyledView>
          </StyledView>

          {/* Content Section */}
          <StyledScrollView 
            className="px-6 py-4" 
            style={{ flex: 1, minHeight: 200 }}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {isLoading ? (
              <StyledView className="py-10 items-center">
                <ActivityIndicator size="large" color="#BC4A4D" />
                <StyledText className="text-gray-500 mt-4">Loading campuses...</StyledText>
              </StyledView>
            ) : error ? (
              <StyledView className="py-10 items-center">
                <Ionicons name="alert-circle" size={48} color="#DC2626" />
                <StyledText className="text-red-600 mt-4 text-center">{error}</StyledText>
              </StyledView>
            ) : campuses.length === 0 ? (
              <StyledView className="py-10 items-center">
                <Ionicons name="sad-outline" size={48} color="#9CA3AF" />
                <StyledText className="text-gray-500 mt-4 text-center">
                  No schools available at the moment
                </StyledText>
              </StyledView>
            ) : (
              <>
                <StyledText className="text-xs text-gray-500 mb-2 uppercase tracking-wide font-semibold">
                  Select Your School ({campuses.filter(c => c.isActive).length})
                </StyledText>
                <StyledView>
                  {campuses
                    .filter(campus => campus.isActive)
                    .map((campus, index) => (
                      <StyledPressable
                        key={campus.id}
                        className={`p-3 rounded-xl border-2 mb-3 ${
                          selectedCampusId === campus.id
                            ? 'bg-[#BC4A4D]/10 border-[#BC4A4D]'
                            : 'bg-white border-gray-200'
                        }`}
                        onPress={() => handleSelectCampus(campus.id)}
                        style={{
                          shadowColor: selectedCampusId === campus.id ? '#BC4A4D' : '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: selectedCampusId === campus.id ? 0.2 : 0.05,
                          shadowRadius: 4,
                          elevation: selectedCampusId === campus.id ? 4 : 1,
                        }}
                      >
                        <StyledView className="flex-row items-center justify-between">
                          <StyledView className="flex-row items-center flex-1 mr-2">
                            {/* School Icon */}
                            <StyledView 
                              className={`w-9 h-9 rounded-full items-center justify-center mr-2 ${
                                selectedCampusId === campus.id ? 'bg-[#BC4A4D]' : 'bg-gray-100'
                              }`}
                            >
                              <Ionicons 
                                name="school-outline" 
                                size={18} 
                                color={selectedCampusId === campus.id ? 'white' : '#6B7280'}
                              />
                            </StyledView>
                            
                            <StyledView className="flex-1">
                              <StyledText 
                                className={`text-base font-bold mb-1 ${
                                  selectedCampusId === campus.id ? 'text-[#BC4A4D]' : 'text-[#8B4513]'
                                }`}
                              >
                                {campus.name}
                              </StyledText>
                              <StyledView className="flex-row items-start">
                                <Ionicons 
                                  name="location" 
                                  size={12} 
                                  color={selectedCampusId === campus.id ? '#BC4A4D' : '#6B7280'} 
                                  style={{ marginTop: 2, marginRight: 4 }}
                                />
                                <StyledText 
                                  className={`text-xs flex-1 ${
                                    selectedCampusId === campus.id ? 'text-[#BC4A4D]/80' : 'text-gray-600'
                                  }`}
                                  numberOfLines={2}
                                >
                                  {campus.address}
                                  {campus.city && `, ${campus.city}`}
                                  {campus.state && `, ${campus.state}`}
                                </StyledText>
                              </StyledView>
                            </StyledView>
                          </StyledView>
                          
                          {/* Radio Button Selection Indicator */}
                          <StyledView 
                            className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                              selectedCampusId === campus.id
                                ? 'bg-[#BC4A4D] border-[#BC4A4D]'
                                : 'bg-white border-gray-300'
                            }`}
                          >
                            {selectedCampusId === campus.id && (
                              <Ionicons name="checkmark" size={16} color="white" />
                            )}
                          </StyledView>
                        </StyledView>
                      </StyledPressable>
                    ))}
                </StyledView>
              </>
            )}
          </StyledScrollView>

          {/* Action Section */}
          <StyledView className="p-4 border-t border-gray-200">
            <StyledPressable
              className={`py-3 px-6 rounded-xl ${
                selectedCampusId && !isLoading
                  ? 'bg-[#BC4A4D]'
                  : 'bg-gray-300'
              }`}
              onPress={handleConfirm}
              disabled={!selectedCampusId || isLoading}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: selectedCampusId ? 0.2 : 0,
                shadowRadius: 4,
                elevation: selectedCampusId ? 3 : 0,
              }}
            >
              {isLoading ? (
                <StyledView className="flex-row items-center justify-center">
                  <ActivityIndicator size="small" color="white" />
                  <StyledText className="text-white font-bold text-base ml-2">Processing...</StyledText>
                </StyledView>
              ) : (
                <StyledText className="text-white font-bold text-base text-center">
                  Confirm Selection
                </StyledText>
              )}
            </StyledPressable>
            <StyledText className="text-xs text-gray-500 text-center mt-2">
              You can change your school later in profile settings
            </StyledText>
            {selectedCampusId && (
              <StyledView className="mt-1 flex-row items-center justify-center">
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                <StyledText className="text-xs text-green-600 ml-1 font-medium">
                  School selected
                </StyledText>
              </StyledView>
            )}
          </StyledView>
        </StyledView>
      </StyledView>
    </Modal>
  )
}
