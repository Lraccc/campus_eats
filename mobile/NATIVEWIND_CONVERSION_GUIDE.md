# NativeWind Conversion Guide

## Overview
This guide helps you convert all remaining React Native StyleSheet and inline styles to NativeWind classes throughout your mobile app.

## Files Already Converted ✅
- `components/RestrictionModal.tsx`
- `components/NavigationBar.tsx`
- `screens/Dasher/components/DasherCancelModal.tsx`
- `screens/Dasher/components/DasherCompletedModal.tsx`
- `app/_layout.tsx`

## Files Remaining to Convert
Based on the grep search, these files still need conversion:

### Priority 1 - Components with StyleSheet.create
1. `components/LiveStreamBroadcaster.tsx`
2. `components/LiveStreamViewer.tsx`
3. `components/Map/DeliveryMap.tsx`
4. `screens/Shop/ShopHome.tsx`
5. `screens/Dasher/DasherTopup.tsx`
6. `screens/Dasher/DasherReimburse.tsx`
7. `screens/Dasher/components/DasherReimburseModal.tsx`
8. `screens/Dasher/components/DasherNoShowModal.tsx`
9. `screens/Dasher/components/DasherMap.tsx`
10. `screens/Dasher/components/DasherCashoutModal.tsx`

### Priority 2 - Files with Inline Styles
1. `screens/User/ShopDetails.tsx` (has both StyleSheet and many inline styles)
2. `screens/User/ShopApplication.tsx`
3. `screens/User/Profile.tsx`
4. `screens/User/Order.tsx` (partially converted, has remaining inline styles)

## Conversion Steps for Each File

### Step 1: Update Imports
Replace:
```typescript
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
```

With:
```typescript
import { View, Text, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind';

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)
// Add other components as needed
```

### Step 2: Convert JSX Elements
Replace standard components with styled versions and convert style props to className:

**Before:**
```jsx
<View style={styles.container}>
  <Text style={styles.title}>Hello</Text>
  <TouchableOpacity style={[styles.button, styles.primary]}>
    <Text style={styles.buttonText}>Click me</Text>
  </TouchableOpacity>
</View>
```

**After:**
```jsx
<StyledView className="flex-1 bg-white p-4">
  <StyledText className="text-xl font-bold text-gray-800">Hello</StyledText>
  <StyledTouchableOpacity className="bg-blue-600 py-3 px-6 rounded-lg">
    <StyledText className="text-white font-semibold">Click me</StyledText>
  </StyledTouchableOpacity>
</StyledView>
```

### Step 3: Remove StyleSheet.create
Delete the entire `styles` object and `StyleSheet.create` import.

## Common Style Conversions

### Layout & Positioning
- `flex: 1` → `flex-1`
- `flexDirection: 'row'` → `flex-row`
- `justifyContent: 'center'` → `justify-center`
- `alignItems: 'center'` → `items-center`
- `position: 'absolute'` → `absolute`
- `top: 10` → `top-2.5`
- `left: 0` → `left-0`
- `right: 0` → `right-0`
- `bottom: 0` → `bottom-0`

### Spacing
- `margin: 10` → `m-2.5`
- `marginHorizontal: 15` → `mx-4`
- `marginVertical: 20` → `my-5`
- `padding: 16` → `p-4`
- `paddingHorizontal: 12` → `px-3`
- `paddingVertical: 8` → `py-2`

### Colors
- `backgroundColor: '#fff'` → `bg-white`
- `backgroundColor: '#000'` → `bg-black`
- `backgroundColor: '#BC4A4D'` → `bg-red-700`
- `color: '#666'` → `text-gray-600`
- `color: '#000'` → `text-black`

### Typography
- `fontSize: 16` → `text-base`
- `fontSize: 18` → `text-lg`
- `fontSize: 24` → `text-2xl`
- `fontWeight: 'bold'` → `font-bold`
- `fontWeight: '600'` → `font-semibold`
- `textAlign: 'center'` → `text-center`

### Borders & Shapes
- `borderRadius: 8` → `rounded-lg`
- `borderRadius: 20` → `rounded-2xl`
- `borderWidth: 1` → `border`
- `borderColor: '#ddd'` → `border-gray-300`

### Dimensions
- `width: '100%'` → `w-full`
- `width: '50%'` → `w-1/2`
- `height: 40` → `h-10`
- `maxWidth: 400` → `max-w-sm`

## Handling Complex Inline Styles

For complex styles that don't have direct NativeWind equivalents, you can:

1. **Use arbitrary values:**
```jsx
className="w-[90%] h-[300px]"
```

2. **Combine with conditional classes:**
```jsx
className={`p-4 rounded-lg ${isActive ? 'bg-blue-600' : 'bg-gray-300'}`}
```

3. **Keep style prop for very complex styles:**
```jsx
<StyledView 
  className="flex-1 bg-white" 
  style={{ 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  }}
>
```

## Special Cases

### Modal Overlays
```jsx
// Before
style={styles.modalOverlay}
// styles.modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }

// After
className="flex-1 bg-black/50 justify-center items-center"
```

### Shadow Effects
For complex shadows, you may need to keep the style prop:
```jsx
<StyledView 
  className="bg-white rounded-lg p-4"
  style={{
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  }}
>
```

## Testing After Conversion

1. **Visual Testing:** Check that all screens render correctly
2. **Functionality Testing:** Ensure all interactive elements work
3. **APK Build:** Test that the standalone APK builds without conflicts

## File-Specific Notes

### ShopDetails.tsx
- Has extensive inline styles with conditional rendering
- Focus on the `alertStyles` StyleSheet first
- Convert inline styles in the main component gradually

### LiveStreamBroadcaster.tsx
- Large file with complex layouts
- Convert the StyleSheet at the bottom first
- Test streaming functionality after conversion

### Order.tsx
- Already partially converted to NativeWind
- Focus on remaining inline styles
- Keep the existing StyledView, StyledText imports

## Completion Checklist

- [ ] All StyleSheet.create removed
- [ ] All style={styles.xyz} converted to className
- [ ] Most inline styles converted (complex ones can remain)
- [ ] All files import and use styled components
- [ ] App builds and runs correctly
- [ ] APK generation works without conflicts

## Quick Conversion Script Approach

You can also create a simple find-and-replace approach for common patterns:

1. Find: `import.*StyleSheet.*from 'react-native'`
   Replace: `import { styled } from 'nativewind'`

2. Find: `StyleSheet\.create\({[^}]*}\)`
   Replace: (delete these sections)

3. Find: `style={styles\.([^}]*)}`
   Replace: `className="[convert to equivalent NativeWind classes]"`

Remember to test thoroughly after each file conversion to ensure no functionality is broken.