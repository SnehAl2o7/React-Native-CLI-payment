import React from 'react';
import {ActivityIndicator, View, StyleSheet, StatusBar} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useAuth} from '../context/AuthContext';
import {AuthStackParamList, MainStackParamList} from '../types';
import {Colors} from '../theme/colors';

// Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ChoosePaymentTypeScreen from '../screens/ChoosePaymentTypeScreen';
import PaymentFormScreen from '../screens/PaymentFormScreen';
import EditPaymentScreen from '../screens/EditPaymentScreen';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

const AuthNavigator = () => (
  <AuthStack.Navigator
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
      contentStyle: {backgroundColor: Colors.background},
    }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="Register" component={RegisterScreen} />
  </AuthStack.Navigator>
);

const MainNavigator = () => (
  <MainStack.Navigator
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
      contentStyle: {backgroundColor: Colors.background},
    }}>
    <MainStack.Screen name="Dashboard" component={DashboardScreen} />
    <MainStack.Screen
      name="ChoosePaymentType"
      component={ChoosePaymentTypeScreen}
    />
    <MainStack.Screen name="PaymentForm" component={PaymentFormScreen} />
    <MainStack.Screen name="EditPayment" component={EditPaymentScreen} />
  </MainStack.Navigator>
);

const AppNavigator: React.FC = () => {
  const {isLoading, isAuthenticated} = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={Colors.background}
        />
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Colors.background}
        translucent={false}
      />
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});

export default AppNavigator;
