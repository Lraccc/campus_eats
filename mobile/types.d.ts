declare module 'nativewind' {
  import { ComponentType } from 'react';
  
  export function styled<T extends ComponentType<any>>(
    component: T
  ): T & {
    className?: string;
  };
}

declare module '@expo/vector-icons' {
  export const Ionicons: any;
  export const MaterialIcons: any;
  export const FontAwesome: any;
  export const AntDesign: any;
  export const Feather: any;
  export const MaterialCommunityIcons: any;
}

declare module '@react-native-picker/picker' {
  interface PickerItemProps {
    label: string;
    value: string | number;
    color?: string;
    testID?: string;
  }
  
  interface PickerProps {
    selectedValue?: any;
    onValueChange?: (itemValue: any, itemIndex: number) => void;
    style?: any;
    children?: React.ReactNode;
  }
  
  export class Picker extends React.Component<PickerProps> {
    static Item: React.ComponentType<PickerItemProps>;
  }
}