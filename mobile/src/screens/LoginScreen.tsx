import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet } from "react-native";
import api from "../services/api";
import { useAuth } from "../../App";

export default function LoginScreen() {
  const { setAuth } = useAuth();
  const [email, setEmail] = useState("thercio@trtecnologias.com.br");
  const [password, setPassword] = useState("Tr030785");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLogin() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setAuth(data.user, data.accessToken, data.refreshToken);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TR MultiChat</Text>
      {!!error && <Text style={{ color: "red" }}>{error}</Text>}
      <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" placeholder="Email" />
      <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Senha" />
      <Button title={loading ? "Entrando..." : "Entrar"} onPress={onLogin} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  title: { fontSize: 22, marginBottom: 16 },
  input: { width: "100%", borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, marginBottom: 12 }
});



