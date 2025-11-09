import React, { useState } from "react";
import { View, Text, Switch, Button } from "react-native";
import { useAuth } from "../../App";

export default function SettingsScreen() {
  const { logout, user } = useAuth();
  const [online, setOnline] = useState(true);
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontWeight: "700", fontSize: 18, marginBottom: 12 }}>Configurações</Text>
      <Text>Usuário: {user?.name}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 12 }}>
        <Text style={{ marginRight: 8 }}>Online</Text>
        <Switch value={online} onValueChange={setOnline} />
      </View>
      <Button title="Sair" onPress={logout} />
    </View>
  );
}



