import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import api from "../services/api";

type Conversation = { id: number; contactName: string; lastMessage: string };

export default function ConversationsScreen({ navigation }: any) {
  const [items, setItems] = useState<Conversation[]>([]);
  useEffect(() => {
    // Placeholder: call your tickets endpoint when available
    setItems([
      { id: 1, contactName: "Cliente 1", lastMessage: "Olá" },
      { id: 2, contactName: "Cliente 2", lastMessage: "Tudo bem?" }
    ]);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate("Chat", { id: item.id })} style={{ padding: 16, borderBottomWidth: 1, borderColor: "#eee" }}>
            <Text style={{ fontWeight: "600" }}>{item.contactName}</Text>
            <Text style={{ color: "#666" }}>{item.lastMessage}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}



