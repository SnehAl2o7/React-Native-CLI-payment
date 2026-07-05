import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors} from '../theme/colors';
import {PaymentType, PaymentTypeInfo, MainStackParamList} from '../types';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const CARD_GAP = 12;
const HORIZONTAL_PADDING = 20;
const AVAILABLE_WIDTH = SCREEN_WIDTH - HORIZONTAL_PADDING * 2;
const THREE_COL_CARD_WIDTH =
  (AVAILABLE_WIDTH - CARD_GAP * 2) / 3;
const TWO_COL_CARD_WIDTH =
  (AVAILABLE_WIDTH - CARD_GAP) / 2;

const PAYMENT_TYPES: PaymentTypeInfo[] = [
  {
    type: 'bank',
    label: 'Bank',
    description: 'Add your bank account details',
    icon: 'bank',
    iconColor: Colors.iconBank,
  },
  {
    type: 'paytm',
    label: 'Paytm',
    description: 'Link your Paytm number',
    icon: 'cellphone',
    iconColor: Colors.iconPaytm,
  },
  {
    type: 'upi',
    label: 'UPI',
    description: 'Add your UPI ID',
    icon: 'flash',
    iconColor: Colors.iconUPI,
  },
  {
    type: 'paypal',
    label: 'PayPal',
    description: 'Connect your PayPal email',
    icon: 'paypal',
    iconColor: Colors.iconPayPal,
  },
  {
    type: 'usdt',
    label: 'USDT',
    description: 'Add your USDT wallet address',
    icon: 'bitcoin',
    iconColor: Colors.iconUSDT,
  },
];

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'ChoosePaymentType'>;
};

const ChoosePaymentTypeScreen: React.FC<Props> = ({navigation}) => {
  const [selectedType, setSelectedType] = useState<PaymentType | null>(null);

  const handleContinue = () => {
    if (selectedType) {
      navigation.navigate('PaymentForm', {paymentType: selectedType});
    }
  };

  const firstRow = PAYMENT_TYPES.slice(0, 3);
  const secondRow = PAYMENT_TYPES.slice(3, 5);

  const renderCard = (item: PaymentTypeInfo, cardWidth: number) => {
    const isSelected = selectedType === item.type;

    return (
      <TouchableOpacity
        key={item.type}
        style={[
          styles.card,
          {width: cardWidth},
          isSelected && styles.cardSelected,
        ]}
        activeOpacity={0.7}
        onPress={() => setSelectedType(item.type)}>
        <View
          style={[
            styles.iconContainer,
            {backgroundColor: `${item.iconColor}20`},
          ]}>
          <Icon name={item.icon} size={32} color={item.iconColor} />
        </View>
        <Text style={styles.cardLabel}>{item.label}</Text>
        <Text style={styles.cardDescription}>{item.description}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <Icon name="arrow-left" size={20} color={Colors.textSecondary} />
          <Text style={styles.backButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>

        {/* Header */}
        <Text style={styles.title}>Choose Payment Type</Text>
        <Text style={styles.subtitle}>
          Select the type of payment method you want to add
        </Text>

        {/* First Row - 3 columns */}
        <View style={styles.row}>
          {firstRow.map(item => renderCard(item, THREE_COL_CARD_WIDTH))}
        </View>

        {/* Second Row - 2 columns */}
        <View style={styles.row}>
          {secondRow.map(item => renderCard(item, TWO_COL_CARD_WIDTH))}
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            !selectedType && styles.continueButtonDisabled,
          ]}
          activeOpacity={selectedType ? 0.7 : 1}
          onPress={handleContinue}
          disabled={!selectedType}>
          <Text style={styles.continueButtonText}>Continue</Text>
          <Icon name="arrow-right" size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 16,
    paddingBottom: 100,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginLeft: 8,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 28,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  cardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaded,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardLabel: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  cardDescription: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: Colors.background,
  },
  continueButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ChoosePaymentTypeScreen;
