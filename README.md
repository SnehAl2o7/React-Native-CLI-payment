# PayFlow — React Native Payment Manager

A React Native CLI mobile application for managing multiple payment methods (Bank, Paytm, UPI, PayPal, USDT) with JWT authentication.

## Features

- 🔐 **User Authentication** — Register & Login with JWT-based auth
- 💼 **Payment Management** — Add, view, edit, and delete payment methods
- 🏦 **Multiple Payment Types** — Bank Account, Paytm, UPI, PayPal, USDT
- 🌑 **Dark Theme** — Professional dark-themed UI
- 📱 **Mobile-First** — Built for Android with React Native CLI

## Tech Stack

- **React Native** 0.86 (CLI)
- **TypeScript**
- **React Navigation** (Native Stack)
- **Axios** (HTTP client)
- **AsyncStorage** (JWT persistence)
- **MaterialCommunityIcons** (Icons)

## Setup

### Prerequisites

- Node.js 18+
- Java 17 (JDK)
- Android Studio with SDK
- Android emulator or physical device

### Installation

```bash
# Install dependencies
npm install

# Start Metro bundler
npm start

# Run on Android (in another terminal)
npx react-native run-android
```

### Configuration

Update the backend API URL in `src/api/apiClient.ts`:

```typescript
const BASE_URL = 'https://your-backend.vercel.app';
```

Replace with your actual Vercel backend URL.

## Project Structure

```
src/
├── api/
│   └── apiClient.ts          # Axios instance + JWT interceptor
├── components/
│   ├── InputField.tsx         # Styled text input
│   ├── PaymentCard.tsx        # Payment method card
│   └── PrimaryButton.tsx      # Styled button
├── context/
│   └── AuthContext.tsx        # Auth state management
├── navigation/
│   └── AppNavigator.tsx       # Auth/Main stack routing
├── screens/
│   ├── LoginScreen.tsx
│   ├── RegisterScreen.tsx
│   ├── DashboardScreen.tsx
│   ├── ChoosePaymentTypeScreen.tsx
│   ├── PaymentFormScreen.tsx
│   └── EditPaymentScreen.tsx
├── theme/
│   └── colors.ts              # Color palette
└── types/
    └── index.ts               # TypeScript types
```

## API Endpoints (Expected)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/payment` | Get all payments |
| POST | `/api/payment` | Add payment |
| PUT | `/api/payment/:id` | Update payment |
| DELETE | `/api/payment/:id` | Delete payment |
