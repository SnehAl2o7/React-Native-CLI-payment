import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';

const PAYMENT_TYPES = [
  { id: 'Bank', label: 'Bank Account', icon: '🏦', desc: 'Indian Bank Account (Account Number, IFSC, etc.)' },
  { id: 'Paytm', label: 'Paytm Wallet', icon: '📱', desc: 'Paytm Wallet registered mobile number' },
  { id: 'UPI', label: 'UPI VPA', icon: '⚡', desc: 'Virtual Payment Address (e.g., username@upi)' },
  { id: 'PayPal', label: 'PayPal', icon: '💳', desc: 'PayPal international account email address' },
  { id: 'USDT', label: 'USDT (TRC20/ERC20)', icon: '₿', desc: 'Tether stablecoin wallet address' },
];

export default function PaymentTypeSelectionScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Payment Method</Text>
          <Text style={styles.subtitle}>Choose a type of payment method to add to your profile</Text>
        </View>

        {PAYMENT_TYPES.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={styles.card}
            onPress={() => navigation.navigate('PaymentForm', { type: type.id })}
            activeOpacity={0.7}
          >
            <Text style={styles.icon}>{type.icon}</Text>
            <View style={styles.content}>
              <Text style={styles.label}>{type.label}</Text>
              <Text style={styles.desc}>{type.desc}</Text>
            </View>
            <Text style={styles.arrow}>➔</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  icon: {
    fontSize: 32,
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  desc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  arrow: {
    fontSize: 16,
    color: '#94A3B8',
    marginLeft: 8,
  },
});
