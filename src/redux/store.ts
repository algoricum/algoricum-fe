// src/redux/store.ts
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { 
  persistStore, 
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import userReducer from './slices/user.slice';
import clinicReducer from './slices/clinic.slice';

// Configure redux-persist
const persistConfig = {
  key: 'algoricum',
  storage,
  whitelist: ['user', 'clinic'] // Only persist these reducers
};

// Root reducer
const rootReducer = combineReducers({
  user: userReducer,
  clinic: clinicReducer
    // Add other reducers here as needed
});

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Create store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these redux-persist actions
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

// Create persisted store
export const persistor = persistStore(store);

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;