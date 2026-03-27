// store/paymentStore.js
// Estado global del flujo de pago

import { create } from "zustand"

export const usePaymentStore = create((set) => ({
  selectedProvider: null,
  paymentData:      null,
  isProcessing:     false,

  setProvider:    (provider) => set({ selectedProvider: provider }),
  setPaymentData: (data)     => set({ paymentData: data }),
  setProcessing:  (val)      => set({ isProcessing: val }),
  reset:          ()         => set({
    selectedProvider: null,
    paymentData:      null,
    isProcessing:     false,
  }),
}))