// TypeScript types for PayFlow app

export type PaymentType = 'bank' | 'paytm' | 'upi' | 'paypal' | 'usdt';

// Payment interface with all possible fields (optional per type)
export interface Payment {
  _id: string;
  userId?: string;
  paymentType: PaymentType;
  // Bank fields
  ifscCode?: string;
  branchName?: string;
  bankName?: string;
  accountNumber?: string;
  accountHolderName?: string;
  // Paytm fields
  paytmNumber?: string;
  // UPI fields
  upiId?: string;
  // PayPal fields
  paypalEmail?: string;
  // USDT fields
  usdtWalletAddress?: string;
  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  _id: string;
  username: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user?: User;
  message?: string;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string>;
}

// Navigation types
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainStackParamList = {
  Dashboard: undefined;
  ChoosePaymentType: undefined;
  PaymentForm: {paymentType: PaymentType};
  EditPayment: {payment: Payment};
};

// Payment type metadata for the selection grid
export interface PaymentTypeInfo {
  type: PaymentType;
  label: string;
  description: string;
  icon: string;
  iconColor: string;
}
