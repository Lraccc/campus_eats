import React from 'react'
import { SafeAreaView, StatusBar, View, Text } from 'react-native'
import CartPreview from '../components/CartPreview'
import BottomNavigation from '../components/BottomNavigation'
import { styled } from 'nativewind'

const StyledSafeArea = styled(SafeAreaView)

export default function CartPreviewRoute() {
    return (
        <StyledSafeArea className="flex-1 bg-[#DFD6C5]">
            <StatusBar barStyle="dark-content" backgroundColor="#DFD6C5" />

            {/* Header */}
            <View style={{ backgroundColor: '#FFFFFF', paddingVertical: 14, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#8B4513', textAlign: 'center' }}>
                    <Text style={{ color: '#BC4A4D' }}>Campus</Text>
                    <Text style={{ color: '#DAA520' }}> Eats</Text>
                </Text>
                <Text style={{ fontSize: 13, color: '#8B4513', opacity: 0.75, textAlign: 'center', marginTop: 6 }}>All carts</Text>
            </View>

            {/* Main content */}
            <View style={{ flex: 1, paddingTop: 12 }}>
                <CartPreview />
            </View>

            <BottomNavigation activeTab="Cart" />
        </StyledSafeArea>
    )
}
