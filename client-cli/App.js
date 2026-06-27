import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import PaymentTypeSelectionScreen from './src/screens/PaymentTypeSelectionScreen';
import PaymentFormScreen from './src/screens/PaymentFormScreen';
import EditPaymentFormScreen from './src/screens/EditPaymentFormScreen';

const Stack = createNativeStackNavigator();

function NavigationStack() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null; // The auth context handles displaying nothing or a splash screen while bootstrapping
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#FFFFFF',
        },
        headerTintColor: '#0F172A',
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
      }}
    >
      {!isAuthenticated ? (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ headerShown: false }}
          />
        </>
      ) : (
        <>
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="PaymentTypeSelection"
            component={PaymentTypeSelectionScreen}
            options={{ title: 'Select Type' }}
          />
          <Stack.Screen
            name="PaymentForm"
            component={PaymentFormScreen}
            options={{ title: 'Add Method' }}
          />
          <Stack.Screen
            name="EditPayment"
            component={EditPaymentFormScreen}
            options={{ title: 'Edit Method' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <AuthProvider>
        <NavigationContainer>
          <NavigationStack />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
