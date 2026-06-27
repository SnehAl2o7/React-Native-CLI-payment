import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import api from '../api/axios';
import { getPaymentTypeInfo } from '../utils/maskData';

const FIELD_CONFIG = {
  Bank: [
    { name: 'accountNumber', label: 'Account Number', keyboard: 'numeric', placeholder: 'Enter account number', required: true },
    { name: 'accountHolderName', label: 'Account Holder Name', keyboard: 'default', placeholder: 'Full name on account', required: true },
    { name: 'bankName', label: 'Bank Name', keyboard: 'default', placeholder: 'e.g. State Bank of India', required: true },
    { name: 'ifscCode', label: 'IFSC Code', keyboard: 'default', placeholder: 'e.g. SBIN0001234', required: true, autoCaps: 'characters' },
    { name: 'branchName', label: 'Branch Name', keyboard: 'default', placeholder: 'e.g. Main Branch', required: true },
  ],
  Paytm: [
    { name: 'paytmNumber', label: 'Paytm Number', keyboard: 'phone-pad', placeholder: 'Enter Paytm registered number', required: true },
  ],
  UPI: [
    { name: 'upiId', label: 'UPI ID', keyboard: 'email-address', placeholder: 'e.g. username@upi', required: true },
  ],
  PayPal: [
    { name: 'paypalEmail', label: 'PayPal Email', keyboard: 'email-address', placeholder: 'your.email@example.com', required: true },
  ],
  USDT: [
    { name: 'usdtAddress', label: 'USDT Wallet Address', keyboard: 'default', placeholder: 'Enter wallet address', required: true },
    { name: 'network', label: 'Network', type: 'select', options: ['TRC20', 'ERC20'], required: true },
  ],
};

export default function EditPaymentFormScreen({ route, navigation }) {
  const { payment: initialPayment } = route.params || {};

  const [payment, setPayment] = useState(initialPayment || null);
  const [loading, setLoading] = useState(!payment);
  const [formData, setFormData] = useState({});
  const [isPrimary, setIsPrimary] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (payment) {
      initForm(payment);
      return;
    }

    const fetchPayment = async () => {
      try {
        const response = await api.get('/payments');
        // Find the payment by ID (wait, we need the ID from params, so let's pass id in route params if payment is missing)
        const id = route.params?.id;
        const found = response.data.payments.find((p) => p._id === id);
        if (found) {
          setPayment(found);
          initForm(found);
        } else {
          Alert.alert('Error', 'Payment method not found.');
          navigation.navigate('Dashboard');
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to load payment method.');
        navigation.navigate('Dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchPayment();
  }, [payment, route.params?.id]);

  const initForm = (p) => {
    const fields = FIELD_CONFIG[p.paymentType];
    if (!fields) return;
    const values = {};
    fields.forEach((f) => {
      values[f.name] = p[f.name]?.toString() || '';
    });
    setFormData(values);
    setIsPrimary(p.isPrimary || false);
    setLoading(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading payment details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!payment) return null;

  const fields = FIELD_CONFIG[payment.paymentType];
  const typeInfo = getPaymentTypeInfo(payment.paymentType);

  const handleChange = (name, value, autoCaps) => {
    const finalValue = autoCaps === 'characters' ? value.toUpperCase() : value;
    setFormData((prev) => ({ ...prev, [name]: finalValue }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    fields.forEach((f) => {
      if (f.required && !formData[f.name]?.trim()) {
        newErrors[f.name] = `${f.label} is required`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await api.put(`/payments/${payment._id}`, {
        isPrimary,
        ...formData,
      });
      Alert.alert('Success', 'Payment method updated successfully!');
      navigation.navigate('Dashboard');
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to update payment method.';
      const errs = error.response?.data?.errors;
      if (errs && Array.isArray(errs)) {
        Alert.alert('Error', errs.join(', '));
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.icon}>{typeInfo.icon}</Text>
            <Text style={styles.title}>Edit {typeInfo.label}</Text>
            <Text style={styles.subtitle}>Update your {typeInfo.label.toLowerCase()} details</Text>
          </View>

          <View style={styles.card}>
            {fields.map((field) => (
              <View key={field.name} style={styles.formGroup}>
                <Text style={styles.label}>{field.label}</Text>

                {field.type === 'select' ? (
                  <View style={styles.selectContainer}>
                    {field.options.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.selectOption,
                          formData[field.name] === opt && styles.selectOptionActive,
                        ]}
                        onPress={() => handleChange(field.name, opt)}
                        disabled={isSubmitting}
                      >
                        <Text
                          style={[
                            styles.selectOptionText,
                            formData[field.name] === opt && styles.selectOptionTextActive,
                          ]}
                        >
                          {opt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <TextInput
                    style={[styles.input, errors[field.name] && styles.inputError]}
                    placeholder={field.placeholder}
                    placeholderTextColor="#94A3B8"
                    keyboardType={field.keyboard || 'default'}
                    autoCapitalize={field.autoCaps || 'none'}
                    value={formData[field.name]}
                    onChangeText={(text) => handleChange(field.name, text, field.autoCaps)}
                    editable={!isSubmitting}
                  />
                )}
                {errors[field.name] ? <Text style={styles.errorLabel}>{errors[field.name]}</Text> : null}
              </View>
            ))}

            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setIsPrimary(!isPrimary)}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, isPrimary && styles.checkboxChecked]}>
                {isPrimary ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text style={styles.checkboxLabel}>Set as primary payment method</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.buttonText}>Update Payment Method</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  icon: {
    fontSize: 48,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  formGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorLabel: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  selectContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  selectOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  selectOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  selectOptionTextActive: {
    color: '#4F46E5',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#94A3B8',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  buttonDisabled: {
    backgroundColor: '#818CF8',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
  },
});
