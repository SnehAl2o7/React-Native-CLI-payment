import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StatusBar,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors} from '../theme/colors';
import {paymentAPI} from '../api/apiClient';
import {useAuth} from '../context/AuthContext';
import {Payment, MainStackParamList} from '../types';

type DashboardScreenNavigationProp = NativeStackNavigationProp<
  MainStackParamList,
  'Dashboard'
>;

interface DashboardScreenProps {
  navigation: DashboardScreenNavigationProp;
}

const getPaymentIcon = (type: string): string => {
  switch (type) {
    case 'bank':
      return 'bank';
    case 'paytm':
      return 'cellphone';
    case 'upi':
      return 'flash';
    case 'paypal':
      return 'paypal';
    case 'usdt':
      return 'bitcoin';
    default:
      return 'credit-card-outline';
  }
};

const getPaymentIconColor = (type: string): string => {
  switch (type) {
    case 'bank':
      return Colors.iconBank;
    case 'paytm':
      return Colors.iconPaytm;
    case 'upi':
      return Colors.iconUPI;
    case 'paypal':
      return Colors.iconPayPal;
    case 'usdt':
      return Colors.iconUSDT;
    default:
      return Colors.textSecondary;
  }
};

const getPaymentDetail = (payment: Payment): string => {
  switch (payment.paymentType) {
    case 'bank': {
      const acc = payment.accountNumber || '';
      return acc.length > 4
        ? '••••' + acc.slice(-4)
        : '••••' + acc;
    }
    case 'paytm':
      return payment.paytmNumber || '';
    case 'upi':
      return payment.upiId || '';
    case 'paypal':
      return payment.paypalEmail || '';
    case 'usdt':
      return payment.usdtWalletAddress || '';
    default:
      return '';
  }
};

const capitalizeLabel = (type: string): string => {
  if (type === 'upi') {return 'UPI';}
  if (type === 'usdt') {return 'USDT';}
  if (type === 'paypal') {return 'PayPal';}
  if (type === 'paytm') {return 'Paytm';}
  return type.charAt(0).toUpperCase() + type.slice(1);
};

const DashboardScreen: React.FC<DashboardScreenProps> = ({navigation}) => {
  const {user, logout} = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPayments = useCallback(async () => {
    try {
      const result = await paymentAPI.getAll();
      // Handle both direct array response and wrapped {data: [...]} response
      const paymentData = Array.isArray(result) ? result : (result.data || result.payments || []);
      setPayments(paymentData);
    } catch (error: any) {
      if (error.response?.status === 401) {
        logout();
      } else {
        Alert.alert('Error', 'Failed to load payment methods. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logout]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchPayments();
    }, [fetchPayments]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPayments();
  }, [fetchPayments]);

  const handleDelete = useCallback(
    (payment: Payment) => {
      Alert.alert(
        'Delete Payment Method',
        `Are you sure you want to delete this ${capitalizeLabel(payment.paymentType)} payment method?`,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await paymentAPI.delete(payment._id);
                setPayments(prev => prev.filter(p => p._id !== payment._id));
              } catch (error: any) {
                Alert.alert(
                  'Error',
                  'Failed to delete payment method. Please try again.',
                );
              }
            },
          },
        ],
      );
    },
    [],
  );

  const handleLogout = useCallback(() => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  }, [logout]);

  const renderPaymentCard = ({item}: {item: Payment}) => (
    <View style={styles.paymentCard}>
      <View style={styles.paymentCardContent}>
        <View style={styles.paymentIconContainer}>
          <Icon
            name={getPaymentIcon(item.paymentType)}
            size={28}
            color={getPaymentIconColor(item.paymentType)}
          />
        </View>
        <View style={styles.paymentInfo}>
          <Text style={styles.paymentTypeLabel}>
            {capitalizeLabel(item.paymentType)}
          </Text>
          <Text style={styles.paymentDetail} numberOfLines={1}>
            {getPaymentDetail(item)}
          </Text>
        </View>
        <View style={styles.paymentActions}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('EditPayment', {payment: item})}
            activeOpacity={0.7}>
            <Icon name="pencil" size={20} color={Colors.primaryLight} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item)}
            activeOpacity={0.7}>
            <Icon name="trash-can-outline" size={20} color={Colors.deleteText} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <View style={styles.emptyStateCard}>
        <Icon
          name="credit-card-outline"
          size={48}
          color={Colors.iconBank}
          style={styles.emptyStateIcon}
        />
        <Text style={styles.emptyStateTitle}>No payment methods yet</Text>
        <Text style={styles.emptyStateSubtitle}>
          Add your first payment method to get started.
        </Text>
        <TouchableOpacity
          style={styles.emptyStateButton}
          onPress={() => navigation.navigate('ChoosePaymentType')}
          activeOpacity={0.7}>
          <Icon name="plus" size={18} color={Colors.white} />
          <Text style={styles.emptyStateButtonText}>Add Payment Method</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerSection}>
      <View style={styles.titleRow}>
        <View style={styles.titleGroup}>
          <Text style={styles.title}>Payment Methods</Text>
          <Text style={styles.subtitle}>
            {payments.length} {payments.length === 1 ? 'method' : 'methods'} saved
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('ChoosePaymentType')}
          activeOpacity={0.7}>
          <Icon name="plus" size={18} color={Colors.white} />
          <Text style={styles.addButtonText}>Add Method</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading payment methods...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.userInfo}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={styles.usernameText} numberOfLines={1}>
            {user?.username || 'User'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}>
          <Icon name="logout" size={18} color={Colors.deleteText} />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {payments.length === 0 ? (
        <>
          {renderHeader()}
          {renderEmptyState()}
        </>
      ) : (
        <FlatList
          data={payments}
          renderItem={renderPaymentCard}
          keyExtractor={item => item._id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
              progressBackgroundColor={Colors.cardBackground}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 16,
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  usernameText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    maxWidth: 160,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.deleteBackground,
    borderWidth: 1,
    borderColor: Colors.deleteBorder,
  },
  logoutButtonText: {
    color: Colors.deleteText,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },

  // Header Section
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleGroup: {
    flex: 1,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 12,
  },
  addButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },

  // List
  listContent: {
    paddingBottom: 32,
  },

  // Payment Card
  paymentCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: 20,
    marginTop: 16,
  },
  paymentCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  paymentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.cardBackgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  paymentInfo: {
    flex: 1,
    marginRight: 12,
  },
  paymentTypeLabel: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  paymentDetail: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  paymentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: Colors.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: Colors.deleteBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty State
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  emptyStateCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 40,
    alignItems: 'center',
    width: '100%',
  },
  emptyStateIcon: {
    marginBottom: 20,
  },
  emptyStateTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
  },
  emptyStateButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default DashboardScreen;
