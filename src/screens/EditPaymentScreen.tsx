import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RouteProp} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors} from '../theme/colors';
import {paymentAPI} from '../api/apiClient';
import {PaymentType, Payment, MainStackParamList} from '../types';

type EditPaymentScreenNavigationProp = NativeStackNavigationProp<
  MainStackParamList,
  'EditPayment'
>;
type EditPaymentScreenRouteProp = RouteProp<MainStackParamList, 'EditPayment'>;

interface Props {
  navigation: EditPaymentScreenNavigationProp;
  route: EditPaymentScreenRouteProp;
}

interface FieldConfig {
  key: string;
  label: string;
  placeholder: string;
  keyboardType?: 'default' | 'numeric' | 'email-address';
}

const getPaymentMeta = (
  type: PaymentType,
): {title: string; icon: string; iconColor: string} => {
  switch (type) {
    case 'bank':
      return {title: 'Edit Bank Account', icon: 'bank', iconColor: Colors.iconBank};
    case 'paytm':
      return {title: 'Edit Paytm', icon: 'wallet', iconColor: Colors.iconPaytm};
    case 'upi':
      return {title: 'Edit UPI', icon: 'cellphone-arrow-down', iconColor: Colors.iconUPI};
    case 'paypal':
      return {title: 'Edit PayPal', icon: 'paypal', iconColor: Colors.iconPayPal};
    case 'usdt':
      return {title: 'Edit USDT', icon: 'currency-usd', iconColor: Colors.iconUSDT};
  }
};

const getFieldConfigs = (type: PaymentType): FieldConfig[] => {
  switch (type) {
    case 'bank':
      return [
        {key: 'ifscCode', label: 'IFSC Code', placeholder: 'Enter IFSC code'},
        {key: 'branchName', label: 'Branch Name', placeholder: 'Enter branch name'},
        {key: 'bankName', label: 'Bank Name', placeholder: 'Enter bank name'},
        {
          key: 'accountNumber',
          label: 'Account Number',
          placeholder: 'Enter account number',
        },
        {
          key: 'accountHolderName',
          label: "Account Holder's Name",
          placeholder: "Enter account holder's name",
        },
      ];
    case 'paytm':
      return [
        {
          key: 'paytmNumber',
          label: 'Paytm Number',
          placeholder: 'Enter Paytm number',
          keyboardType: 'numeric',
        },
      ];
    case 'upi':
      return [
        {key: 'upiId', label: 'UPI ID', placeholder: 'Enter UPI ID (e.g. name@upi)'},
      ];
    case 'paypal':
      return [
        {
          key: 'paypalEmail',
          label: 'PayPal Email Address',
          placeholder: 'Enter PayPal email address',
          keyboardType: 'email-address',
        },
      ];
    case 'usdt':
      return [
        {
          key: 'usdtWalletAddress',
          label: 'USDT Wallet Address',
          placeholder: 'Enter USDT wallet address',
        },
      ];
  }
};

const getInitialValues = (
  payment: Payment,
  fieldConfigs: FieldConfig[],
): Record<string, string> => {
  const values: Record<string, string> = {};
  fieldConfigs.forEach(field => {
    values[field.key] = (payment as any)[field.key] || '';
  });
  return values;
};

const EditPaymentScreen: React.FC<Props> = ({navigation, route}) => {
  const {payment} = route.params;
  const paymentType = payment.paymentType;
  const meta = getPaymentMeta(paymentType);
  const fieldConfigs = getFieldConfigs(paymentType);

  const [formValues, setFormValues] = useState<Record<string, string>>(
    getInitialValues(payment, fieldConfigs),
  );
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleChange = (key: string, value: string) => {
    setFormValues(prev => ({...prev, [key]: value}));
    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleSubmit = async () => {
    // Validate all fields are filled
    const emptyField = fieldConfigs.find(
      field => !formValues[field.key]?.trim(),
    );
    if (emptyField) {
      setErrorMessage(`${emptyField.label} is required`);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const data: Record<string, string> = {paymentType};
      fieldConfigs.forEach(field => {
        data[field.key] = formValues[field.key].trim();
      });

      await paymentAPI.update(payment._id, data);
      Alert.alert('Success', 'Payment method updated successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Dashboard'),
        },
      ]);
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Failed to update payment method. Please try again.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}>
            <Icon name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <View
              style={[
                styles.headerIconContainer,
                {backgroundColor: `${meta.iconColor}20`},
              ]}>
              <Icon name={meta.icon} size={22} color={meta.iconColor} />
            </View>
            <Text style={styles.headerTitle}>{meta.title}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.formDescription}>
              Update your {paymentType === 'bank' ? 'bank account' : paymentType} details
              below.
            </Text>

            {/* Dynamic Fields */}
            {fieldConfigs.map(field => (
              <View key={field.key} style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <View
                  style={[
                    styles.inputContainer,
                    focusedField === field.key && styles.inputContainerFocused,
                  ]}>
                  <TextInput
                    style={styles.textInput}
                    value={formValues[field.key]}
                    onChangeText={text => handleChange(field.key, text)}
                    placeholder={field.placeholder}
                    placeholderTextColor={Colors.textPlaceholder}
                    keyboardType={field.keyboardType || 'default'}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => setFocusedField(field.key)}
                    onBlur={() => setFocusedField(null)}
                    editable={!loading}
                  />
                </View>
              </View>
            ))}
          </View>

          {/* Error Message */}
          {errorMessage && (
            <View style={styles.errorContainer}>
              <Icon name="alert-circle-outline" size={18} color={Colors.error} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Icon name="check-circle-outline" size={20} color={Colors.white} />
                <Text style={styles.submitButtonText}>Update Payment Method</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 16,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  inputContainer: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputContainerFocused: {
    borderColor: Colors.borderFocus,
  },
  textInput: {
    fontSize: 16,
    color: Colors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    flex: 1,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
});

export default EditPaymentScreen;
