import React, { useState } from "react";
import { View, Text, TextInput, Button, FlatList } from "react-native";

type Msg = { id: string; fromMe: boolean; body: string };

export default function ChatScreen() {
  const [messages, setMessages] = useState<Msg[]>([
    { id: "1", fromMe: false, body: "Olá!" },
    { id: "2", fromMe: true, body: "Oi, como posso ajudar?" }
  ]);
  const [text, setText] = useState("");

  function send() {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { id: String(Date.now()), fromMe: true, body: text }]);
    setText("");
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12 }}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <View style={{ alignSelf: item.fromMe ? "flex-end" : "flex-start", backgroundColor: item.fromMe ? "#2563eb" : "#e5e7eb", padding: 10, borderRadius: 8, marginVertical: 4 }}>
            <Text style={{ color: item.fromMe ? "#fff" : "#111" }}>{item.body}</Text>
          </View>
        )}
      />
      <View style={{ flexDirection: "row", gap: 8, padding: 8 }}>
        <TextInput value={text} onChangeText={setText} style={{ flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 }} />
        <Button title="Enviar" onPress={send} />
      </View>
    </View>
  );
}



