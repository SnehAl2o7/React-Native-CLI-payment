import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { getMaskedDisplay, getPaymentTypeInfo } from '../utils/maskData';

export default function DashboardScreen({ navigation }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const { logout, user } = useAuth();

  const fetchPayments = useCallback(async () => {
    try {
      const response = await api.get('/payments');
      setPayments(response.data.payments || []);
    } catch (error) {
      Alert.alert('Error', 'Failed to load payment methods.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchPayments();
    });
    return unsubscribe;
  }, [navigation, fetchPayments]);

  const handleDelete = (id) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this payment method?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionId(id);
            try {
              await api.delete(`/payments/${id}`);
              Alert.alert('Success', 'Payment method deleted successfully.');
              fetchPayments();
            } catch (error) {
              const msg = error.response?.data?.message || 'Failed to delete.';
              Alert.alert('Error', msg);
            } finally {
              setActionId(null);
            }
          },
        },
      ]
    );
  };

  const handleSetPrimary = async (id) => {
    setActionId(id);
    try {
      await api.patch(`/payments/${id}/primary`);
      fetchPayments();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to set primary.';
      Alert.alert('Error', msg);
    } finally {
      setActionId(null);
    }
  };

  const renderPaymentItem = ({ item }) => {
    const typeInfo = getPaymentTypeInfo(item.paymentType);
    const maskedValue = getMaskedDisplay(item);
    const isWorking = actionId === item._id;

    return (
      <View style={[styles.itemCard, item.isPrimary && styles.itemCardPrimary]}>
        <View style={styles.itemHeader}>
          <View style={styles.typeContainer}>
            <Text style={styles.icon}>{typeInfo.icon}</Text>
            <View style={styles.textContainer}>
              <Text style={styles.label}>{typeInfo.label}</Text>
              {item.isPrimary ? (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryBadgeText}>★ Primary</Text>
                </View>
              ) : null}
            </View>
          </View>
          {isWorking ? (
            <ActivityIndicator size="small" color="#4F46E5" />
          ) : (
            <View style={styles.actions}>
              {!item.isPrimary ? (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleSetPrimary(item._id)}
                  title="Make Primary"
                >
                  <Text style={styles.starIcon}>★</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('EditPayment', { payment: item })}
              >
                <Text style={styles.editIcon}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleDelete(item._id)}
              >
                <Text style={styles.deleteIcon}>🗑️</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.detailContainer}>
          <Text style={styles.detailText}>
            {item.paymentType === 'Bank' && `${item.bankName} · ${maskedValue}`}
            {item.paymentType === 'Paytm' && maskedValue}
            {item.paymentType === 'UPI' && maskedValue}
            {item.paymentType === 'PayPal' && maskedValue}
            {item.paymentType === 'USDT' && `${item.network} · ${maskedValue}`}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>Hello, {user?.username || 'User'}</Text>
          <Text style={styles.title}>Payment Methods</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading payment methods...</Text>
        </View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item) => item._id}
          renderItem={renderPaymentItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💳</Text>
              <Text style={styles.emptyTitle}>No payment methods yet</Text>
              <Text style={styles.emptySubtitle}>
                Add your first payment method to get started.
              </Text>
              <TouchableOpacity
                style={styles.addButtonInline}
                onPress={() => navigation.navigate('PaymentTypeSelection')}
              >
                <Text style={styles.addButtonInlineText}>Add Method</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {payments.length > 0 ? (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('PaymentTypeSelection')}
          activeOpacity={0.8}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  welcome: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  logoutText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
  },
  listContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  itemCardPrimary: {
    borderColor: '#818CF8',
    backgroundColor: '#EEF2FF',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 26,
    marginRight: 12,
  },
  textContainer: {
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  primaryBadge: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  primaryBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starIcon: {
    color: '#EAB308',
    fontSize: 16,
  },
  editIcon: {
    fontSize: 14,
  },
  deleteIcon: {
    fontSize: 14,
  },
  detailContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.03)',
    borderRadius: 8,
    padding: 12,
  },
  detailText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 30,
    marginBottom: 20,
    lineHeight: 20,
  },
  addButtonInline: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonInlineText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#4F46E5',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 28,
    fontWeight: '300',
    marginTop: -2,
  },
});
