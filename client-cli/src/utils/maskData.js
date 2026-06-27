// Masks bank account number showing last 4 digits
export function maskAccountNumber(accountNumber) {
  if (!accountNumber) return '';
  const cleaned = accountNumber.replace(/\s/g, '');
  if (cleaned.length <= 4) return cleaned;
  const last4 = cleaned.slice(-4);
  return `••••••${last4}`;
}

// Masks Paytm phone number
export function maskPaytmNumber(number) {
  if (!number) return '';
  const cleaned = number.replace(/\D/g, '');
  if (cleaned.length < 4) return number;
  const last4 = cleaned.slice(-4);
  return `••••••${last4}`;
}

// Masks UPI ID
export function maskUpiId(upiId) {
  if (!upiId) return '';
  const atIndex = upiId.indexOf('@');
  if (atIndex === -1) return upiId;
  const username = upiId.slice(0, atIndex);
  const provider = upiId.slice(atIndex);
  if (username.length <= 2) return upiId;
  return `${username.slice(0, 2)}${'•'.repeat(Math.min(username.length - 2, 6))}${provider}`;
}

// Masks PayPal email
export function maskPaypalEmail(email) {
  if (!email) return '';
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return email;
  const username = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  if (username.length <= 2) return email;
  return `${username.slice(0, 2)}${'•'.repeat(Math.min(username.length - 2, 6))}${domain}`;
}

// Masks USDT address
export function maskUsdtAddress(address) {
  if (!address) return '';
  if (address.length <= 8) return address;
  return `${address.slice(0, 6)}••••${address.slice(-4)}`;
}

// Gets masked display text for a payment method
export function getMaskedDisplay(payment) {
  switch (payment.paymentType) {
    case 'Bank':
      return maskAccountNumber(payment.accountNumber);
    case 'Paytm':
      return maskPaytmNumber(payment.paytmNumber);
    case 'UPI':
      return maskUpiId(payment.upiId);
    case 'PayPal':
      return maskPaypalEmail(payment.paypalEmail);
    case 'USDT':
      return maskUsdtAddress(payment.usdtAddress);
    default:
      return '';
  }
}

// Gets icon and label for a payment type
export function getPaymentTypeInfo(paymentType) {
  const types = {
    Bank: { label: 'Bank Account', icon: '🏦' },
    Paytm: { label: 'Paytm', icon: '📱' },
    UPI: { label: 'UPI', icon: '⚡' },
    PayPal: { label: 'PayPal', icon: '💳' },
    USDT: { label: 'USDT', icon: '₿' },
  };
  return types[paymentType] || { label: paymentType, icon: '💰' };
}
