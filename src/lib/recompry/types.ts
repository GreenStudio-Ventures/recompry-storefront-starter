// Alias cortos sobre los schemas generados, para no repetir `components['schemas'][…]`.
import type { components } from './schema';

type S = components['schemas'];

export type Store = S['Store'];
export type StoreCategory = S['StoreCategory'];
export type ImageSet = S['ImageSet'];
export type Category = S['Category'];
export type Location = S['Location'];
export type Product = S['Product'];
export type ProductVariant = S['ProductVariant'];
export type ProductModifierSet = S['ProductModifierSet'];
export type ProductModifier = S['ProductModifier'];
export type ProductSubscriptionPlan = S['ProductSubscriptionPlan'];
export type SearchProduct = S['SearchProduct'];
export type CartQuoteRequest = S['CartQuoteRequest'];
export type CartQuoteItem = S['CartQuoteItem'];
export type CartQuote = S['CartQuote'];
export type CartQuoteIssue = S['CartQuoteIssue'];
export type ShippingQuoteRequest = S['ShippingQuoteRequest'];
export type ShippingQuote = S['ShippingQuote'];
export type CreateOrderRequest = S['CreateOrderRequest'];
export type Order = S['Order'];
export type Tracking = S['Tracking'];
export type BuyerSession = S['BuyerSession'];
export type Customer = S['Customer'];
export type Address = S['Address'];
export type CreateAddressBody = S['CreateAddressBody'];
export type PaymentConfig = S['PaymentConfig'];
export type CreatePaymentRequest = S['CreatePaymentRequest'];
export type PaymentResult = S['PaymentResult'];
export type PaymentStatus = S['PaymentStatus'];
export type Plan = S['Plan'];
export type Subscription = S['Subscription'];
export type LoyaltyBalance = S['LoyaltyBalance'];
export type Credits = S['Credits'];
export type WaitlistEntry = S['WaitlistEntry'];
export type ErrorResponse = S['ErrorResponse'];

export type PaymentMethodCode = CreateOrderRequest['payment_method'];
export type OrderMode = CartQuoteRequest['mode'];
