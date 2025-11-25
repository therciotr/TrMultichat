import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "./src/screens/LoginScreen";
import ConversationsScreen from "./src/screens/ConversationsScreen";
import ChatScreen from "./src/screens/ChatScreen";
import SettingsScreen from "./src/screens/SettingsScreen";

type User = { id: number; name: string; email: string; tenantId: number } | null;

type AuthContextType = {
  user: User;
  accessToken: string | null;
  refreshToken: string | null;
  tenantId: number | null;
  setAuth: (u: User, at: string, rt: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState<User>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<number | null>(null);

  const setAuth = useCallback((u: User, at: string, rt: string) => {
    setUser(u);
    setAccessToken(at);
    setRefreshToken(rt);
    setTenantId(u?.tenantId || null);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    setTenantId(null);
  }, []);

  const value = useMemo(() => ({ user, accessToken, refreshToken, tenantId, setAuth, logout }), [user, accessToken, refreshToken, tenantId, setAuth, logout]);

  return (
    <AuthContext.Provider value={value}>
      <NavigationContainer>
        <Stack.Navigator>
          {accessToken ? (
            <>
              <Stack.Screen name="Conversations" component={ConversationsScreen} />
              <Stack.Screen name="Chat" component={ChatScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
            </>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}



