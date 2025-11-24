# Sample Image Placeholder

Since the `sample.jpg` file was missing and causing build errors, I've replaced all references to it with `logo.png` which exists in the assets folder.

## Fixed Files:
- `screens/Dasher/Orders.tsx` - Replaced `sample.jpg` references with `logo.png`

## Alternative Solutions:
If you need a proper placeholder image for shops, you could:

1. **Add a placeholder image**: Create or download a generic food/restaurant placeholder image
2. **Use a default icon**: Replace with an Ionicons icon when no image URL is provided
3. **Hide the image**: Conditionally render the image only when a URL exists

## Current Fallback:
The app now uses `logo.png` as a fallback when shop images are not available. This ensures the app builds and runs without errors.

If you want to add a proper placeholder image:
1. Add your placeholder image to `mobile/assets/images/`
2. Update the fallback references in the code
3. Rebuild the app