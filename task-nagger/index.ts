import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import App from './App';
import { widgetTaskHandler } from './src/widget/handler';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
registerRootComponent(App);

// home-screen widget (Android)
if (Platform.OS === 'android') registerWidgetTaskHandler(widgetTaskHandler);
