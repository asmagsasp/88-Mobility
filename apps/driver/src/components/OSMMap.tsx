import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';

interface OSMMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  markers?: Array<{
    latitude: number;
    longitude: number;
    title?: string;
    color?: string;
  }>;
}

/**
 * Componente de Mapa 100% nativo OpenStreetMap (Leaflet) via WebView.
 * Não depende do Google Play Services, nunca trava nem fecha por falta de API Key.
 */
export function OSMMap({ latitude, longitude, zoom = 15, markers = [] }: OSMMapProps) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body, html, #map {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background-color: #0F172A;
          }
          .leaflet-control-attribution {
            font-size: 8px;
            background: rgba(15, 23, 42, 0.7) !important;
            color: #94A3B8 !important;
          }
          .leaflet-control-attribution a {
            color: #F59E0B !important;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', {
            zoomControl: false,
            attributionControl: true
          }).setView([${latitude}, ${longitude}], ${zoom});

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          // Ícone estilizado do 88 Mobility
          var customIcon = L.divIcon({
            className: 'custom-pin',
            html: '<div style="background-color: #F59E0B; width: 18px; height: 18px; border-radius: 50%; border: 3px solid #0F172A; box-shadow: 0 0 10px rgba(245, 158, 11, 0.8);"></div>',
            iconSize: [18, 18],
            iconAnchor: [9, 9]
          });

          L.marker([${latitude}, ${longitude}], { icon: customIcon }).addTo(map);

          ${markers.map(m => `
            L.marker([${m.latitude}, ${m.longitude}]).addTo(map)${m.title ? `.bindPopup('${m.title}')` : ''};
          `).join('\n')}
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#F59E0B" />
            <Text style={styles.loadingText}>Carregando OpenStreetMap...</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0F172A',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loading: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 10,
    fontSize: 13,
  },
});
