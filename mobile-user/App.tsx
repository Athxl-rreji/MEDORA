import React from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>MEDORA Mobile</Text>
      <Text style={styles.subtitle}>Find medicines & alternatives instantly</Text>
      
      <TextInput 
        style={styles.input} 
        placeholder="Search medicine brand or generic..." 
      />
      
      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Search 🔍</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Symptom Checker AI</Text>
        <Text style={styles.cardDesc}>Chat with our AI to get safe recommendations</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333'
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30
  },
  input: {
    width: '100%',
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15
  },
  button: {
    width: '100%',
    backgroundColor: '#0070f3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center'
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16
  },
  card: {
    marginTop: 40,
    width: '100%',
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    alignItems: 'center'
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  cardDesc: {
    color: '#555',
    marginTop: 5
  }
});
