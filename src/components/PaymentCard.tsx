import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors} from '../theme/colors';
import {Payment, PaymentType} from '../types';

interface PaymentCardProps {
  payment: Payment;
  onEdit: (payment: Payment) => void;
  onDelete: (payment: Payment) => void;
}

const getPaymentIcon = (type: PaymentType): {name: string; color: string} => {
  switch (type) {
    case 'bank':
      return {name: 'bank', color: Colors.iconBank};
    case 'paytm':
      return {name: 'cellphone', color: Colors.iconPaytm};
    case 'upi':
      return {name: 'flash', color: Colors.iconUPI};
    case 'paypal':
      return {name: 'paypal', color: Colors.iconPayPal};
    case 'usdt':
      return {name: 'bitcoin', color: Colors.iconUSDT};
    default:
      return {name: 'credit-card', color: Colors.textSecondary};
  }
};

const getPaymentLabel = (type: PaymentType): string => {
  switch (type) {
    case 'bank':
      return 'Bank Account';
    case 'paytm':
      return 'Paytm';
    case 'upi':
      return 'UPI';
    case 'paypal':
      return 'PayPal';
    case 'usdt':
      return 'USDT';
    default:
      return type;
  }
};

const getPaymentDetail = (payment: Payment): string => {
  switch (payment.paymentType) {
    case 'bank':
      const accNum = payment.accountNumber || '';
      return accNum.length > 4
        ? `••••${accNum.slice(-4)}  •  ${payment.bankName || ''}`
        : payment.bankName || 'Bank Account';
    case 'paytm':
      const pNum = payment.paytmNumber || '';
      return pNum.length > 4
        ? `••••${pNum.slice(-4)}`
        : payment.paytmNumber || 'Paytm';
    case 'upi':
      return payment.upiId || 'UPI ID';
    case 'paypal':
      return payment.paypalEmail || 'PayPal Email';
    case 'usdt':
      const wallet = payment.usdtWalletAddress || '';
      return wallet.length > 8
        ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
        : wallet || 'Wallet Address';
    default:
      return '';
  }
};

const PaymentCard: React.FC<PaymentCardProps> = ({
  payment,
  onEdit,
  onDelete,
}) => {
  const iconInfo = getPaymentIcon(payment.paymentType);
  const label = getPaymentLabel(payment.paymentType);
  const detail = getPaymentDetail(payment);

  return (
    <View style={styles.card}>
      <View style={styles.leftSection}>
        <View
          style={[
            styles.iconContainer,
            {backgroundColor: `${iconInfo.color}15`},
          ]}>
          <Icon name={iconInfo.name} size={24} color={iconInfo.color} />
        </View>
        <View style={styles.textSection}>
          <Text style={styles.typeLabel}>{label}</Text>
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onEdit(payment)}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Icon name="pencil-outline" size={20} color={Colors.primaryLight} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => onDelete(payment)}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Icon name="trash-can-outline" size={20} color={Colors.deleteText} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textSection: {
    flex: 1,
  },
  typeLabel: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 3,
  },
  detail: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFaded,
  },
  deleteButton: {
    backgroundColor: Colors.deleteBackground,
  },
});

export default PaymentCard;
